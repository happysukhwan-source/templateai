import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import type { Session } from '@supabase/supabase-js'

interface Props { session: Session | null }

export default function PaymentSuccess({ session }: Props) {
  const router = useRouter()
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const { planId, credits, orderId } = router.query
    // 쿼리가 아직 준비 안됐으면 대기
    if (!router.isReady) return
    // 포트원은 이미 confirm.ts에서 검증 완료했으므로 바로 성공 처리
    if (planId && credits) {
      setDone(true)
    } else {
      setError('결제 정보를 확인할 수 없습니다.')
    }
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
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <p style={{ color: '#666' }}>결제 확인 중...</p>
          </>
        )}
      </div>
    </div>
  )
}
