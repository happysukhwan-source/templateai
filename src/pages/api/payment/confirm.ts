import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { paymentId, planId, credits, amount } = req.body

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

    // 결제 상태 및 금액 검증
    if (payment.status !== 'PAID') {
      throw new Error('결제가 완료되지 않았습니다')
    }

    if (payment.amount.total !== Number(amount)) {
      throw new Error('결제 금액이 일치하지 않습니다')
    }

    // 유저 정보 가져오기 (이메일로 조회)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, paid_credits')
      .eq('id', payment.customer?.id || '')
      .single()

    // 이메일로 재조회
    const { data: userByEmail } = await supabase
      .from('profiles')
      .select('id, paid_credits')
      .eq('email', payment.customer?.email || '')
      .single()

    const targetProfile = profile || userByEmail
    if (!targetProfile) throw new Error('사용자를 찾을 수 없습니다')

    // 크레딧 추가
    const newCredits = (targetProfile.paid_credits || 0) + Number(credits)
    await supabase
      .from('profiles')
      .update({ paid_credits: newCredits })
      .eq('id', targetProfile.id)

    // 결제 기록 저장
    await supabase.from('payments').insert({
      user_id: targetProfile.id,
      order_id: paymentId,
      payment_key: paymentId,
      amount: Number(amount),
      credits_added: Number(credits),
    })

    return res.status(200).json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
