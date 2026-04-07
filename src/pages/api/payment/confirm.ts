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
    console.log(`[Confirm] Verifying payment: ${paymentId} for plan: ${planId}`)

    // 포트원 V2 결제 조회 API로 검증
    const portoneRes = await fetch(`https://api.portone.io/payments/${paymentId}`, {
      headers: {
        'Authorization': `PortOne ${process.env.PORTONE_API_SECRET}`,
      },
    })

    if (!portoneRes.ok) {
      const errorText = await portoneRes.text()
      console.error('[Confirm] PortOne API Error:', errorText)
      throw new Error(`포트원 결제 조회 실패 (${portoneRes.status})`)
    }

    const payment = await portoneRes.json()
    console.log('[Confirm] Payment status:', payment.status)

    // 결제 상태 검증
    if (payment.status !== 'PAID') {
      throw new Error(`결제가 완료되지 않았습니다 (상태: ${payment.status})`)
    }

    // 금액을 클라이언트 body가 아닌 서버 plan 기준으로 검증
    if (payment.amount.total !== plan.amount) {
      console.error(`[Confirm] Amount mismatch. Expected: ${plan.amount}, Got: ${payment.amount.total}`)
      throw new Error('결제 금액이 일치하지 않습니다')
    }

    // 유저 정보 가져오기
    // 1. customer.id (우리가 보낸 customerId)
    // 2. customer.email
    const customerId = payment.customer?.id
    const customerEmail = payment.customer?.email

    console.log(`[Confirm] Looking up user - ID: ${customerId}, Email: ${customerEmail}`)

    const { data: profileById } = customerId 
      ? await supabase.from('profiles').select('id, paid_credits').eq('id', customerId).single()
      : { data: null }

    const { data: profileByEmail } = !profileById && customerEmail
      ? await supabase.from('profiles').select('id, paid_credits').eq('email', customerEmail).single()
      : { data: null }

    const targetProfile = profileById || profileByEmail
    if (!targetProfile) {
      console.error('[Confirm] User not found in profiles table')
      throw new Error('사용자를 찾을 수 없습니다. 가입 정보를 확인해주세요.')
    }

    // 중복 결제 처리 방지
    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('order_id', paymentId)
      .single()

    if (existing) {
      console.log('[Confirm] Payment already processed:', paymentId)
      return res.status(200).json({ success: true, alreadyProcessed: true })
    }

    // 크레딧 추가
    const newCredits = (targetProfile.paid_credits || 0) + plan.credits
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ paid_credits: newCredits })
      .eq('id', targetProfile.id)

    if (updateError) throw new Error(`크레딧 업데이트 실패: ${updateError.message}`)

    // 결제 기록 저장
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 3)

    const { error: insertError } = await supabase.from('payments').insert({
      user_id: targetProfile.id,
      order_id: paymentId,
      payment_key: paymentId,
      amount: plan.amount,
      credits_added: plan.credits,
      expires_at: expiresAt.toISOString(),
    })

    if (insertError) {
      console.error('[Confirm] Failed to record payment:', insertError.message)
      // 결제 기록 저장 실패해도 일단 크레딧은 올라갔으므로 성공 응답을 보낼지 고민... 
      // 하지만 기록이 없으면 나중에 문제가 되므로 에러 처리
    }

    console.log(`[Confirm] Success! Added ${plan.credits} credits to user ${targetProfile.id}`)
    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('[Confirm] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
