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
  expires_at: string | null
}

interface Influencer {
  id: string
  name: string
  slug: string
  code: string
  commission_rate: number
  bonus_credits: number
  discount_rate: number
  total_earned: number
  status: string
  created_at: string
}

interface Commission {
  id: string
  influencer_id: string
  order_amount: number
  commission_amount: number
  status: string
  created_at: string
  influencers: { name: string } | null
}

interface ReferralSignup {
  id: string
  email: string
  created_at: string
  referred_by: string
}

export default function AdminPage({ session }: Props) {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [referralSignups, setReferralSignups] = useState<ReferralSignup[]>([])
  const [signupFilter, setSignupFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const [creditInput, setCreditInput] = useState<{ [id: string]: { free: string; paid: string } }>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [newInfluencer, setNewInfluencer] = useState({ name: '', slug: '', commission_rate: '10', bonus_credits: '0', discount_rate: '0' })
  const [addingInfluencer, setAddingInfluencer] = useState(false)
  const [influencerError, setInfluencerError] = useState('')
  const [editingInf, setEditingInf] = useState<{ [id: string]: { bonus_credits: string; discount_rate: string } }>({})
  const [savingInf, setSavingInf] = useState<string | null>(null)
  const [commissionFilter, setCommissionFilter] = useState<string>('all')

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
    const [dataRes, influencerRes] = await Promise.all([
      fetch('/api/admin/data', { headers: { 'Authorization': `Bearer ${session?.access_token}` } }),
      fetch('/api/admin/influencers', { headers: { 'Authorization': `Bearer ${session?.access_token}` } }),
    ])
    const data = await dataRes.json()
    const influencerData = await influencerRes.json()
    setProfiles(data.profiles || [])
    setPayments(data.payments || [])
    setCommissions(data.commissions || [])
    setInfluencers(influencerData.influencers || [])
    setReferralSignups(influencerData.signups || [])
    setLoading(false)
  }

  async function addInfluencer() {
    if (!newInfluencer.name || !newInfluencer.slug) {
      setInfluencerError('이름과 슬러그를 입력해주세요.')
      return
    }
    setAddingInfluencer(true)
    setInfluencerError('')
    const res = await fetch('/api/admin/influencers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify(newInfluencer),
    })
    const data = await res.json()
    if (!res.ok) {
      setInfluencerError(data.error)
    } else {
      setInfluencers(prev => [data.influencer, ...prev])
      setNewInfluencer({ name: '', slug: '', code: '', commission_rate: '10' })
    }
    setAddingInfluencer(false)
  }

  function startEditInf(inf: Influencer) {
    setEditingInf(prev => ({
      ...prev,
      [inf.id]: {
        bonus_credits: String(inf.bonus_credits ?? 0),
        discount_rate: String(inf.discount_rate ?? 0),
      }
    }))
  }

  async function saveEditInf(id: string) {
    const edit = editingInf[id]
    if (!edit) return
    setSavingInf(id)
    await fetch('/api/admin/influencers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id, bonus_credits: edit.bonus_credits, discount_rate: edit.discount_rate }),
    })
    setInfluencers(prev => prev.map(inf => inf.id === id
      ? { ...inf, bonus_credits: Number(edit.bonus_credits), discount_rate: Number(edit.discount_rate) }
      : inf
    ))
    setEditingInf(prev => { const n = { ...prev }; delete n[id]; return n })
    setSavingInf(null)
  }

  async function toggleInfluencerStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    await fetch('/api/admin/influencers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id, status: newStatus }),
    })
    setInfluencers(prev => prev.map(inf => inf.id === id ? { ...inf, status: newStatus } : inf))
  }

  async function markCommissionPaid(id: string) {
    await fetch('/api/admin/influencers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ commissionId: id, status: 'paid' }),
    })
    setCommissions(prev => prev.map(c => c.id === id ? { ...c, status: 'paid' } : c))
  }

  async function deleteInfluencer(id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    await fetch('/api/admin/influencers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id }),
    })
    setInfluencers(prev => prev.filter(inf => inf.id !== id))
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

  async function cancelPayment(orderId: string) {
    if (!confirm('정말 취소하시겠습니까? 크레딧이 차감되고 환불 처리됩니다.')) return
    setCancelling(orderId)
    const res = await fetch('/api/admin/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ orderId }),
    })
    const data = await res.json()
    if (res.ok) {
      setPayments(prev => prev.filter(p => p.order_id !== orderId))
      alert('취소 완료')
    } else {
      alert(`취소 실패: ${data.error}`)
    }
    setCancelling(null)
  }

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
                  <th style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 700 }}>취소</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>결제 내역 없음</td></tr>
                )}
                {payments.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 20px', color: '#555' }}>{emailMap[p.user_id] || p.user_id}</td>
                      <td style={{ padding: '12px 20px', color: '#888' }}>{p.created_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td style={{ padding: '12px 20px', color: '#e67e22', fontWeight: 700 }}>{p.expires_at ? p.expires_at.slice(0, 10) : '-'}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>₩{p.amount.toLocaleString()}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', color: 'var(--accent)', fontWeight: 700 }}>+{p.credits_added}장</td>
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <button
                          onClick={() => cancelPayment(p.order_id)}
                          disabled={cancelling === p.order_id}
                          style={{ padding: '4px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                        >
                          {cancelling === p.order_id ? '취소 중...' : '취소'}
                        </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 인플루언서 관리 */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>인플루언서 관리</h2>

          {/* 추가 폼 */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px 110px', gap: 10, marginBottom: 10 }}>
              <input
                placeholder="이름 (예: 홍길동)"
                value={newInfluencer.name}
                onChange={e => setNewInfluencer(p => ({ ...p, name: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
              />
              <input
                placeholder="슬러그 (예: hongkildong)"
                value={newInfluencer.slug}
                onChange={e => setNewInfluencer(p => ({ ...p, slug: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
              />
              <input
                type="number"
                placeholder="커미션%"
                value={newInfluencer.commission_rate}
                onChange={e => setNewInfluencer(p => ({ ...p, commission_rate: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, textAlign: 'center' }}
              />
              <input
                type="number"
                placeholder="보너스 크레딧"
                value={newInfluencer.bonus_credits}
                onChange={e => setNewInfluencer(p => ({ ...p, bonus_credits: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, textAlign: 'center' }}
              />
              <input
                type="number"
                placeholder="첫결제 할인(%)"
                value={newInfluencer.discount_rate}
                onChange={e => setNewInfluencer(p => ({ ...p, discount_rate: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, textAlign: 'center' }}
              />
            </div>
            {influencerError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{influencerError}</p>}
            <button
              onClick={addInfluencer}
              disabled={addingInfluencer}
              style={{ padding: '8px 20px', background: 'var(--dark)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 700 }}
            >
              {addingInfluencer ? '추가 중...' : '+ 인플루언서 추가'}
            </button>
          </div>

          {/* 목록 테이블 */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f4f0', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>이름</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>링크</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>커미션율</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>보너스</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>첫결제 할인</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>가입 수</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>누적 수익</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>상태</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {influencers.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>인플루언서 없음</td></tr>
                )}
                {influencers.map(inf => (
                  <tr key={inf.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{inf.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/ref/${inf.slug}`
                          navigator.clipboard.writeText(url)
                          alert('링크 복사 완료!')
                        }}
                        title={`${window.location.origin}/ref/${inf.slug}`}
                        style={{ background: '#f0f7ff', color: '#1d4ed8', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                      >
                        /ref/{inf.slug} 복사
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>{inf.commission_rate}%</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {editingInf[inf.id] ? (
                        <input
                          type="number"
                          value={editingInf[inf.id].bonus_credits}
                          onChange={e => setEditingInf(prev => ({ ...prev, [inf.id]: { ...prev[inf.id], bonus_credits: e.target.value } }))}
                          style={{ width: 60, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, textAlign: 'center' }}
                        />
                      ) : (
                        <span style={{ color: '#16a34a', fontWeight: 700 }}>+{inf.bonus_credits ?? 0}장</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {editingInf[inf.id] ? (
                        <input
                          type="number"
                          value={editingInf[inf.id].discount_rate}
                          onChange={e => setEditingInf(prev => ({ ...prev, [inf.id]: { ...prev[inf.id], discount_rate: e.target.value } }))}
                          style={{ width: 60, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, textAlign: 'center' }}
                        />
                      ) : (
                        <span style={{ color: '#1d4ed8', fontWeight: 700 }}>{(inf.discount_rate ?? 0) > 0 ? `${inf.discount_rate}%` : '-'}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                      {referralSignups.filter(s => s.referred_by === inf.id).length}명
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                      ₩{inf.total_earned.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: inf.status === 'active' ? '#dcfce7' : '#f3f4f6',
                        color: inf.status === 'active' ? '#16a34a' : '#9ca3af',
                      }}>
                        {inf.status === 'active' ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {editingInf[inf.id] ? (
                          <>
                            <button
                              onClick={() => saveEditInf(inf.id)}
                              disabled={savingInf === inf.id}
                              style={{ padding: '4px 10px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                            >
                              {savingInf === inf.id ? '저장 중' : '저장'}
                            </button>
                            <button
                              onClick={() => setEditingInf(prev => { const n = { ...prev }; delete n[inf.id]; return n })}
                              style={{ padding: '4px 10px', background: '#f3f4f6', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEditInf(inf)}
                            style={{ padding: '4px 10px', background: '#f0f7ff', color: '#1d4ed8', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                          >
                            수정
                          </button>
                        )}
                        <button
                          onClick={() => toggleInfluencerStatus(inf.id, inf.status)}
                          style={{ padding: '4px 10px', background: '#f3f4f6', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                        >
                          {inf.status === 'active' ? '비활성화' : '활성화'}
                        </button>
                        <button
                          onClick={() => deleteInfluencer(inf.id)}
                          style={{ padding: '4px 10px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 레퍼럴 가입자 목록 */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>레퍼럴 가입자</h2>
            <select
              value={signupFilter}
              onChange={e => setSignupFilter(e.target.value)}
              style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">전체 인플루언서</option>
              {influencers.map(inf => (
                <option key={inf.id} value={inf.id}>{inf.name}</option>
              ))}
            </select>
            <span style={{ fontSize: 13, color: '#888' }}>
              총 {(signupFilter === 'all' ? referralSignups : referralSignups.filter(s => s.referred_by === signupFilter)).length}명
            </span>
          </div>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f4f0', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>인플루언서</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>가입자 이메일</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>가입일</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>결제 여부</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = signupFilter === 'all'
                    ? referralSignups
                    : referralSignups.filter(s => s.referred_by === signupFilter)
                  if (filtered.length === 0) return (
                    <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>가입자 없음</td></tr>
                  )
                  return filtered.map(s => {
                    const inf = influencers.find(i => i.id === s.referred_by)
                    const hasPaid = commissions.some(c => c.referred_user_id === s.id)
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{inf?.name || '-'}</td>
                        <td style={{ padding: '12px 16px', color: '#555' }}>{s.email}</td>
                        <td style={{ padding: '12px 16px', color: '#888' }}>{s.created_at?.slice(0, 10)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: hasPaid ? '#dcfce7' : '#f3f4f6',
                            color: hasPaid ? '#16a34a' : '#9ca3af',
                          }}>
                            {hasPaid ? '결제함' : '미결제'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        </section>

        {/* 커미션 내역 */}
        <section style={{ marginBottom: 48 }}>
          {/* 커미션 필터 + 요약 */}
          {(() => {
            const filtered = commissionFilter === 'all'
              ? commissions
              : commissions.filter(c => c.influencer_id === commissionFilter)
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>커미션 내역</h2>
                  <select
                    value={commissionFilter}
                    onChange={e => setCommissionFilter(e.target.value)}
                    style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="all">전체 인플루언서</option>
                    {influencers.map(inf => (
                      <option key={inf.id} value={inf.id}>{inf.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const rows = commissionFilter === 'all' ? commissions : commissions.filter(c => c.influencer_id === commissionFilter)
                      const header = '인플루언서,발생일,결제금액,커미션금액,상태'
                      const body = rows.map(c => [
                        c.influencers?.name || '-',
                        c.created_at?.slice(0, 16).replace('T', ' '),
                        c.order_amount,
                        c.commission_amount,
                        c.status === 'paid' ? '지급완료' : '미지급',
                      ].join(',')).join('\n')
                      const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `커미션내역_${new Date().toISOString().slice(0, 10)}.csv`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    style={{ padding: '6px 14px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 700 }}
                  >
                    엑셀 다운로드
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#666' }}>
                  <span>미지급: <strong style={{ color: '#e67e22' }}>
                    ₩{filtered.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0).toLocaleString()}
                  </strong></span>
                  <span>누적 지급: <strong style={{ color: '#16a34a' }}>
                    ₩{filtered.filter(c => c.status === 'paid').reduce((s, c) => s + c.commission_amount, 0).toLocaleString()}
                  </strong></span>
                </div>
              </div>
            )
          })()}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f4f0', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>인플루언서</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>발생일</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>결제 금액</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>커미션</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>상태</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>처리</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = commissionFilter === 'all'
                    ? commissions
                    : commissions.filter(c => c.influencer_id === commissionFilter)
                  if (filtered.length === 0) return (
                    <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>커미션 내역 없음</td></tr>
                  )
                  return filtered.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.influencers?.name || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#888' }}>{c.created_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>₩{c.order_amount.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                        ₩{c.commission_amount.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: c.status === 'paid' ? '#dcfce7' : '#fef9c3',
                          color: c.status === 'paid' ? '#16a34a' : '#92400e',
                        }}>
                          {c.status === 'paid' ? '지급완료' : '미지급'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {c.status === 'pending' && (
                          <button
                            onClick={() => markCommissionPaid(c.id)}
                            style={{ padding: '4px 10px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                          >
                            지급완료
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                })()}
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
