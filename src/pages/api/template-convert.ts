import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { isAdmin } from '../../lib/admin'
import { getAuthUser } from '../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY가 누락되었습니다.' })

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: '로그인이 필요해요' })

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { imageData, fileName, sectionNum, totalSections, originalHeight: clientHeight } = req.body
  if (!imageData) return res.status(400).json({ error: '이미지 데이터가 없어요' })

  try {
    const isUserAdmin = isAdmin(user.email)

    // 1. 이미지 높이 분석 (크레딧 산정용)
    const imageBuffer = Buffer.from(imageData, 'base64')
    const sharp = require('sharp')
    const metadata = await sharp(imageBuffer).metadata()
    const { height = 0 } = metadata

    // 2. 필요 크레딧 계산
    const activeHeight = clientHeight || height
    const requiredCredits = activeHeight >= 5000 ? 2 : 1

    let { data: profile } = await supabase.from('profiles').select('free_credits, paid_credits').eq('id', user.id).single()
    if (!profile) {
      await supabase.from('profiles').upsert({ id: user.id, email: user.email || '', free_credits: 5, paid_credits: 0 })
      const { data } = await supabase.from('profiles').select('free_credits, paid_credits').eq('id', user.id).single()
      profile = data
    }
    const totalCredits = (profile?.free_credits || 0) + (profile?.paid_credits || 0)
    
    if (!isUserAdmin && totalCredits < requiredCredits) {
      return res.status(400).json({ error: `크레딧이 부족해요. (보유: ${totalCredits}, 필요: ${requiredCredits})` })
    }

    let usedFreeCount = 0
    let usedPaidCount = 0

    if (!isUserAdmin) {
      let remaining = requiredCredits
      const free = profile?.free_credits || 0
      const deductFree = Math.min(free, remaining)
      if (deductFree > 0) {
        await supabase.from('profiles').update({ free_credits: free - deductFree }).eq('id', user.id)
        usedFreeCount = deductFree
        remaining -= deductFree
      }
      if (remaining > 0) {
        const paid = profile?.paid_credits || 0
        await supabase.from('profiles').update({ paid_credits: paid - remaining }).eq('id', user.id)
        usedPaidCount = remaining
      }
    }

    let svg: string
    try {
      svg = await convertToTemplateSvg(imageData, 'image/png', sectionNum || 1, totalSections || 1)
    } catch (err) {
      if (!isUserAdmin) {
        if (usedFreeCount > 0) {
          const { data: cur } = await supabase.from('profiles').select('free_credits').eq('id', user.id).single()
          await supabase.from('profiles').update({ free_credits: (cur?.free_credits || 0) + usedFreeCount }).eq('id', user.id)
        }
        if (usedPaidCount > 0) {
          const { data: cur } = await supabase.from('profiles').select('paid_credits').eq('id', user.id).single()
          await supabase.from('profiles').update({ paid_credits: (cur?.paid_credits || 0) + usedPaidCount }).eq('id', user.id)
        }
      }
      throw err
    }

    await supabase.from('conversions').insert({
      user_id: user.id, original_filename: fileName || 'unknown', svg_result: svg, is_free: isUserAdmin ? false : (usedFreeCount > 0),
    })
    return res.status(200).json({ svg })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || '변환 오류' })
  }
}

async function convertToTemplateSvg(base64: string, mimeType: string, sectionNum: number, totalSections: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  const genAI = new GoogleGenerativeAI(apiKey!.trim())
  const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

  const sectionInfo = totalSections > 1 ? ` (섹션 ${sectionNum}/${totalSections})` : '';
  const promptText = `이미지를 분석하여 피그마용 SVG 템플릿으로 변환하세요.

### 📋 텍스트 강제 치환 (정답 이미지 가이드 준수) - 원본 텍스트 100% 무시
이미지 속 모든 텍스트를 분석하여 아래의 지정된 문구로만 **무조건** 교체하세요. 원본 단어 사용 금지.
1. **가장 큰 메인 제목**: "제목 한 줄 입력" (1줄), "제목 두 줄 입력" (2줄)
2. **중간 크기 본문/설명**: "내용 설명 최대 한 줄", "내용 설명 최대 두 줄" (줄 수에 맞춰 한글 숫자 '한', '두', '세' 등 사용)
3. **태그/라벨/이미지 위 작은 텍스트**: "내용 한줄 입력"
4. **버튼 텍스트**: "버튼 텍스트 입력"

### 📋 그리기 규칙
- **이미지 영역**: 사진이 있던 자리는 어떠한 아이콘도 넣지 말고, 깨끗한 회색 박스(<rect fill="#ddd"/>) 또는 체크무늬 패턴으로만 만드세요.
- **도형 중심**: 모든 요소는 피그마에서 수정 가능하도록 <rect>, <text> 위주로 구성하세요. <path> 사용 금지.
- **폰트**: font-family="Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, sans-serif"
- **XML 준수**: 모든 속성값은 큰따옴표("")를 사용하세요.
- 오직 <svg> 코드만 출력하세요. 설명 금지.`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: promptText }, { inlineData: { data: base64, mimeType: mimeType } }] }],
    generationConfig: { maxOutputTokens: 65536, temperature: 0.1 }
  });

  let text = result.response.text().replace(/```[a-z]*\n?/ig, '').replace(/```\n?/g, '').trim()
  const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i)
  return svgMatch ? svgMatch[0] : text
}

export const config = { api: { bodyParser: { sizeLimit: '30mb' } } }
