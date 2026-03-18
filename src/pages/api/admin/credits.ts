import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '../../../lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { userEmail, targetUserId, freeDelta, paidDelta } = req.body
  if (!isAdmin(userEmail)) return res.status(403).json({ error: '접근 권한이 없습니다.' })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('free_credits, paid_credits')
    .eq('id', targetUserId)
    .single()

  if (!profile) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' })

  const newFree = Math.max(0, (profile.free_credits || 0) + (freeDelta || 0))
  const newPaid = Math.max(0, (profile.paid_credits || 0) + (paidDelta || 0))

  const { error } = await supabase
    .from('profiles')
    .update({ free_credits: newFree, paid_credits: newPaid })
    .eq('id', targetUserId)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ free_credits: newFree, paid_credits: newPaid })
}
