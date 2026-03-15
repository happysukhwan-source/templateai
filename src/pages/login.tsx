import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import Navbar from '../components/Navbar'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요.'); return }
    setLoading(true); setError('')

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError('이메일 또는 비밀번호가 올바르지 않아요.'); setLoading(false); return }

    // 기존 가입자 중 프로필이 없는 경우 생성 (무료 5장 지급)
    if (data.user) {
      // upsert를 사용하여 race condition 방지 및 확실한 생성
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          free_credits: 5,
          paid_credits: 0,
        }, {
          onConflict: 'id',
          ignoreDuplicates: true // 이미 있으면 건드리지 않음
        })

      if (profileError) {
        console.error('Migration profile error:', profileError)
      }
    }

    window.location.href = '/convert'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '80px 24px' }}>
        <div className="card" style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ marginBottom: 28, textAlign: 'center' }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>로그인</h1>
            <p style={{ color: '#666', fontSize: 14 }}>templateAI에 오신 것을 환영해요 👋</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email" placeholder="이메일" value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ padding: '14px 16px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <input
              type="password" placeholder="비밀번호" value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ padding: '14px 16px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />

            {error && <p style={{ color: 'var(--accent)', fontSize: 13 }}>⚠️ {error}</p>}

            <button className="btn-primary" style={{ marginTop: 4 }} onClick={handleLogin} disabled={loading}>
              {loading ? <><span className="spinner" style={{ marginRight: 8 }} />로그인 중...</> : '로그인 →'}
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
            계정이 없으신가요?{' '}
            <Link href="/signup" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>무료 가입 →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
