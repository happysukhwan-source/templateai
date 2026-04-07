import { useState } from 'react'
import Navbar from '../components/Navbar'
import type { Session } from '@supabase/supabase-js'
import Link from 'next/link'

interface Props { session: Session | null }

const PLANS = [
  { id: 'pack_10', name: '10장 팩', price: 6000, credits: 10, perUnit: 600, badge: '' },
  { id: 'pack_30', name: '30장 팩', price: 12000, credits: 30, perUnit: 400, badge: '인기' },
  { id: 'pack_100', name: '100장 팩', price: 30000, credits: 100, perUnit: 300, badge: '최대 할인' },
]

export default function PricingPage({ session }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [pendingPlan, setPendingPlan] = useState<typeof PLANS[0] | null>(null)
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')

  function openPhoneModal(plan: typeof PLANS[0]) {
    if (!session) { window.location.href = '/signup'; return }
    setPhone('')
    setPhoneError('')
    setPendingPlan(plan)
  }

  async function confirmPayment() {
    const phoneClean = phone.replace(/[^0-9]/g, '')
    if (phoneClean.length < 10) {
      setPhoneError('올바른 휴대폰 번호를 입력해주세요.')
      return
    }
    if (!pendingPlan) return

    const plan = pendingPlan
    setPendingPlan(null)
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
          customerId: session!.user.id,
          email: session!.user.email,
          phoneNumber: phoneClean,
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
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />

      {/* 휴대폰 번호 입력 모달 */}
      {pendingPlan && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: 20, padding: '40px 36px', width: 360,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>휴대폰 번호 입력</h3>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
              KG이니시스 결제에 필요합니다.
            </p>
            <input
              type="tel"
              placeholder="01012345678"
              value={phone}
              onChange={e => { setPhone(e.target.value); setPhoneError('') }}
              onKeyDown={e => e.key === 'Enter' && confirmPayment()}
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 16,
                border: `1.5px solid ${phoneError ? '#ef4444' : 'var(--border)'}`,
                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
            {phoneError && (
              <p style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>{phoneError}</p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setPendingPlan(null)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                  border: '1.5px solid var(--border)', background: 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >취소</button>
              <button
                onClick={confirmPayment}
                style={{
                  flex: 2, padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                  border: 'none', background: 'var(--accent)', color: 'white',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >결제하기 →</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '100px 24px 60px', textAlign: 'center' }}>

        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: 3, color: 'var(--accent)', fontWeight: 700, marginBottom: 16 }}>PRICING</div>
        <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: -2, marginBottom: 12 }}>심플한 가격</h1>
        <p style={{ color: '#666', marginBottom: 56 }}>필요한 만큼만, 부담 없이 시작하세요</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 48 }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{
              background: plan.badge === '인기' ? 'var(--dark)' : 'white',
              color: plan.badge === '인기' ? 'white' : 'var(--dark)',
              borderRadius: 20,
              padding: '36px 28px',
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
                {[
                  `이용권 ${plan.credits}장`,
                  '피그마 SVG 출력',
                  '분할 변환 지원',
                  '유효기간 3개월',
                ].map((f, i) => (
                  <li key={i} style={{ fontSize: 14, padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8, color: plan.badge === '인기' ? '#ccc' : '#555', borderBottom: i < 3 ? '1px solid #f0f0f0' : 'none' }}>
                    <span style={{ color: '#22c55e', fontSize: 12 }}>✓</span>{f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => openPhoneModal(plan)}
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

        {/* 무료 안내 */}
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
  )
}
