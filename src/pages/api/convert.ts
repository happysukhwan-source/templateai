import type { NextApiRequest, NextApiResponse } from 'next'
import { Anthropic } from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '../../lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !supabaseUrl) {
    return res.status(500).json({ error: '데이터베이스 설정(SUPABASE_SERVICE_ROLE_KEY)이 누락되었습니다. .env.local 파일을 확인해주세요.' })
  }

  const supabase = createClient(
    supabaseUrl,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { imageData, mimeType, userId, userEmail, fileName, cropY1, cropY2, sectionNum, totalSections } = req.body
  if (!imageData || !userId) return res.status(400).json({ error: '필수 값이 없어요' })

  try {
    const isUserAdmin = isAdmin(userEmail)

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('free_credits, paid_credits')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      // upsert (ignoreDuplicates 제거)
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: userEmail || '',
          free_credits: 5,
          paid_credits: 0
        }, { onConflict: 'id' })

      if (upsertError) {
        console.error('[API] Profile creation failed:', upsertError.message, upsertError.details, upsertError.code)
        return res.status(500).json({ error: `프로필 생성 실패: ${upsertError.message} (${upsertError.code})` })
      }

      // upsert 후 다시 조회
      const { data: fetchedProfile } = await supabase
        .from('profiles')
        .select('free_credits, paid_credits')
        .eq('id', userId)
        .single()

      profile = fetchedProfile
    }

    const totalCredits = (profile?.free_credits || 0) + (profile?.paid_credits || 0)

    if (!isUserAdmin && totalCredits <= 0) {
      return res.status(400).json({ error: '크레딧이 부족해요. 충전 후 이용해주세요.' })
    }

    const imageBuffer = Buffer.from(imageData, 'base64')
    const sharp = require('sharp')
    const metadata = await sharp(imageBuffer).metadata()
    const { width = 860, height = 800 } = metadata

    let finalBuffer = imageBuffer

    if (cropY1 !== undefined && cropY2 !== undefined) {
      const sectionHeight = cropY2 - cropY1
      finalBuffer = await sharp(imageBuffer)
        .extract({ left: 0, top: cropY1, width, height: sectionHeight })
        .png()
        .toBuffer()
    }

    const finalBase64 = finalBuffer.toString('base64')
    const svg = mergeConsecutiveTexts(removeTspan(await convertToSvg(finalBase64, 'image/png', sectionNum || 1, totalSections || 1)))

    if (!isUserAdmin) {
      if ((profile?.free_credits || 0) > 0) {
        await supabase
          .from('profiles')
          .update({ free_credits: profile!.free_credits - 1 })
          .eq('id', userId)
      } else {
        await supabase
          .from('profiles')
          .update({ paid_credits: profile!.paid_credits - 1 })
          .eq('id', userId)
      }
    }

    await supabase.from('conversions').insert({
      user_id: userId,
      original_filename: fileName || 'unknown',
      svg_result: svg,
      is_free: isUserAdmin ? false : (profile?.free_credits || 0) > 0,
    })

    return res.status(200).json({ svg: svg })

  } catch (err: any) {
    console.error('Convert error:', err)
    return res.status(500).json({ error: err.message || '변환 중 오류가 발생했어요' })
  }
}


function mergeConsecutiveTexts(svg: string): string {
  interface TextEl {
    full: string; attrs: string; content: string
    index: number; end: number
    x: number; y: number; fontSize: number; fill: string; fontWeight: string
  }

  const textRegex = /<text([^>]*)>([^<]*)<\/text>/g
  const elements: TextEl[] = []
  let m: RegExpExecArray | null

  while ((m = textRegex.exec(svg)) !== null) {
    const attrs = m[1]
    const content = m[2].trim()
    if (!content) continue
    const x = parseFloat(attrs.match(/x="([^"]+)"/)?.[1] || '0')
    const y = parseFloat(attrs.match(/y="([^"]+)"/)?.[1] || '0')
    const fontSize = parseFloat(attrs.match(/font-size="([^"]+)"/)?.[1] || '0')
    const fill = attrs.match(/fill="([^"]+)"/)?.[1] || ''
    const fontWeight = attrs.match(/font-weight="([^"]+)"/)?.[1] || 'normal'
    elements.push({ full: m[0], attrs, content, index: m.index, end: m.index + m[0].length, x, y, fontSize, fill, fontWeight })
  }

  const groups: TextEl[][] = []
  let currentGroup: TextEl[] = []

  for (const el of elements) {
    if (currentGroup.length === 0) { currentGroup.push(el); continue }
    const prev = currentGroup[currentGroup.length - 1]
    const between = svg.slice(prev.end, el.index)
    const noElementsBetween = !/[<>]/.test(between)
    const sameStyle =
      Math.abs(el.x - prev.x) <= 5 &&
      el.fontSize === prev.fontSize &&
      el.fill === prev.fill &&
      el.fontWeight === prev.fontWeight &&
      el.y > prev.y &&
      el.y - prev.y <= prev.fontSize * 2.5
    if (sameStyle && noElementsBetween) {
      currentGroup.push(el)
    } else {
      groups.push([...currentGroup])
      currentGroup = [el]
    }
  }
  if (currentGroup.length > 0) groups.push([...currentGroup])

  const replacements: { start: number; end: number; replacement: string }[] = []
  for (const group of groups) {
    if (group.length <= 1) continue
    const first = group[0]
    const last = group[group.length - 1]
    const merged = group.map(el => el.content).join(' ')
    replacements.push({ start: first.index, end: last.end, replacement: `<text${first.attrs}>${merged}</text>` })
  }

  replacements.sort((a, b) => b.start - a.start)
  let result = svg
  for (const { start, end, replacement } of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end)
  }
  return result
}

function removeTspan(svg: string): string {
  return svg.replace(
    /<text([^>]*)>([\s\S]*?)<\/text>/g,
    (match, attrs, inner) => {
      if (!inner.includes('<tspan')) return match
      const texts: string[] = []
      const tspanRegex = /<tspan[^>]*>([\s\S]*?)<\/tspan>/g
      let m
      while ((m = tspanRegex.exec(inner)) !== null) {
        const t = m[1].trim()
        if (t) texts.push(t)
      }
      if (texts.length === 0) return match
      return `<text${attrs}>${texts.join(' ')}</text>`
    }
  )
}

async function convertToSvg(base64: string, mimeType: string, sectionNum: number, totalSections: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  // PRODUCTION DEBUG LOG
  console.log(`[DEBUG-AUTH] Key Check - Found: ${!!apiKey}, Length: ${apiKey?.length || 0}`);

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('ANTHROPIC_API_KEY가 서버 설정에 누락되었습니다. Vercel Dashboard의 Environment Variables를 확인해주세요.')
  }

  const client = new Anthropic({ apiKey: apiKey.trim() })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType as any, data: base64 }
        },
        {
          type: 'text',
          text: `이 이미지는 한국 쇼핑몰 상세페이지${totalSections > 1 ? ` (섹션 ${sectionNum}/${totalSections})` : ''}입니다.
피그마에서 바로 편집 가능한 SVG 템플릿으로 변환해주세요.

규칙:
1. 배경색과 레이아웃 구조를 최대한 유사하게 재현

2. 섹션 그룹핑 규칙 (매우 중요 - 피그마 편집 편의를 위해):
   - 이미지의 시각적 섹션(블록) 단위로 <g id="section-1">, <g id="section-2"> ... 로 묶을 것
   - 각 <g> 안의 요소들은 반드시 y 좌표 오름차순(위→아래)으로 작성
   - <g> 태그 자체도 위에서 아래 순서로 배치 (y가 작은 섹션이 먼저)
   - 예시 구조:
     <g id="section-1">  <!-- y: 0~200 영역 -->
       <rect ...배경... />
       <text ...위쪽 텍스트... />
       <text ...아래쪽 텍스트... />
     </g>
     <g id="section-2">  <!-- y: 200~500 영역 -->
       ...
     </g>
   - clipPath 정의(<defs>)는 svg 최상단에 모아서 작성

3. 텍스트 규칙 (매우 중요):
   - 같은 폰트 크기·스타일·색상의 텍스트는 반드시 하나의 <text> 요소에 한 줄로 합쳐서 작성
   - 여러 줄이라도 공백으로 이어서 하나의 text 요소로 작성 (tspan 사용 금지)
   - 올바른 예시: <text x="58" y="420" font-size="13" fill="#555">첫 번째 줄 두 번째 줄</text>
   - 폰트 크기나 색상이 다른 텍스트는 별도 <text> 요소로 분리

4. 이미지/사진 영역 규칙 (매우 중요):
   - 이미지 프레임 좌표 결정 방법:
     (a) 원본 이미지 전체 크기 대비 해당 사진의 위치 비율을 측정
     (b) 그 비율을 viewBox(860×높이) 기준으로 환산하여 x, y, width, height 결정
     (c) 이미지 프레임은 반드시 해당 카드/컨테이너 rect 내부에 완전히 포함되어야 함
         → 카드 rect의 y+padding ~ y+height-padding 범위를 절대 벗어나지 않을 것
     (d) 이미지 프레임이 텍스트 요소와 절대 겹치지 않을 것
   - 반드시 아래 구조로 만들것 (피그마에서 드래그 앤 드롭 가능):
   <clipPath id="img1"><rect x="X" y="Y" width="W" height="H" rx="12"/></clipPath>
   <g clip-path="url(#img1)">
     <rect x="X" y="Y" width="W" height="H" fill="#e8e4de" stroke="#bbb" stroke-width="1.5" stroke-dasharray="8,5"/>
   </g>
   - 아이콘, 카메라 모양, "이미지 영역" 텍스트 등 내부 장식 요소 절대 추가 금지 (rect 하나만)
   - image 태그 사용 금지
   - clipPath id는 img1, img2, img3... 순서로 (중복 금지)

5. 아이콘 규칙:
   - 원본에 아이콘이 있는 경우 SVG 도형으로 그리지 말고 이미지 프레임(점선 rect)으로 대체
   - 아이콘 프레임도 img1, img2... 순서에 포함하여 clipPath 구조로 작성

6. 텍스트 편집 프레임은 점선 rect로 표시
7. viewBox는 반드시 "0 0 860 [높이]" 형식 사용
8. 한국어 폰트: font-family="'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"
9. svg 태그만 출력 - 다른 설명이나 마크다운 없이

SVG 코드만 출력하세요.`
        }
      ]
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const svgMatch = text.match(/<svg[\s\S]*<\/svg>/)
  return svgMatch ? svgMatch[0] : text
}

export const config = {
  api: { bodyParser: { sizeLimit: '30mb' } }
}