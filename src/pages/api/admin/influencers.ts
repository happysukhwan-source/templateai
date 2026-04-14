import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '../../../lib/admin'
import { createClient as createUserClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyAdmin(req: NextApiRequest): Promise<boolean> {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return false
  const userSupabase = createUserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await userSupabase.auth.getUser(token)
  return isAdmin(data.user?.email)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await verifyAdmin(req))) return res.status(403).json({ error: '권한 없음' })

  // GET: 인플루언서 목록 + 가입자 목록
  if (req.method === 'GET') {
    const [influencersRes, signupsRes] = await Promise.all([
      supabase
        .from('influencers')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, email, created_at, referred_by')
        .not('referred_by', 'is', null)
        .order('created_at', { ascending: false }),
    ])

    if (influencersRes.error) return res.status(500).json({ error: influencersRes.error.message })
    return res.status(200).json({
      influencers: influencersRes.data,
      signups: signupsRes.data || [],
    })
  }

  // POST: 인플루언서 추가
  if (req.method === 'POST') {
    const { name, slug, commission_rate, bonus_credits, discount_rate } = req.body
    if (!name || !slug) return res.status(400).json({ error: '이름과 슬러그는 필수입니다.' })

    const slugClean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '')

    const { data, error } = await supabase
      .from('influencers')
      .insert({
        name,
        slug: slugClean,
        code: slugClean,
        commission_rate: commission_rate || 10,
        bonus_credits: bonus_credits || 0,
        discount_rate: discount_rate || 0,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: '이미 사용 중인 슬러그 또는 코드입니다.' })
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ influencer: data })
  }

  // PATCH: 인플루언서 상태/필드 변경 또는 커미션 지급 완료 처리
  if (req.method === 'PATCH') {
    const { id, status, commissionId, bonus_credits, discount_rate } = req.body

    // 커미션 지급 완료
    if (commissionId) {
      const { error } = await supabase
        .from('commissions')
        .update({ status: 'paid' })
        .eq('id', commissionId)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    // 보너스/할인율 수정
    if (id && bonus_credits !== undefined && discount_rate !== undefined) {
      const { error } = await supabase
        .from('influencers')
        .update({ bonus_credits: Number(bonus_credits), discount_rate: Number(discount_rate) })
        .eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    // 인플루언서 상태 변경
    if (!id || !status) return res.status(400).json({ error: 'id, status 필수' })
    const { error } = await supabase
      .from('influencers')
      .update({ status })
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // DELETE: 인플루언서 삭제
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id 필수' })

    const { error } = await supabase.from('influencers').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).end()
}
