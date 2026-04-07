import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '../../../lib/admin'
import { getAuthUser } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: '인증이 필요합니다.' })
  if (!isAdmin(user.email)) return res.status(403).json({ error: '접근 권한이 없습니다.' })

  const { orderId } = req.body
  if (!orderId) return res.status(400).json({ error: 'orderId가 필요합니다.' })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 결제 기록 조회
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single()

  if (!payment) return res.status(404).json({ error: '결제 기록을 찾을 수 없습니다.' })

  // PortOne V2 취소 API 호출
  const cancelRes = await fetch(`https://api.portone.io/payments/${orderId}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `PortOne ${process.env.PORTONE_API_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: '관리자 취소' }),
  })

  if (!cancelRes.ok) {
    const err = await cancelRes.text()
    console.error('[Cancel] PortOne error:', err)
    return res.status(500).json({ error: `PortOne 취소 실패: ${err}` })
  }

  // 크레딧 차감
  const { data: profile } = await supabase
    .from('profiles')
    .select('paid_credits')
    .eq('id', payment.user_id)
    .single()

  if (profile) {
    const newPaid = Math.max(0, (profile.paid_credits || 0) - payment.credits_added)
    await supabase.from('profiles').update({ paid_credits: newPaid }).eq('id', payment.user_id)
  }

  // 결제 기록 삭제
  await supabase.from('payments').delete().eq('order_id', orderId)

  return res.status(200).json({ success: true })
}
