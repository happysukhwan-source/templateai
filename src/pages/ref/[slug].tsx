import type { GetServerSideProps } from 'next'
import { createClient } from '@supabase/supabase-js'

// 이 페이지는 렌더링 없이 서버에서 즉시 리다이렉트
export default function RefPage() { return null }

export const getServerSideProps: GetServerSideProps = async ({ params, res }) => {
  const slug = params?.slug as string

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: influencer } = await supabase
    .from('influencers')
    .select('id')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (influencer) {
    // 30일 쿠키 설정
    res.setHeader('Set-Cookie', `ref_id=${influencer.id}; Path=/; Max-Age=2592000; SameSite=Lax`)
  }

  return {
    redirect: { destination: '/', permanent: false },
  }
}
