import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import type { Session } from '@supabase/supabase-js'
import { isAdmin } from '../lib/admin'

interface Props { session: Session | null }

interface Profile {
  id: string
  email: string
  free_credits: number
  paid_credits: number
  created_at: string
}

interface Payment {
  user_id: string
  amount: number
  credits_added: number
  created_at: string
  order_id: string
}

export default function AdminPage({ session }: Props) {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const [creditInput, setCreditInput] = useState<{ [id: string]: { free: string; paid: string } }>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    // session prop이 undefined → null로 확정될 때까지 잠깐 대기
    const timer = setTimeout(() => setSessionReady(true), 500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!sessionReady) return
    if (!session) { router.push('/login'); return }
    if (!isAdmin(session.user.email)) { router.push('/'); return }
    fetchData()
  }, [session, sessionReady])

  async function fetchData() {
    setLoading(true)
    const res = await fetch('/api/admin/data', {
      headers: { 'Authorization': `Bearer ${session?.access_token}` },
    })
    const data = await res.json()
    setProfiles(data.profiles || [])
    setPayments(data.payments || [])
    setLoading(false)
  }

  async function updateCredits(userId: string) {
    const input = creditInput[userId]
    if (!input) return
    setSaving(userId)
    const freeDelta = parseInt(input.free || '0')
    const paidDelta = parseInt(input.paid || '0')
    const res = await fetch('/api/admin/credits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ targetUserId: userId, freeDelta, paidDelta }),
    })
    const data = await res.json()
    if (res.ok) {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, free_credits: data.free_credits, paid_credits: data.paid_credits } : p))
      setCreditInput(prev => ({ ...prev, [userId]: { free: '', paid: '' } }))
    }
    setSaving(null)
  }

  // 월별 매출 집계
  const monthlyRevenue: { [month: string]: number } = {}
  payments.forEach(p => {
    const month = p.created_at?.slice(0, 7) || ''
    monthlyRevenue[month] = (monthlyRevenue[month] || 0) + p.amount
  })
  const sortedMonths = Object.keys(monthlyRevenue).sort().reverse()

  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisMonthRevenue = monthlyRevenue[thisMonth] || 0
  const thisMonthCount = payments.filter(p => p.created_at?.startsWith(thisMonth)).length
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)

  const filteredProfiles = profiles.filter(p => p.email?.includes(search))

  const emailMap: { [id: string]: string } = {}
  profiles.forEach(p => { emailMap[p.id] = p.email })

  if (loading) return <div style={{ padding: 80, textAlign: 'center', color: '#888' }}>로딩 중...</div>

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 32px 60px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>관리자 페이지</h1>
        <p style={{ color: '#888', marginBottom: 40 }}>유저 크레딧 관리 및 매출 현황</p>

        {/* 요약 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 48 }}>
          {[
            { label: '이번 달 매출', value: `₩${thisMonthRevenue.toLocaleString()}` },
            { label: '이번 달 결제 건수', value: `${thisMonthCount}건` },
            { label: '누적 총 매출', value: `₩${totalRevenue.toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'white', border: '2px solid var(--dark)', borderRadius: 16, padding: '28px 32px', boxShadow: '4px 4px 0 var(--accent)' }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 8, fontFamily: 'Space Mono, monospace', letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* 월별 매출 */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>월별 매출</h2>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f5f4f0', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 700 }}>월</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>결제 건수</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>매출</th>
                </tr>
              </thead>
              <tbody>
                {sortedMonths.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>결제 내역 없음</td></tr>
                )}
                {sortedMonths.map(month => (
                  <tr key={month} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 20px' }}>{month}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>{payments.filter(p => p.created_at?.startsWith(month)).length}건</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>₩{monthlyRevenue[month].toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 결제 내역 */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>결제 내역</h2>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f5f4f0', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 700 }}>이메일</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 700 }}>결제일</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 700 }}>만료일</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>금액</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>크레딧</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>결제 내역 없음</td></tr>
                )}
                {payments.map((p, i) => {
                  const expiresAt = p.created_at
                    ? (() => { const d = new Date(p.created_at); d.setMonth(d.getMonth() + 3); return d.toISOString().slice(0, 10) })()
                    : '-'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 20px', color: '#555' }}>{emailMap[p.user_id] || p.user_id}</td>
                      <td style={{ padding: '12px 20px', color: '#888' }}>{p.created_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td style={{ padding: '12px 20px', color: '#e67e22', fontWeight: 700 }}>{expiresAt}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>₩{p.amount.toLocaleString()}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', color: 'var(--accent)', fontWeight: 700 }}>+{p.credits_added}장</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 유저 목록 */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>유저 목록 ({profiles.length}명)</h2>
            <input
              placeholder="이메일 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', width: 220 }}
            />
          </div>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f5f4f0', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 700 }}>이메일</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 700 }}>가입일</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>무료</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>유료</th>
                  <th style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 700 }}>크레딧 조정</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>유저 없음</td></tr>
                )}
                {filteredProfiles.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 20px', color: '#333' }}>{p.email}</td>
                    <td style={{ padding: '12px 20px', color: '#888', fontSize: 12 }}>{p.created_at?.slice(0, 10)}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>{p.free_credits}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{p.paid_credits}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                        <input
                          type="number"
                          placeholder="무료±"
                          value={creditInput[p.id]?.free || ''}
                          onChange={e => setCreditInput(prev => ({ ...prev, [p.id]: { ...prev[p.id], free: e.target.value } }))}
                          style={{ width: 64, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, textAlign: 'center' }}
                        />
                        <input
                          type="number"
                          placeholder="유료±"
                          value={creditInput[p.id]?.paid || ''}
                          onChange={e => setCreditInput(prev => ({ ...prev, [p.id]: { ...prev[p.id], paid: e.target.value } }))}
                          style={{ width: 64, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, textAlign: 'center' }}
                        />
                        <button
                          onClick={() => updateCredits(p.id)}
                          disabled={saving === p.id}
                          style={{ padding: '4px 14px', background: 'var(--dark)', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                        >
                          {saving === p.id ? '...' : '적용'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
