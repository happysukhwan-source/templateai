import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import Navbar from '../components/Navbar'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSignup() {
    if (!name.trim()) { setError('이름을 입력해주세요.'); return }
    const phoneClean = phone.replace(/[^0-9]/g, '')
    if (phoneClean.length < 10) { setError('올바른 휴대폰 번호를 입력해주세요.'); return }
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요.'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 해요.'); return }

    setLoading(true); setError('')
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name.trim() }
      }
    })

    if (err) { setError(err.message); setLoading(false); return }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        name: name.trim(),
        phone: phoneClean,
        free_credits: 5,
        paid_credits: 0,
      })

      if (profileError) {
        console.error('Profile creation error:', profileError)
      }
    }
    setDone(true)
    setLoading(false)
  }

  const inputStyle = {
    padding: '14px 16px', borderRadius: 10, border: '1.5px solid var(--border)',
    fontSize: 15, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '80px 24px' }}>
        <div className="card" style={{ width: '100%', maxWidth: 420 }}>

          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>가입 완료!</h2>
              <p style={{ color: '#666', marginBottom: 8 }}>이메일을 확인해서 인증을 완료해주세요.</p>
              <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>인증 후 무료 5장이 바로 지급돼요 🎁</p>
              <Link href="/login" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>로그인하러 가기 →</Link>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>무료로 시작하기</h1>
                <p style={{ color: '#666', fontSize: 14 }}>가입하면 <strong style={{ color: 'var(--accent)' }}>5장 무료</strong> 바로 지급!</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="text"
                  placeholder="이름"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={inputStyle}
                  onKeyDown={e => e.key === 'Enter' && handleSignup()}
                />
                <input
                  type="tel"
                  placeholder="휴대폰 번호 (01012345678)"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={inputStyle}
                  onKeyDown={e => e.key === 'Enter' && handleSignup()}
                />
                <input
                  type="email"
                  placeholder="이메일"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                  onKeyDown={e => e.key === 'Enter' && handleSignup()}
                />
                <input
                  type="password"
                  placeholder="비밀번호 (6자 이상)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={inputStyle}
                  onKeyDown={e => e.key === 'Enter' && handleSignup()}
                />

                {error && <p style={{ color: 'var(--accent)', fontSize: 13 }}>⚠️ {error}</p>}

                <button className="btn-primary" style={{ marginTop: 4 }} onClick={handleSignup} disabled={loading}>
                  {loading ? <><span className="spinner" style={{ marginRight: 8 }} />가입 중...</> : '무료로 가입하기 →'}
                </button>

                <div style={{
                  background: '#f0f7ff', border: '1.5px solid #bfdbfe', borderRadius: 10,
                  padding: '12px 16px', textAlign: 'center', marginTop: 4,
                }}>
                  <p style={{ fontSize: 13, color: '#1d4ed8', margin: 0, fontWeight: 600 }}>
                    가입 후 이메일로 확인 링크가 발송됩니다. 꼭 확인해주세요!
                  </p>
                </div>
              </div>

              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
                이미 계정이 있으신가요?{' '}
                <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>로그인</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
