import Link from 'next/link'

export default function PaymentFail() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>😢</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>결제가 취소됐어요</h2>
        <p style={{ color: '#666', marginBottom: 24 }}>다시 시도하거나 다른 결제 수단을 이용해주세요.</p>
        <Link href="/pricing" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>다시 시도하기 →</Link>
      </div>
    </div>
  )
}
