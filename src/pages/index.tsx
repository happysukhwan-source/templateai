import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import Navbar from '../components/Navbar'
import type { Session } from '@supabase/supabase-js'

interface Props { session: Session | null }

export default function HomePage({ session }: Props) {
  const [visibleEls, setVisibleEls] = useState<Set<string>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) setVisibleEls(prev => new Set(Array.from(prev).concat(e.target.id)))
      })
    }, { threshold: 0.1 })

    document.querySelectorAll('.fade-el').forEach(el => observerRef.current?.observe(el))
    return () => observerRef.current?.disconnect()
  }, [])

  const isVisible = (id: string) => visibleEls.has(id)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'templateAI',
    url: 'https://www.templateai.shop',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    description: '상세페이지 이미지를 피그마 템플릿으로 자동 변환하는 AI 서비스',
    offers: {
      '@type': 'Offer',
      price: '300',
      priceCurrency: 'KRW',
    },
  }

  return (
    <>
      <Head>
        <title>상세페이지 피그마 템플릿 자동 변환 | templateAI</title>
        <meta name="description" content="상세페이지 이미지를 올리면 30초 만에 편집 가능한 피그마 템플릿으로 변환. 상세페이지템플릿을 AI가 자동으로 만들어드려요. 스마트스토어·쿠팡 셀러 필수 도구." />
        <meta name="keywords" content="상세페이지, 상세페이지템플릿, 피그마템플릿, 피그마 변환, 상세페이지 제작, 스마트스토어 상세페이지, 쿠팡 상세페이지, AI 디자인, SVG 변환" />
        <link rel="canonical" href="https://www.templateai.shop/" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.templateai.shop/" />
        <meta property="og:title" content="상세페이지 피그마 템플릿 자동 변환 | templateAI" />
        <meta property="og:description" content="상세페이지 이미지를 올리면 30초 만에 편집 가능한 피그마 템플릿으로 변환. 스마트스토어·쿠팡 셀러를 위한 AI 상세페이지 템플릿 서비스." />
        <meta property="og:site_name" content="templateAI" />
        <meta property="og:locale" content="ko_KR" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>
    <div style={{ background: 'var(--cream)', minHeight: '100vh', overflowX: 'hidden' }}>
      <Navbar />

      {/* ── HERO ── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '140px 48px 80px', position: 'relative', overflow: 'hidden' }}>

        {/* 배경 원 */}
        <div style={{ position: 'absolute', right: -100, top: '50%', transform: 'translateY(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, #ffe0d8 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'Space Mono, monospace', fontWeight: 700, letterSpacing: 2, color: 'var(--accent)', background: '#fff0ec', border: '1px solid #ffc4b3', padding: '7px 16px', borderRadius: 100, marginBottom: 36, width: 'fit-content' }}>
          <span style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', animation: 'blink 1.4s ease-in-out infinite' }} />
          BETA OPEN
        </div>

        <h1 style={{ fontSize: 'clamp(48px, 8vw, 96px)', fontWeight: 900, lineHeight: 1.0, letterSpacing: -3, maxWidth: 800, marginBottom: 28 }}>
          PNG 한 장이<br />
          <span style={{ color: 'var(--accent)', position: 'relative' }}>
            피그마 템플릿
            <span style={{ position: 'absolute', bottom: 4, left: 0, right: 0, height: 6, background: 'var(--accent)', opacity: 0.2, borderRadius: 2 }} />
          </span>으로
        </h1>

        <p style={{ fontSize: 18, color: '#555', lineHeight: 1.7, maxWidth: 480, marginBottom: 48 }}>
          상세페이지 이미지를 올리면 AI가 바로<br />
          편집 가능한 피그마 SVG 템플릿으로 변환해요.<br />
          스마트스토어, 쿠팡 셀러를 위한 서비스예요.
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Link href={session ? '/convert' : '/signup'} style={{ fontWeight: 700, fontSize: 16, color: 'white', background: 'var(--accent)', padding: '16px 32px', borderRadius: 100, textDecoration: 'none', transition: 'background 0.2s' }}>
            {session ? '변환하러 가기 →' : '무료로 시작하기 →'}
          </Link>
          <Link href="/pricing" style={{ fontWeight: 700, fontSize: 16, color: 'var(--dark)', background: 'white', padding: '16px 32px', borderRadius: 100, textDecoration: 'none', border: '2px solid var(--border)' }}>
            요금 보기
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 48, marginTop: 64, paddingTop: 40, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {[['5장', '가입 시 무료 제공'], ['30초', '평균 변환 시간'], ['₩300~', '건당 가격']].map(([num, label]) => (
            <div key={label}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 32, fontWeight: 700, display: 'block' }}>{num}</span>
              <span style={{ fontSize: 13, color: '#888', marginTop: 4, display: 'block' }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '100px 48px' }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: 3, color: 'var(--accent)', fontWeight: 700, marginBottom: 16 }}>HOW IT WORKS</div>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 900, letterSpacing: -2, marginBottom: 60 }}>딱 3단계면 끝</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, background: 'var(--border)', border: '2px solid var(--dark)', borderRadius: 20, overflow: 'hidden' }}>
          {[
            { num: '01', icon: '📤', title: 'PNG 업로드', desc: '상세페이지, 배너 등\n어떤 이미지든 올려주세요.' },
            { num: '02', icon: '🤖', title: 'AI 분석 & 변환', desc: 'AI가 레이아웃을 이해하고\n편집 가능한 구조로 재구성해요.' },
            { num: '03', icon: '🎨', title: '피그마에서 편집', desc: 'SVG 파일을 피그마에 드롭하면\n텍스트·이미지 바로 수정 가능!' },
          ].map((s, i) => (
            <div key={i} id={`step-${i}`} className="fade-el" style={{ background: 'var(--cream)', padding: '48px 40px', transition: 'background 0.2s', opacity: isVisible(`step-${i}`) ? 1 : 0, transform: isVisible(`step-${i}`) ? 'translateY(0)' : 'translateY(20px)', transitionProperty: 'opacity, transform', transitionDuration: `0.6s`, transitionDelay: `${i * 0.1}s` }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 64, fontWeight: 700, color: 'var(--border)', display: 'block', lineHeight: 1, marginBottom: 20 }}>{s.num}</span>
              <div style={{ fontSize: 28, marginBottom: 16 }}>{s.icon}</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BEFORE / AFTER ── */}
      <section style={{ padding: '100px 48px', background: 'var(--dark)', color: 'white' }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: 3, color: '#ff8060', fontWeight: 700, marginBottom: 16 }}>BEFORE / AFTER</div>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 900, letterSpacing: -2, marginBottom: 56, color: 'white' }}>이렇게 달라져요</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 24, alignItems: 'center', maxWidth: 860 }}>
          {/* Before */}
          <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #333' }}>
            <div style={{ padding: '14px 20px', fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: 2, fontWeight: 700, background: '#1a1a1a', color: '#888', borderBottom: '1px solid #333' }}>BEFORE — 기존 방식</div>
            <div style={{ padding: 28, background: '#111', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['디자이너에게 작업 요청', '2~3일 기다리기', '수정 요청 주고받기', '비용 5~15만원 지불', '고생 끝에 파일 수령'].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#888' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#444', flexShrink: 0 }} />{t}
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 36, color: 'var(--accent)', fontWeight: 900, textAlign: 'center' }}>→</div>

          {/* After */}
          <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #333' }}>
            <div style={{ padding: '14px 20px', fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: 2, fontWeight: 700, background: '#1c1a00', color: '#f0b429', borderBottom: '1px solid #333' }}>AFTER — templateAI</div>
            <div style={{ padding: 28, background: '#111', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['PNG 파일 업로드', '30초 대기', 'SVG 다운로드', '최대할인 시 ₩300 결제', '피그마에서 바로 편집!'].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#ddd' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f0b429', flexShrink: 0 }} />{t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 경쟁사와 차이 ── */}
      <section style={{ padding: '100px 48px' }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: 3, color: 'var(--accent)', fontWeight: 700, marginBottom: 16 }}>WHY TEMPLATEAI</div>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 900, letterSpacing: -2, marginBottom: 16 }}>다른 변환 툴과<br />완전히 달라요</h2>
        <p style={{ color: '#666', marginBottom: 52, maxWidth: 500 }}>Adobe, Vectorizer 등 기존 서비스는 픽셀을 그대로 벡터로 추적해요. templateAI는 레이아웃을 <strong>이해</strong>해서 재구성해요.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 760 }}>
          {[
            { label: '기존 서비스', items: ['픽셀을 패스로 추적', '수천 개의 path 조각', '편집 거의 불가능', '텍스트 인식 안됨'], bad: true },
            { label: 'templateAI', items: ['레이아웃 구조 이해', '텍스트는 <text> 요소로', '이미지는 플레이스홀더로', '피그마에서 바로 편집'], bad: false },
          ].map((col) => (
            <div key={col.label} style={{ background: col.bad ? '#f9f9f9' : 'white', border: `2px solid ${col.bad ? 'var(--border)' : 'var(--dark)'}`, borderRadius: 16, padding: 32, boxShadow: col.bad ? 'none' : '6px 6px 0 var(--accent)' }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, fontWeight: 700, marginBottom: 20, color: col.bad ? '#999' : 'var(--dark)' }}>{col.label}</div>
              {col.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, padding: '8px 0', color: col.bad ? '#aaa' : '#333', borderBottom: i < col.items.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <span style={{ color: col.bad ? '#ddd' : '#22c55e', fontWeight: 700 }}>{col.bad ? '✗' : '✓'}</span>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="cta" style={{ padding: '100px 48px', background: 'var(--accent)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(32px, 5vw, 64px)', fontWeight: 900, letterSpacing: -2, color: 'white', marginBottom: 16 }}>지금 무료로<br />시작해보세요</h2>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', marginBottom: 40 }}>가입하면 5장 무료 · 카드 등록 불필요</p>
        <Link href={session ? '/convert' : '/signup'} style={{ display: 'inline-block', fontWeight: 700, fontSize: 18, color: 'var(--accent)', background: 'white', padding: '18px 48px', borderRadius: 100, textDecoration: 'none' }}>
          {session ? '변환하러 가기 →' : '무료로 시작하기 →'}
        </Link>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '40px 48px', borderTop: '1px solid var(--border)', background: '#faf9f6', fontSize: 12, color: '#999' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24, marginBottom: 24 }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 15, color: 'var(--dark)' }}>
            template<span style={{ color: 'var(--accent)' }}>AI</span>
          </span>
          <div style={{ display: 'flex', gap: 20 }}>
            <Link href="/pricing" style={{ color: '#888', textDecoration: 'none' }}>요금제</Link>
            <Link href="/convert" style={{ color: '#888', textDecoration: 'none' }}>변환하기</Link>
            <Link href="/terms" style={{ color: '#888', textDecoration: 'none' }}>이용약관</Link>
            <Link href="/privacy" style={{ color: '#888', textDecoration: 'none' }}>개인정보처리방침</Link>
            <Link href="/refund" style={{ color: '#888', textDecoration: 'none' }}>환불정책</Link>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
            <span>상호명: 배러댄</span>
            <span>대표자: 장석환</span>
            <span>사업자등록번호: 594-17-00968</span>
            <span>통신판매업 신고번호: 제 2022-진건퇴계원-51호</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
            <span>주소: 경기도 남양주시 진건읍 양진로 375-81</span>
            <span>고객센터: <a href="tel:01067323121" style={{ color: '#999', textDecoration: 'none' }}>010-6732-3121</a></span>
            <span>이메일: <a href="mailto:bodywick@naver.com" style={{ color: '#999', textDecoration: 'none' }}>bodywick@naver.com</a></span>
          </div>
          <span style={{ marginTop: 8 }}>© 2025 templateAI · All rights reserved.</span>
        </div>
      </footer>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @media (max-width: 768px) {
          section { padding: 64px 24px !important; }
          .ba-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
    </>
  )
}


