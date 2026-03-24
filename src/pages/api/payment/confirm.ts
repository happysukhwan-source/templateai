import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

// 서버에서 planId → credits/amount 매핑 (클라이언트 값 신뢰 안 함)
const PLAN_MAP: Record<string, { credits: number; amount: number }> = {
  pack_10:  { credits: 10,  amount: 6000 },
  pack_30:  { credits: 30,  amount: 12000 },
  pack_100: { credits: 100, amount: 30000 },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { paymentId, planId } = req.body

  // planId로 서버에서 직접 크레딧/금액 결정
  const plan = PLAN_MAP[planId]
  if (!plan) return res.status(400).json({ error: '유효하지 않은 플랜입니다.' })

  try {
    // 포트원 V2 결제 조회 API로 검증
    const portoneRes = await fetch(`https://api.portone.io/payments/${paymentId}`, {
      headers: {
        'Authorization': `PortOne ${process.env.PORTONE_API_SECRET}`,
      },
    })

    if (!portoneRes.ok) {
      throw new Error('포트원 결제 조회 실패')
    }

    const payment = await portoneRes.json()

    // 결제 상태 검증
    if (payment.status !== 'PAID') {
      throw new Error('결제가 완료되지 않았습니다')
    }

    // 금액을 클라이언트 body가 아닌 서버 plan 기준으로 검증
    if (payment.amount.total !== plan.amount) {
      throw new Error('결제 금액이 일치하지 않습니다')
    }

    // 유저 정보 가져오기 (포트원 결제 데이터 기반)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, paid_credits')
      .eq('id', payment.customer?.id || '')
      .single()

    const { data: userByEmail } = await supabase
      .from('profiles')
      .select('id, paid_credits')
      .eq('email', payment.customer?.email || '')
      .single()

    const targetProfile = profile || userByEmail
    if (!targetProfile) throw new Error('사용자를 찾을 수 없습니다')

    // 중복 결제 처리 방지
    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('order_id', paymentId)
      .single()

    if (existing) {
      return res.status(200).json({ success: true })
    }

    // 크레딧 추가 (서버에서 계산한 plan.credits 사용)
    const newCredits = (targetProfile.paid_credits || 0) + plan.credits
    await supabase
      .from('profiles')
      .update({ paid_credits: newCredits })
      .eq('id', targetProfile.id)

    // 결제 기록 저장
    await supabase.from('payments').insert({
      user_id: targetProfile.id,
      order_id: paymentId,
      payment_key: paymentId,
      amount: plan.amount,
      credits_added: plan.credits,
    })

    return res.status(200).json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
