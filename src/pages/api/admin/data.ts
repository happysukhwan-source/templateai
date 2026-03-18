import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '../../../lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userEmail } = req.query
  if (!isAdmin(userEmail as string)) {
    return res.status(403).json({ error: '접근 권한이 없습니다.' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [profilesRes, paymentsRes] = await Promise.all([
    supabase.from('profiles').select('id, email, free_credits, paid_credits, created_at').order('created_at', { ascending: false }),
    supabase.from('payments').select('user_id, amount, credits_added, created_at, order_id').order('created_at', { ascending: false }),
  ])

  return res.status(200).json({
    profiles: profilesRes.data || [],
    payments: paymentsRes.data || [],
  })
}
