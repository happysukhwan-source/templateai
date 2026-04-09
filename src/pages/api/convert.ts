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

  const { imageData, fileName, cropY1, cropY2, sectionNum, totalSections, originalHeight: clientHeight, originalWidth: clientWidth } = req.body
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
    const activeWidth = clientWidth || width
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
    // [수정] 텍스트 구조를 파괴하지 않도록 removeTspan을 제거하고 정규화 로직만 적용
    svg = normalizePlaceholders(await convertToSvg(finalBase64, 'image/png', sectionNum || 1, totalSections || 1, activeHeight, activeWidth))
    
    // [Fail-safe] AI가 혹시 가로/세로를 틀리게 줬을 경우를 대비해 루트 <svg> 태그 강제 수정
    svg = svg.replace(/<svg\b([^>]*)>/i, (match, attrs) => {
      // 기존 width, height, viewBox 속성 제거 후 강제 삽입
      const cleanAttrs = attrs.replace(/\b(width|height|viewBox)=["'][^"']*["']/g, '').trim()
      return `<svg ${cleanAttrs} width="${activeWidth}" height="${activeHeight}" viewBox="0 0 ${activeWidth} ${activeHeight}">`
    })
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

function normalizePlaceholders(svg: string): string {
  interface TextEl {
    full: string; attrs: string; content: string
    index: number; end: number
    x: number; y: number; fontSize: number; fill: string; fontWeight: string
    actualLines: number; // 내부적으로 이미 몇 줄인지 계산
  }
  
  // <text> 태그를 찾되 내부 태그(tspan 등)를 포함하도록 [\s\S]*? 사용
  const textRegex = /<text([^>]*)>([\s\S]*?)<\/text>/g
  const elements: TextEl[] = []
  let m: RegExpExecArray | null
  while ((m = textRegex.exec(svg)) !== null) {
    const attrs = m[1]
    const inner = m[2].trim()
    if (!inner) continue
    
    const x = parseFloat(attrs.match(/x="([^"]+)"/)?.[1] || '0')
    const y = parseFloat(attrs.match(/y="([^"]+)"/)?.[1] || '0')
    const fontSize = parseFloat(attrs.match(/font-size="([^"]+)"/)?.[1] || '0')
    const fill = attrs.match(/fill="([^"]+)"/)?.[1] || ''
    const fontWeight = attrs.match(/font-weight="([^"]+)"/)?.[1] || 'normal'
    
    // 내부 tspan 개수 확인
    const tspanCount = (inner.match(/<tspan/g) || []).length
    const actualLines = Math.max(1, tspanCount)
    
    elements.push({ 
      full: m[0], attrs, content: inner, 
      index: m.index, end: m.index + m[0].length, 
      x, y, fontSize, fill, fontWeight, 
      actualLines 
    })
  }

  // 1. 같은 스타일의 인접한 줄 병합 로직
  const groups: TextEl[][] = []
  let currentGroup: TextEl[] = []
  for (const el of elements) {
    if (currentGroup.length === 0) { currentGroup.push(el); continue }
    const prev = currentGroup[currentGroup.length - 1]
    const between = svg.slice(prev.end, el.index)
    
    // 스타일이 같고 위아래 간격이 적절한지 판단
    // [수정] X좌표 편차 조건을 el.fontSize * 15 로 넓혀 '가운데 정렬' 및 '우측 정렬' 텍스트도 포괄하여 하나로 묶도록 개선
    const sameStyle = Math.abs(el.x - prev.x) <= el.fontSize * 15 && 
                      el.fontSize === prev.fontSize && 
                      el.fill === prev.fill && el.fontWeight === prev.fontWeight && 
                      el.y > prev.y && el.y - prev.y <= prev.fontSize * 3.5
    
    if (sameStyle && !/[<>]/.test(between)) { 
      currentGroup.push(el) 
    } else { 
      groups.push([...currentGroup]); currentGroup = [el] 
    }
  }
  if (currentGroup.length > 0) groups.push([...currentGroup])

  const replacements: { start: number; end: number; replacement: string }[] = []
  for (const group of groups) {
    const first = group[0];
    const totalLines = group.reduce((sum, el) => sum + el.actualLines, 0);

    // 총 줄 수에 맞는 플레이스홀더 문구 결정
    const placeholder = totalLines === 1 ? "텍스트 한줄입력" : 
                        totalLines === 2 ? "텍스트 두줄입력" : 
                        totalLines === 3 ? "텍스트 세줄입력" : 
                        `텍스트 ${totalLines}줄입력`;
    
    // 버튼 예외 처리 (수동 보존)
    if (totalLines === 1 && (first.content.includes("버튼") || (first.content.length <= 4 && !first.content.includes("줄입력")))) {
      continue;
    }

    // 사용자 요청: 줄 수만 파악되면 굳이 여러 줄의 시각적 프레임을 생성하지 않고,
    // "텍스트 n줄입력" 문구를 딱 한 번만 표시하여 단일 텍스트 프레임으로 구성합니다.
    replacements.push({ 
      start: first.index, 
      end: group[group.length - 1].end, 
      replacement: `<text${first.attrs}>${placeholder}</text>` 
    })
  }

  replacements.sort((a, b) => b.start - a.start)
  let result = svg
  for (const { start, end, replacement } of replacements) { 
    result = result.slice(0, start) + replacement + result.slice(end) 
  }
  return result
}

// removeTspan 함수는 더 이상 사용하지 않으므로 삭제하거나 내용을 비워둡니다.
function removeTspan(svg: string): string {
  return svg;
}

async function convertToSvg(base64: string, mimeType: string, sectionNum: number, totalSections: number, activeHeight: number, activeWidth: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY가 누락되었습니다.');
  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  
  const sectionInfo = totalSections > 1 ? ` (섹션 ${sectionNum}/${totalSections})` : '';
  const promptText = `당신은 이미지의 레이아웃을 1:1 비율로 정밀 분석하여 'Figma UI 템플릿'을 제작하는 전문가입니다.
원본의 모든 요소(이미지, 텍스트, 버튼)를 감지하여 동일한 좌표와 크기의 SVG 코드를 생성하세요.

### 📐 1. 기본 설정 및 섹션 그룹화
- **전체 배경 금지**: 이미지 전체를 덮는 <rect width="100%" height="100%" />를 절대 생성하지 마세요.
- **섹션 분할 (Sectioning)**: 이미지를 논리적인 섹션(상단 배너, 상세 설명, 리뷰 영역 등) 단위로 분석하세요.
- **그룹 기반 구조**: 각 섹션마다 반드시 <g> 태그를 사용하여 그룹화하고, 적절한 ID(예: id="block_1")를 부여하세요.
- **개별 섹션 배경**: 각 그룹(<g>)의 가장 첫 번째 요소로, 해당 섹션의 영역을 채우는 <rect fill="#ffffff" /> (또는 원본의 배경색)를 반드시 생성하세요. 이는 피그마에서 각 섹션을 개별 프레임처럼 클릭하고 배경색을 바꾸기 위함입니다.
- 전체 크기: 가로 **${activeWidth}px**, 세로 **${activeHeight}px**

### 🖼️ 2. 이미지/아이콘 영역 처리
- 모든 사진, 이미지, 아이콘 자리는 **연한 회색 단색 박스**로 교체하세요.
- **스타일**: <rect fill="#f2f2f2" stroke="#e0e0e0" stroke-width="1" />
- 원형 이미지는 <circle fill="#f2f2f2" stroke="#e0e0e0" stroke-width="1" />로 표현하세요.

### 📋 3. 텍스트 가이드 (치환)
- 모든 텍스트는 원본 위치 그대로 배치하되, **원본의 줄 수(Line Count)를 반드시 100% 동일하게 유지**하세요.
- **줄 수에 따른 문구 규칙**을 엄격히 준수하세요:
  - 원본 1줄 -> "텍스트 한줄입력" (반드시 1줄로 생성)
  - 원본 2줄 -> 각 줄에 "텍스트 두줄입력" (총 2줄 생성)
  - 원본 3줄 -> 각 줄에 "텍스트 세줄입력" (총 3줄 생성)
  - 원본 n줄 -> 각 줄에 "텍스트 n줄입력" (n은 해당 블록의 총 줄 수)
- **중요**: 텍스트 길이를 맞추기 위해 같은 문구를 한 줄에 여러 번 반복(예: "텍스트 입력 텍스트 입력")하는 행위를 **절대 금지**합니다. 한 줄에는 문구를 딱 한 번만 사용하세요.
- 여러 줄의 텍스트인 경우, 피그마에서 **단일 텍스트 상자(Single Text Node)**로 임포트될 수 있도록 개별 <text>로 쪼개지 마십시오. 반드시 최상위 <text> 1개 안에 여러 개의 <tspan x="..." dy="...">을 사용하여 하나로 묶어 제출하세요.
- 버튼 내 텍스트: "버튼"

### 🚀 4. 출력 규칙
- 오직 <svg> 코드만 출력하세요. 설명은 생략합니다.
- 모든 요소는 피그마에서 수정하기 좋게 그룹(<g>)화 하세요.`;

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
