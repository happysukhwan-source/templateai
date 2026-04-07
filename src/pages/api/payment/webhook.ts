import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

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

  const { paymentId, status } = req.body

  if (status !== 'PAID') {
    return res.status(200).send('OK') // 결제 완료가 아닌 경우는 무시
  }

  try {
    console.log(`[Webhook] Processing payment: ${paymentId}`)

    // 1. 중복 처리 방지
    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('order_id', paymentId)
      .single()

    if (existing) {
      console.log('[Webhook] Already processed:', paymentId)
      return res.status(200).send('OK')
    }

    // 2. 포트원 API로 실제 결제 상태 재확인
    const portoneRes = await fetch(`https://api.portone.io/payments/${paymentId}`, {
      headers: {
        'Authorization': `PortOne ${process.env.PORTONE_API_SECRET}`,
      },
    })

    if (!portoneRes.ok) throw new Error('PortOne API fetch failed')
    const payment = await portoneRes.json()

    if (payment.status !== 'PAID') {
      console.log('[Webhook] Payment not PAID in PortOne:', payment.status)
      return res.status(200).send('OK')
    }

    // 3. 플랜 정보 추출 (paymentId: {planId}_{timestamp})
    const planId = paymentId.split('_')[0]
    const plan = PLAN_MAP[planId]
    if (!plan) throw new Error(`Unknown plan: ${planId}`)

    // 4. 유저 확인
    const customerId = payment.customer?.id
    const customerEmail = payment.customer?.email
    
    const { data: profileById } = customerId 
      ? await supabase.from('profiles').select('id, paid_credits').eq('id', customerId).single()
      : { data: null }

    const { data: profileByEmail } = !profileById && customerEmail
      ? await supabase.from('profiles').select('id, paid_credits').eq('email', customerEmail).single()
      : { data: null }

    const targetProfile = profileById || profileByEmail
    if (!targetProfile) throw new Error('User not found')

    // 5. 크레딧 지급 및 기록
    const newCredits = (targetProfile.paid_credits || 0) + plan.credits
    await supabase.from('profiles').update({ paid_credits: newCredits }).eq('id', targetProfile.id)

    await supabase.from('payments').insert({
      user_id: targetProfile.id,
      order_id: paymentId,
      payment_key: paymentId,
      amount: plan.amount,
      credits_added: plan.credits,
    })

    console.log(`[Webhook] Success! Added ${plan.credits} credits to ${targetProfile.id}`)
    return res.status(200).send('OK')

  } catch (err: any) {
    console.error('[Webhook] Error:', err.message)
    // 웹훅 실패 시 포트원이 재시도할 수 있도록 500 에러 반환
    return res.status(500).json({ error: err.message })
  }
}
