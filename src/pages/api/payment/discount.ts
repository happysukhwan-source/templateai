import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 로그인 유저의 첫 결제 할인 정보 반환
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(200).json({ discount: 0 })

  const { data: userData } = await supabase.auth.getUser(token)
  if (!userData.user) return res.status(200).json({ discount: 0 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('referred_by, referral_discount_used')
    .eq('id', userData.user.id)
    .single()

  if (!profile?.referred_by || profile.referral_discount_used) {
    return res.status(200).json({ discount: 0 })
  }

  const { data: influencer } = await supabase
    .from('influencers')
    .select('discount_rate')
    .eq('id', profile.referred_by)
    .eq('status', 'active')
    .single()

  return res.status(200).json({ discount_rate: influencer?.discount_rate || 0 })
}
