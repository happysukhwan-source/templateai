import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { isAdmin } from '../lib/admin'

export default function Navbar() {
  const [session, setSession] = useState<Session | null>(null)
  const [credits, setCredits] = useState<number>(0)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [isAdminUser, setIsAdminUser] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        setIsAdminUser(isAdmin(session.user.email))
        fetchCredits(session.user.id, session.user.email)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) {
        setIsAdminUser(isAdmin(session.user.email))
        fetchCredits(session.user.id, session.user.email)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchCredits(userId: string, email?: string) {
    if (isAdmin(email)) {
      setCredits(9999) // 무제한 표시용
      return
    }
    // 1. 먼저 조회 시도
    let { data, error } = await supabase
      .from('profiles')
      .select('free_credits, paid_credits')
      .eq('id', userId)
      .single()
    
    // 2. 만약 프로필이 없다면(또는 에러 발생 시) 생성을 시도 (Lazy Migration)
    if (!data || error) {
      if (error) console.log('Fetch credits error (might be expected for new users):', error)
      
      const { data: newData, error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: email || '',
          free_credits: 5,
          paid_credits: 0
        }, { onConflict: 'id', ignoreDuplicates: true })
        .select()
        .single()
      
      if (upsertError) {
        console.error('CRITICAL: Profile creation/upsert failed:', upsertError)
      }
      if (newData) data = newData
    }

    if (data) setCredits((data.free_credits || 0) + (data.paid_credits || 0))

    // 유료 크레딧이 있으면 가장 최근 결제의 만료일 조회
    if (data?.paid_credits > 0) {
      const { data: payment } = await supabase
        .from('payments')
        .select('expires_at')
        .eq('user_id', userId)
        .order('expires_at', { ascending: false })
        .limit(1)
        .single()
      if (payment?.expires_at) {
        const d = new Date(payment.expires_at)
        setExpiresAt(`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`)
      }
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 48px',
      background: 'var(--cream)',
      borderBottom: '1px solid var(--border)',
    }}>
      <Link href="/" style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 16, color: 'var(--dark)', textDecoration: 'none' }}>
        template<span style={{ color: 'var(--accent)' }}>AI</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {session ? (
          <>
            <span className="credit-badge">
              {isAdminUser ? '무제한 사용 중' : `잔여 ${credits}장`}
              {!isAdminUser && expiresAt && <span style={{ fontSize: 10, color: '#aaa', marginLeft: 6 }}>~{expiresAt}</span>}
            </span>
            <Link href="/convert" style={{
              fontSize: 13, fontWeight: 700, color: 'white',
              background: 'var(--dark)', padding: '10px 20px',
              borderRadius: 100, textDecoration: 'none'
            }}>변환하기</Link>
            <Link href="/pricing" style={{
              fontSize: 13, fontWeight: 700, color: 'var(--accent)',
              background: 'transparent', padding: '10px 20px',
              borderRadius: 100, textDecoration: 'none',
              border: '1px solid var(--accent)'
            }}>이용요금</Link>
            {isAdminUser && (
              <Link href="/admin" style={{
                fontSize: 13, fontWeight: 700, color: '#888',
                textDecoration: 'none'
              }}>관리자</Link>
            )}
            <button onClick={handleLogout} style={{
              fontSize: 13, color: '#888', background: 'none',
              border: 'none', cursor: 'pointer'
            }}>로그아웃</button>
          </>
        ) : (
          <>
            <Link href="/login" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>로그인</Link>
            <Link href="/signup" style={{
              fontSize: 13, fontWeight: 700, color: 'white',
              background: 'var(--accent)', padding: '10px 22px',
              borderRadius: 100, textDecoration: 'none'
            }}>무료 시작 →</Link>
          </>
        )}
      </div>
    </nav>
  )
}
