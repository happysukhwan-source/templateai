import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { isAdmin } from '../../lib/admin'
import { getAuthUser } from '../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !supabaseUrl) {
    return res.status(500).json({ error: '데이터베이스 설정이 누락되었습니다.' })
  }

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: '로그인이 필요해요' })

  const userId = user.id
  const userEmail = user.email

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { imageData, fileName, cropY1, cropY2, sectionNum, totalSections, originalHeight: clientHeight } = req.body
  if (!imageData) return res.status(400).json({ error: '필수 값이 없어요' })

  try {
    const isUserAdmin = isAdmin(userEmail)

    // 1. 이미지 높이 먼저 분석 (크레딧 산정용)
    const imageBuffer = Buffer.from(imageData, 'base64')
    const sharp = require('sharp')
    const metadata = await sharp(imageBuffer).metadata()
    const { width = 860, height = 0 } = metadata

    // 2. 필요 크레딧 계산 (클라이언트에서 보낸 실제 원본 높이 우선)
    const activeHeight = clientHeight || height
    const requiredCredits = activeHeight >= 5000 ? 2 : 1

    let { data: profile, error: profileError } = await supabase
      .from('profiles').select('free_credits, paid_credits').eq('id', userId).single()

    if (profileError || !profile) {
      await supabase.from('profiles').upsert({
        id: userId, email: userEmail || '', free_credits: 5, paid_credits: 0
      }, { onConflict: 'id' })
      const { data } = await supabase.from('profiles').select('free_credits, paid_credits').eq('id', userId).single()
      profile = data
    }

    const freeCredits = profile?.free_credits || 0
    let paidCredits = profile?.paid_credits || 0

    // 만료된 유료 크레딧 처리
    if (!isUserAdmin && paidCredits > 0) {
      const now = new Date().toISOString()
      const { data: expiredPayments } = await supabase
        .from('payments')
        .select('credits_added')
        .eq('user_id', userId)
        .lt('expires_at', now)

      if (expiredPayments && expiredPayments.length > 0) {
        const expiredCredits = expiredPayments.reduce((sum: number, p: any) => sum + p.credits_added, 0)
        const deductExpired = Math.min(paidCredits, expiredCredits)
        if (deductExpired > 0) {
          paidCredits = paidCredits - deductExpired
          await supabase.from('profiles').update({ paid_credits: paidCredits }).eq('id', userId)
          await supabase.from('payments').delete().eq('user_id', userId).lt('expires_at', now)
        }
      }
    }

    const totalCredits = freeCredits + paidCredits

    // 3. 권한 및 잔액 체크
    if (!isUserAdmin && totalCredits < requiredCredits) {
      return res.status(400).json({ error: `크레딧이 부족해요. (필요: ${requiredCredits}, 보유: ${totalCredits})` })
    }

    // 4. 크레딧 차감
    let usedFreeCount = 0
    let usedPaidCount = 0

    if (!isUserAdmin) {
      let remainingToDeduct = requiredCredits
      
      // 무료 크레딧 우선 차감
      const deductFree = Math.min(freeCredits, remainingToDeduct)
      if (deductFree > 0) {
        await supabase.from('profiles').update({ free_credits: freeCredits - deductFree }).eq('id', userId)
        usedFreeCount = deductFree
        remainingToDeduct -= deductFree
      }

      // 남은 금액 유료 크레딧에서 차감
      if (remainingToDeduct > 0) {
        await supabase.from('profiles').update({ paid_credits: paidCredits - remainingToDeduct }).eq('id', userId)
        usedPaidCount = remainingToDeduct
      }
    }

    let finalBuffer = imageBuffer
    if (cropY1 !== undefined && cropY2 !== undefined) {
      const sectionHeight = cropY2 - cropY1
      finalBuffer = await sharp(imageBuffer).extract({ left: 0, top: cropY1, width, height: sectionHeight }).png().toBuffer()
    }

    let svg: string
    try {
      const finalBase64 = finalBuffer.toString('base64')
      svg = mergeConsecutiveTexts(removeTspan(await convertToSvg(finalBase64, 'image/png', sectionNum || 1, totalSections || 1, activeHeight)))
    } catch (err) {
      // 실패 시 크레딧 복구
      if (!isUserAdmin) {
        if (usedFreeCount > 0) {
          const { data: current } = await supabase.from('profiles').select('free_credits').eq('id', userId).single()
          await supabase.from('profiles').update({ free_credits: (current?.free_credits || 0) + usedFreeCount }).eq('id', userId)
        }
        if (usedPaidCount > 0) {
          const { data: current } = await supabase.from('profiles').select('paid_credits').eq('id', userId).single()
          await supabase.from('profiles').update({ paid_credits: (current?.paid_credits || 0) + usedPaidCount }).eq('id', userId)
        }
      }
      throw err
    }

    await supabase.from('conversions').insert({
      user_id: userId,
      original_filename: fileName || 'unknown',
      svg_result: svg,
      is_free: isUserAdmin ? false : (usedFreeCount > 0),
    })

    return res.status(200).json({ svg })

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
    const sameStyle = Math.abs(el.x - prev.x) <= 5 && el.fontSize === prev.fontSize && el.fill === prev.fill && el.fontWeight === prev.fontWeight && el.y > prev.y && el.y - prev.y <= prev.fontSize * 2.5
    if (sameStyle && !/[<>]/.test(between)) { currentGroup.push(el) } else { groups.push([...currentGroup]); currentGroup = [el] }
  }
  if (currentGroup.length > 0) groups.push([...currentGroup])
  const replacements: { start: number; end: number; replacement: string }[] = []
  for (const group of groups) {
    if (group.length <= 1) continue
    const first = group[0]; const last = group[group.length - 1]
    replacements.push({ start: first.index, end: last.end, replacement: `<text${first.attrs}>${group.map(el => el.content).join(' ')}</text>` })
  }
  replacements.sort((a, b) => b.start - a.start)
  let result = svg
  for (const { start, end, replacement } of replacements) { result = result.slice(0, start) + replacement + result.slice(end) }
  return result
}

function removeTspan(svg: string): string {
  return svg.replace(/<text([^>]*)>([\s\S]*?)<\/text>/g, (match, attrs, inner) => {
    if (!inner.includes('<tspan')) return match
    const texts: string[] = []
    const tspanRegex = /<tspan[^>]*>([\s\S]*?)<\/tspan>/g
    let m; while ((m = tspanRegex.exec(inner)) !== null) { const t = m[1].trim(); if (t) texts.push(t) }
    if (texts.length === 0) return match
    return `<text${attrs}>${texts.join(' ')}</text>`
  })
}

async function convertToSvg(base64: string, mimeType: string, sectionNum: number, totalSections: number, activeHeight: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY가 누락되었습니다.');
  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
  
  const sectionInfo = totalSections > 1 ? ` (섹션 ${sectionNum}/${totalSections})` : '';
  const promptText = `이미지를 분석하여 피그마(Figma)에서 즉시 편집 가능한 SVG 템플릿으로 변환하세요.

### 📐 크기 지침 (가장 중요)
- 이 이미지의 원본 세로 길이는 **${activeHeight}px**입니다. 
- AI는 결과물 SVG의 전체 높이가 이 원본 높이와 일치하거나 매우 비슷하도록 요소들 사이의 공백(영역 간 여백)을 실감나게 재현해야 합니다. 절대 임의로 길이를 압축하지 마세요.

### 📋 텍스트 강제 치환 - 원본 텍스트 100% 무시
이미지 속 모든 텍스트는 내용을 분석하지 말고 아래의 지정된 문구로만 **무조건** 교체하세요. (원본 내용 사용 금지)
1. **가장 큰 메인 제목**: "제목 한 줄 입력" (1줄), "제목 두 줄 입력" (2줄)
2. **중간 크기 본문/설명**: "내용 설명 최대 한 줄", "내용 설명 최대 두 줄"
3. **태그/라벨/이미지 상단 작은 글씨**: "내용 한줄 입력"
4. **버튼 텍스트**: "버튼 텍스트 입력"

### 📋 그리기 규칙
- **이미지 영역**: 사진 자리는 아이콘 없이 깨끗한 회색 박스(<rect fill="#ddd"/>)로만 만드세요.
- **도형 중심**: 모든 요소는 피그마에서 수정 가능하도록 <rect>, <text> 위주로 구성하세요. <path> 사용을 최소화하세요.
- **XML 준수**: 모든 속성값은 **반드시 큰따옴표("")**를 사용하세요. (예: height="100")
- **폰트**: font-family="Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, sans-serif"
- 오직 <svg> 코드만 출력하세요. 설명 금지.`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: promptText }, { inlineData: { data: base64, mimeType: mimeType } }] }],
    generationConfig: { maxOutputTokens: 65536, temperature: 0.1 }
  });

  let text = result.response.text();
  text = text.replace(/```[a-z]*\n?/ig, '').replace(/```\n?/g, '').trim();
  const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
  const finalSvg = svgMatch ? svgMatch[0] : text;
  return finalSvg.substring(finalSvg.indexOf('<'));
}

export const config = { api: { bodyParser: { sizeLimit: '30mb' } } }
