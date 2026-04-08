import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import type { Session } from '@supabase/supabase-js'
import Link from 'next/link'
import { isAdmin } from '../lib/admin'

interface Props { session: Session | null }
type Status = 'idle' | 'converting' | 'done' | 'error'
type Mode = 'template'

const MAX_IMAGE_HEIGHT = 10000
const PREVIEW_WIDTH = 380

export default function ConvertPage({ session }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [resultSvg, setResultSvg] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [mode, setMode] = useState<Mode>('template')
  const inputRef = useRef<HTMLInputElement>(null)

  const hasOverflow = imageDims ? imageDims.h > MAX_IMAGE_HEIGHT : false
  const requiredCredits = imageDims && imageDims.h >= 5000 ? 2 : 1
  const canConvert = !!file && !hasOverflow && status !== 'converting'

  const compressImage = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1000 // Vercel 전송 제한(4.5MB)을 위해 가로폭 최적화
        let width = img.naturalWidth
        let height = img.naturalHeight

        if (width > MAX_WIDTH) {
          height = (MAX_WIDTH / width) * height
          width = MAX_WIDTH
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject('Canvas context error')
        ctx.drawImage(img, 0, 0, width, height)
        
        // JPEG 압축 (퀄리티 0.8)로 용량을 획기적으로 줄임
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        resolve(dataUrl.split(',')[1])
        URL.revokeObjectURL(img.src)
      }
      img.onerror = () => reject('이미지 로드 실패')
      img.src = URL.createObjectURL(f)
    })
  }

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) { setErrorMsg('이미지 파일만 업로드 가능해요.'); return }
    if (f.size > 50 * 1024 * 1024) { setErrorMsg('파일 크기는 50MB 이하여야 해요.'); return }
    setFile(f); setErrorMsg(''); setResultSvg(''); setStatus('idle')
    const url = URL.createObjectURL(f)
    setImageUrl(url)
    const img = new Image()
    img.onload = () => setImageDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  async function handleConvert() {
    if (!file || !session || !canConvert) return
    setStatus('converting'); setErrorMsg(''); setResultSvg('')
    try {
      const isUserAdmin = isAdmin(session.user.email)

      const { data: profile } = await supabase
        .from('profiles').select('free_credits, paid_credits').eq('id', session.user.id).single()

      if (profile) {
        const totalCredits = (profile?.free_credits || 0) + (profile?.paid_credits || 0)
        if (!isUserAdmin && totalCredits < requiredCredits) {
          setErrorMsg(`크레딧이 부족해요. (잔여: ${totalCredits}, 필요: ${requiredCredits})`)
          setStatus('error'); return
        }
      }

      const apiEndpoint = '/api/convert'
      
      // 이미지 압축 및 리사이징 (Vercel 4.5MB 제한 우회)
      const base64 = await compressImage(file)
      
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          imageData: base64, mimeType: 'image/jpeg',
          fileName: file.name,
          originalHeight: imageDims?.h,
          originalWidth: imageDims?.w
        }),
      })
      
      const text = await res.text()
      let data: any = {}
      try { data = JSON.parse(text) } catch {
        throw new Error(`변환 실패: ${text || res.statusText}`)
      }
      
      if (!res.ok) throw new Error(data.error || `변환 실패`)
      
      setResultSvg(data.svg); setStatus('done')
    } catch (err: any) {
      setErrorMsg(err.message); setStatus('error')
    }
  }

  function downloadSvg(svg: string) {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${file?.name.replace(/\.[^.]+$/, '')}_converted.svg`
    a.click(); URL.revokeObjectURL(url)
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Navbar />
        <div className="card" style={{ maxWidth: 400, textAlign: 'center', marginTop: 80 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>로그인이 필요해요</h2>
          <p style={{ color: '#666', marginBottom: 24 }}>무료로 가입하고 5장을 바로 변환해보세요!</p>
          <Link href="/signup" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>무료 시작 →</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 24px 60px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, marginBottom: 8 }}>
          PNG → <span style={{ color: 'var(--accent)' }}>Figma 템플릿</span> 변환
        </h1>
        <p style={{ color: '#666', marginBottom: 24 }}>최대 높이 10,000px 이미지까지 한 번에 전체 변환 할 수 있어요.</p>

        {/* 모드 토글 */}
        <div style={{ marginBottom: 24, padding: '12px 20px', background: '#fff5f0', border: '1.5px solid #ffc4b3', borderRadius: 10, fontSize: 13, color: '#cc3a00', textAlign: 'left' }}>
          <strong>✦ Figma 템플릿 모드</strong> — AI가 불필요한 벡터 없이 <strong>배경 rect · 이미지 플레임 · 텍스트 플레임</strong>만 생성합니다.<br />
          <span style={{ color: '#888', fontSize: 12 }}>다운로드 후 피그마에서 배경색 변경, 이미지 삽입, 텍스트 입력만 하면 바로 사용 가능합니다.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 28, alignItems: 'start' }}>
          {/* 좌측 */}
          <div>
            {!imageUrl ? (
              <div
                className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
                style={{ borderRadius: 16, padding: 32, textAlign: 'center', background: 'white', cursor: 'pointer', minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => inputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>📤</div>
                <p style={{ fontWeight: 700, marginBottom: 8 }}>PNG 파일을 드래그하거나 클릭해서 업로드</p>
                <p style={{ fontSize: 13, color: '#999' }}>PNG, JPG · 최대 30MB · 권장 가로 860px</p>
                <p style={{ fontSize: 12, color: '#bbb', marginTop: 6 }}>세로 {MAX_IMAGE_HEIGHT.toLocaleString()}px 이내 한 장씩 올려주세요</p>
                <p style={{ fontSize: 12, color: '#f0a070', marginTop: 8, background: '#fff5f0', padding: '6px 14px', borderRadius: 8 }}>
                  💡 강력해진 AI 엔진으로 통째로 곧바로 변환됩니다
                </p>
              </div>
            ) : (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>이미지 확인</span>
                  <button onClick={() => inputRef.current?.click()} style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>다른 파일</button>
                </div>

                {/* 이미지 미리보기 */}
                <div style={{ width: PREVIEW_WIDTH, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <img src={imageUrl} style={{ width: PREVIEW_WIDTH, display: 'block' }} alt="미리보기" draggable={false} />
                </div>

                {hasOverflow && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: '#fff5f2', borderRadius: 8, fontSize: 12, color: 'var(--accent)', border: '1px solid #ffc4b3' }}>
                    🔴 {MAX_IMAGE_HEIGHT.toLocaleString()}px를 초과했습니다. 더 짧은 이미지를 사용해주세요.
                  </div>
                )}

                <div style={{ marginTop: 10, padding: '10px 14px', background: '#f8f6f2', borderRadius: 8, fontSize: 12, color: '#666' }}>
                  전체 변환
                  {imageDims && <span style={{ color: '#aaa' }}> · 원본 {imageDims.h.toLocaleString()}px</span>}
                  <span> · <strong style={{ color: 'var(--accent)' }}>{requiredCredits}크레딧</strong> 차감 예정</span>
                </div>
              </div>
            )}

            <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

            {errorMsg && (
              <div style={{ marginTop: 12, padding: '10px 16px', background: '#fff5f2', borderRadius: 8, fontSize: 13, color: 'var(--accent)', border: '1px solid #ffc4b3' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: 16, fontSize: 16, opacity: canConvert ? 1 : 0.5 }}
              disabled={!canConvert}
              onClick={handleConvert}
            >
              {status === 'converting'
                ? <><span className="spinner" style={{ marginRight: 8 }} />최신 AI가 변환 중 (최대 1분 소요)...</>
                : !file ? '이미지를 먼저 업로드해주세요'
                  : hasOverflow ? '🔴 이미지 길이가 너무 깁니다'
                    : `✨ 통째로 Figma 템플릿 변환`}
            </button>
          </div>

          {/* 우측: 결과 */}
          <div>
            {status === 'done' && resultSvg ? (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>✅ 변환 완료</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ padding: '12px 16px', background: '#f8f6f2', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#555' }}>전체 이미지</span>
                    <button onClick={() => downloadSvg(resultSvg)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', padding: '6px 14px', borderRadius: 20, cursor: 'pointer' }}>
                      SVG 다운로드 ↓
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, fontSize: 13, color: '#166534' }}>
                  💡 SVG 파일을 메모장으로 열어서 전체 복사 → 피그마에 붙여넣기 하세요!
                </div>
              </div>
            ) : (
              <div className="card" style={{ minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
                <p style={{ fontWeight: 700 }}>변환 결과가 여기에 표시돼요</p>
                <p style={{ fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 1.8 }}>
                  왼쪽에서 이미지를 업로드하고<br />전체 변환 버튼을 눌러주세요
                </p>
              </div>
            )}
            <div className="card" style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📌 사용 방법</p>
              <ol style={{ fontSize: 12, color: '#666', lineHeight: 2.2, paddingLeft: 16 }}>
                <li>쇼핑몰 상세페이지 분할 이미지를 업로드하세요.</li>
                <li>최대 세로 10,000px까지 지원합니다. (높은 품질 보장)</li>
                <li>5,000px 이상의 이미지는 <strong>2크레딧</strong>이 차감됩니다.</li>
                <li>[통째로 SVG 변환하기] 클릭!</li>
                <li>다운받은 SVG 파일의 코드를 복사해서 피그마에 붙여넣기</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
