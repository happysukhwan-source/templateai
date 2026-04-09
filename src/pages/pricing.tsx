import Head from 'next/head'
import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import type { Session } from '@supabase/supabase-js'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

interface Props { session: Session | null }

const PLANS = [
  { id: 'pack_10', name: '10장 팩', price: 6000, credits: 10, perUnit: 600, badge: '' },
  { id: 'pack_30', name: '30장 팩', price: 12000, credits: 30, perUnit: 400, badge: '인기' },
  { id: 'pack_100', name: '100장 팩', price: 30000, credits: 100, perUnit: 300, badge: '최대 할인' },
]

export default function PricingPage({ session }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')

  useEffect(() => {
    if (!session) return
    supabase
      .from('profiles')
      .select('name, phone')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data?.name) setProfileName(data.name)
        if (data?.phone) setProfilePhone(data.phone)
      })
  }, [session])

  async function handlePayment(plan: typeof PLANS[0]) {
    if (!session) { window.location.href = '/signup'; return }
    setLoading(plan.id)
    try {
      const PortOne = await import('@portone/browser-sdk/v2')
      const orderId = `${plan.id}_${Date.now()}`

      const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId: orderId,
        orderName: `templateAI ${plan.name}`,
        totalAmount: plan.price,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        customer: {
          customerId: session.user.id,
          fullName: profileName,
          email: session.user.email,
          phoneNumber: profilePhone,
        },
        redirectUrl: `${window.location.origin}/payment/success?planId=${plan.id}&credits=${plan.credits}&orderId=${orderId}`,
      })

      if (response?.code) {
        console.error('결제 실패:', response.message)
        alert(`결제 실패: ${response.message}`)
      } else {
        const verifyRes = await fetch('/api/payment/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: orderId, planId: plan.id }),
        })
        const verifyData = await verifyRes.json()
        if (verifyData.success) {
          window.location.href = `/payment/success?planId=${plan.id}&credits=${plan.credits}`
        } else {
          alert('결제 검증 실패. 고객센터에 문의하세요.')
        }
      }
    } catch (err) {
      console.error(err)
      alert('결제 중 오류가 발생했습니다.')
    }
    setLoading(null)
  }

  return (
    <>
      <Head>
        <title>요금제 | templateAI - 상세페이지 피그마 템플릿 변환</title>
        <meta name="description" content="templateAI 상세페이지 피그마 템플릿 변환 요금제. 건당 300~600원, 가입 시 5장 무료 제공. 상세페이지템플릿을 저렴하게 만들어보세요." />
        <meta name="keywords" content="상세페이지템플릿 가격, 피그마템플릿 요금, 상세페이지 제작 비용, templateAI 요금제" />
        <link rel="canonical" href="https://www.templateai.shop/pricing" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.templateai.shop/pricing" />
        <meta property="og:title" content="요금제 | templateAI - 상세페이지 피그마 템플릿 변환" />
        <meta property="og:description" content="건당 300~600원, 가입 시 5장 무료. 상세페이지 이미지를 피그마 템플릿으로 변환하는 가장 저렴한 방법." />
        <meta property="og:site_name" content="templateAI" />
        <meta property="og:locale" content="ko_KR" />
      </Head>
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '100px 24px 60px', textAlign: 'center' }}>

        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: 3, color: 'var(--accent)', fontWeight: 700, marginBottom: 16 }}>PRICING</div>
        <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: -2, marginBottom: 12 }}>심플한 가격</h1>
        <p style={{ color: '#666', marginBottom: 56 }}>필요한 만큼만, 부담 없이 시작하세요</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 48 }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{
              background: plan.badge === '인기' ? 'var(--dark)' : 'white',
              color: plan.badge === '인기' ? 'white' : 'var(--dark)',
              borderRadius: 20, padding: '36px 28px',
              border: plan.badge === '인기' ? 'none' : '1.5px solid var(--border)',
              position: 'relative',
              boxShadow: plan.badge === '인기' ? '8px 8px 0 var(--accent)' : 'none',
            }}>
              {plan.badge && (
                <div style={{
                  position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--accent)', color: 'white',
                  fontSize: 11, fontWeight: 700, padding: '5px 16px', borderRadius: 100,
                  letterSpacing: 1, whiteSpace: 'nowrap'
                }}>{plan.badge}</div>
              )}
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: 2, color: plan.badge === '인기' ? '#888' : '#999', marginBottom: 16 }}>{plan.name.toUpperCase()}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 40, fontWeight: 700, letterSpacing: -2, marginBottom: 4 }}>
                ₩{plan.price.toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: plan.badge === '인기' ? '#888' : '#999', marginBottom: 28 }}>
                {plan.credits}장 · 장당 ₩{plan.perUnit.toLocaleString()}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 28, textAlign: 'left' }}>
                {[`이용권 ${plan.credits}장`, '피그마 SVG 출력', '분할 변환 지원', '유효기간 3개월'].map((f, i) => (
                  <li key={i} style={{ fontSize: 14, padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8, color: plan.badge === '인기' ? '#ccc' : '#555', borderBottom: i < 3 ? '1px solid #f0f0f0' : 'none' }}>
                    <span style={{ color: '#22c55e', fontSize: 12 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handlePayment(plan)}
                disabled={loading === plan.id}
                style={{
                  width: '100%', padding: '14px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                  cursor: 'pointer', border: plan.badge === '인기' ? 'none' : '2px solid var(--dark)',
                  background: plan.badge === '인기' ? 'var(--accent)' : 'transparent',
                  color: plan.badge === '인기' ? 'white' : 'var(--dark)',
                  fontFamily: 'inherit', transition: 'all 0.2s',
                }}
              >
                {loading === plan.id ? '처리 중...' : session ? '결제하기 →' : '가입 후 결제 →'}
              </button>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff0ec', border: '1.5px solid #ffc4b3', borderRadius: 14, padding: '20px 28px', display: 'inline-block' }}>
          <p style={{ fontSize: 14, color: '#cc3a00' }}>
            🎁 <strong>회원가입하면 무료 5장 즉시 지급!</strong> 결제 없이 먼저 체험해보세요.
          </p>
          {!session && (
            <Link href="/signup" style={{ display: 'inline-block', marginTop: 10, fontSize: 13, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>
              무료로 시작하기 →
            </Link>
          )}
        </div>

        <p style={{ marginTop: 32, fontSize: 12, color: '#bbb' }}>
          💳 결제는 포트원 · KG이니시스를 통해 안전하게 처리됩니다
        </p>
      </div>
    </div>
    </>
  )
}
