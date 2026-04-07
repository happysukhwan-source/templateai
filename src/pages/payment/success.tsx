import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import type { Session } from '@supabase/supabase-js'

interface Props { session: Session | null }

export default function PaymentSuccess({ session }: Props) {
  const router = useRouter()
  const [verifying, setVerifying] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const { planId, credits, paymentId } = router.query
    if (!router.isReady) return

    async function confirm() {
      if (!paymentId || !planId) {
        if (planId && credits) { setDone(true); return }
        setError('결제 정보를 확인할 수 없습니다.')
        return
      }

      setVerifying(true)
      try {
        const res = await fetch('/api/payment/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId, planId }),
        })
        const data = await res.json()
        if (data.success) {
          setDone(true)
        } else {
          setError(data.error || '결제 검증에 실패했습니다.')
        }
      } catch (err) {
        setError('서버 통신 중 오류가 발생했습니다.')
      }
      setVerifying(false)
    }

    confirm()
  }, [router.isReady, router.query])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        {error ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 12 }}>결제 오류</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>{error}</p>
            <Link href="/pricing" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>다시 시도하기 →</Link>
          </>
        ) : done ? (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 12 }}>결제 완료!</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>크레딧이 충전됐어요. 바로 변환해보세요!</p>
            <Link href="/convert" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>변환하러 가기 →</Link>
          </>
        ) : verifying ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 12 }}>결제 확인 중</h2>
            <p style={{ color: '#666' }}>포트원에서 결제 정보를 확인하고 있습니다...</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <p style={{ color: '#666' }}>잠시만 기다려주세요...</p>
          </>
        )}
      </div>
    </div>
  )
}
