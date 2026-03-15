import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '../../lib/admin'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 서버사이드 Supabase (크레딧 차감용 - RLS 우회를 위해 SERVICE_ROLE_KEY 사용)
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MAX_HEIGHT_PX = 1800

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { imageData, mimeType, userId, userEmail, fileName, cropY1, cropY2, sectionNum, totalSections } = req.body
  if (!imageData || !userId) return res.status(400).json({ error: '필수 값이 없어요' })

  try {
    const isUserAdmin = isAdmin(userEmail)

    // 크레딧 확인 (프로필이 없으면 자동 생성 - Lazy Creation)
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('free_credits, paid_credits')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      // 프로필이 없는 경우 새로 생성 (기본 5크레딧)
      const { data: newProfile, error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: userEmail || '',
          free_credits: 5,
          paid_credits: 0
        }, { onConflict: 'id', ignoreDuplicates: true })
        .select()
        .single()
      
      if (upsertError) {
        console.error('[API] Profile creation failed:', upsertError);
        return res.status(500).json({ error: '프로필 생성에 실패했습니다.' })
      }
      profile = newProfile
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

    // cropY1, cropY2가 있으면 해당 섹션만 잘라서 변환
    if (cropY1 !== undefined && cropY2 !== undefined) {
      const sectionHeight = cropY2 - cropY1
      finalBuffer = await sharp(imageBuffer)
        .extract({ left: 0, top: cropY1, width, height: sectionHeight })
        .png()
        .toBuffer()
    }

    const finalBase64 = finalBuffer.toString('base64')
    const svg = await convertToSvg(finalBase64, 'image/png', sectionNum || 1, totalSections || 1)
    const cleanedSvg = removeTspan(svg)

    // ★ 변환 성공한 경우에만 크레딧 1개 차감
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

    // 변환 기록 저장
    await supabase.from('conversions').insert({
      user_id: userId,
      original_filename: fileName || 'unknown',
      svg_result: cleanedSvg,
      is_free: isUserAdmin ? false : (profile?.free_credits || 0) > 0,
    })

    return res.status(200).json({ svg: cleanedSvg })

  } catch (err: any) {
    // ★ 오류 발생 시 크레딧 차감 안됨 (여기까지 오면 차감 코드가 실행 안된 것)
    console.error('Convert error:', err)
    return res.status(500).json({ error: err.message || '변환 중 오류가 발생했어요' })
  }
}

// ── tspan 후처리 ──
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

2. 텍스트 규칙 (매우 중요):
   - 같은 디자인 블록 안의 텍스트는 반드시 하나의 text 요소로 작성
   - 여러 줄 텍스트도 공백으로 이어서 한 줄로 작성
   - tspan 절대 사용 금지
   - 올바른 예시: <text x="58" y="420" font-size="15" fill="#555">첫줄 둘째줄</text>

3. 이미지/사진 영역 규칙 (매우 중요):
   - 반드시 아래 구조로 만들것 (피그마에서 드래그 앤 드롭 가능):
   <clipPath id="img1"><rect x="X" y="Y" width="W" height="H" rx="12"/></clipPath>
   <g clip-path="url(#img1)">
     <rect x="X" y="Y" width="W" height="H" fill="#e8e4de" stroke="#bbb" stroke-width="1.5" stroke-dasharray="8,5"/>
     <rect x="CX" y="CY" width="60" height="42" rx="8" fill="none" stroke="#aaa" stroke-width="2"/>
     <circle cx="CX+30" cy="CY+21" r="12" fill="none" stroke="#aaa" stroke-width="2"/>
     <text x="CX+30" y="CY+70" font-size="13" fill="#999" text-anchor="middle">이미지 영역</text>
   </g>
   - image 태그 사용 금지
   - clipPath id는 img1, img2, img3... 순서로 (중복 금지)

4. 텍스트 편집 프레임은 점선 rect로 표시
5. viewBox는 반드시 "0 0 860 [높이]" 형식 사용
6. 한국어 폰트: font-family="'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"
7. svg 태그만 출력 - 다른 설명이나 마크다운 없이

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
