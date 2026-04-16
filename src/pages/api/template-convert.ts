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

    const freeCredits = profile?.free_credits || 0
    let paidCredits = profile?.paid_credits || 0

    // 만료된 유료 크레딧 처리
    if (!isUserAdmin && paidCredits > 0) {
      const now = new Date().toISOString()
      const { data: expiredPayments } = await supabase
        .from('payments')
        .select('credits_added')
        .eq('user_id', user.id)
        .lt('expires_at', now)

      if (expiredPayments && expiredPayments.length > 0) {
        const expiredCredits = expiredPayments.reduce((sum: number, p: any) => sum + p.credits_added, 0)
        const deductExpired = Math.min(paidCredits, expiredCredits)
        if (deductExpired > 0) {
          paidCredits = paidCredits - deductExpired
          await supabase.from('profiles').update({ paid_credits: paidCredits }).eq('id', user.id)
          await supabase.from('payments').delete().eq('user_id', user.id).lt('expires_at', now)
        }
      }
    }

    const totalCredits = freeCredits + paidCredits
    
    if (!isUserAdmin && totalCredits < requiredCredits) {
      return res.status(400).json({ error: `크레딧이 부족해요. (보유: ${totalCredits}, 필요: ${requiredCredits})` })
    }

    let usedFreeCount = 0
    let usedPaidCount = 0

    if (!isUserAdmin) {
      let remaining = requiredCredits
      const free = freeCredits
      const deductFree = Math.min(free, remaining)
      if (deductFree > 0) {
        await supabase.from('profiles').update({ free_credits: free - deductFree }).eq('id', user.id)
        usedFreeCount = deductFree
        remaining -= deductFree
      }
      if (remaining > 0) {
        const paid = paidCredits
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

### 📋 텍스트 강제 치환 (원본 텍스트 100% 무시)
모든 텍스트를 분석하여 아래 지침에 따라 **무조건** 교체하세요. 원본 단어 사용 금지.
- **줄 수 보존**: 원본 이미지의 텍스트 줄 수(Line Count)를 100% 동일하게 유지하세요.
- **줄 수별 문구 매칭**:
  - 1줄: "텍스트 한줄입력" (반드시 1줄로 생성)
  - 2줄: 각 줄에 "텍스트 두줄입력" (총 2줄 생성)
  - 3줄: 각 줄에 "텍스트 세줄입력" (총 3줄 생성)
  - n줄: 각 줄에 "텍스트 n줄입력" (n은 해당 블록의 총 줄 수)
- **반복 금지**: 한 줄에 같은 문구를 여러 번 반복해서 채우지 마세요. 문구는 한 줄에 딱 한 번만 사용합니다.

### 📋 그리기 규칙 및 구조
- **전체 배경 금지**: 이미지 전체를 덮는 <rect width="100%" height="100%" />를 절대 생성하지 마세요.
- **섹션 분할 (Sectioning)**: 이미지를 논리적인 섹션 단위로 분석하여 그룹화하세요.
- **그룹 기반 구조**: 각 섹션마다 반드시 <g> 태그를 사용하고 고유 ID를 부여하세요.
- **개별 섹션 배경**: 각 그룹(<g>) 내부 최하단에 해당 섹션 영역을 채우는 배경 <rect fill="#ffffff" />를 반드시 생성하세요. 이는 피그마에서 섹션별 편집을 용이하게 합니다.
- **이미지 영역**: 사진 자리는 깨끗한 회색 박스(<rect fill="#ddd"/>) 또는 체크무늬 패턴으로 만드세요.
- **도형 중심**: 모든 요소는 피그마에서 수정 가능하도록 <rect>, <text> 위주로 구성하세요. <path> 사용 금지.
- **멀티라인 단일 프레임 처리**: 여러 줄의 텍스트 레이어인 경우, 피그마에서 하나의 텍스트 상자로 임포트될 수 있도록 최상위 <text> 1개 안에 여러 개의 <tspan>을 사용하여 하나로 묶으세요.
- **스타일 속성(fill, font-size, font-weight 등)**은 쪼개진 <tspan>이 아닌 **최상위 <text> 태그에 한 번만 작성**하여 모든 텍스트의 색상과 스타일이 일관되게 보존되도록 하세요.
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
