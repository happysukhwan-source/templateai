import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import type { Session } from '@supabase/supabase-js'
import Link from 'next/link'
import { isAdmin } from '../lib/admin'

interface Props { session: Session | null }
type Status = 'idle' | 'converting' | 'done' | 'error'

const MAX_SECTION_HEIGHT = 1800
const PREVIEW_WIDTH = 380

export default function ConvertPage({ session }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null)
  const [splitLines, setSplitLines] = useState<number[]>([])
  const [dragging, setDragging] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [results, setResults] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const scale = imageDims ? PREVIEW_WIDTH / imageDims.w : 1

  // ── 섹션 계산 ──
  function getSections() {
    if (!imageDims) return []
    const sorted = [...splitLines].sort((a, b) => a - b)
    const lines = [0, ...sorted, imageDims.h]
    return lines.slice(0, -1).map((y1, i) => ({
      y1,
      y2: lines[i + 1],
      height: lines[i + 1] - y1,
      isOver: (lines[i + 1] - y1) > MAX_SECTION_HEIGHT,
    }))
  }

  const sections = getSections()
  const sortedLines = [...splitLines].sort((a, b) => a - b)
  const hasOverflow = sections.some(s => s.isOver)
  const canConvert = !!file && !hasOverflow && status !== 'converting' && sections.length > 0

  // ── 파일 처리 ──
  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) { setErrorMsg('이미지 파일만 업로드 가능해요.'); return }
    if (f.size > 30 * 1024 * 1024) { setErrorMsg('파일 크기는 30MB 이하여야 해요.'); return }
    setFile(f); setErrorMsg(''); setResults([]); setStatus('idle'); setSplitLines([])
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

  // ── 클릭으로 분할선 추가 ──
  function handlePreviewClick(e: React.MouseEvent<HTMLDivElement>) {
    if (dragging !== null || !imageDims) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const yPx = Math.round((e.clientY - rect.top) / scale)
    const clamped = Math.max(10, Math.min(imageDims.h - 10, yPx))
    const tooClose = splitLines.some(l => Math.abs(l - clamped) < 30 / scale)
    if (!tooClose) setSplitLines(prev => [...prev, clamped].sort((a, b) => a - b))
  }

  // ── 드래그 ──
  function startDrag(e: React.MouseEvent, idx: number) {
    e.stopPropagation()
    setDragging(idx)
  }

  useEffect(() => {
    if (dragging === null) return
    const onMove = (e: MouseEvent) => {
      if (!previewRef.current || !imageDims) return
      const rect = previewRef.current.getBoundingClientRect()
      const yPx = Math.round((e.clientY - rect.top) / scale)
      const clamped = Math.max(10, Math.min(imageDims.h - 10, yPx))
      setSplitLines(prev => {
        const next = [...prev]
        next[dragging] = clamped
        return next.sort((a, b) => a - b)
      })
    }
    const onUp = () => setDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, scale, imageDims])

  function removeLine(e: React.MouseEvent, lineVal: number) {
    e.stopPropagation()
    setSplitLines(prev => prev.filter(l => l !== lineVal))
  }

  // ── 변환 ──
  async function handleConvert() {
    if (!file || !session || !canConvert) return
    setStatus('converting'); setErrorMsg(''); setResults([])
    try {
      const isUserAdmin = isAdmin(session.user.email)

      // 1. 프론트엔드 크레딧 체크 (사용자 경험용)
      const { data: profile } = await supabase
        .from('profiles').select('free_credits, paid_credits').eq('id', session.user.id).single()

      // 프로필이 없거나 RLS로 인해 못 읽어오는 경우에도 일단 진행 (서버에서 최종 체크함)
      if (profile) {
        const totalCredits = (profile?.free_credits || 0) + (profile?.paid_credits || 0)
        if (!isUserAdmin && totalCredits < sections.length) {
          setErrorMsg(`크레딧이 부족해요. (잔여: ${totalCredits}, 필요: ${sections.length})`)
          setStatus('error'); return
        }
      }
      const svgs: string[] = []
      for (let i = 0; i < sections.length; i++) {
        // 각 섹션을 프론트엔드에서 미리 크롭해서 전송 (전체 이미지 반복 전송 방지)
        const croppedBase64 = await cropImageToBase64(file, sections[i].y1, sections[i].y2)
        const res = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: croppedBase64, mimeType: 'image/png', userId: session.user.id, userEmail: session.user.email,
            fileName: file.name, sectionNum: i + 1, totalSections: sections.length,
          }),
        })
        const text = await res.text()
        let data: any = {}
        try { data = JSON.parse(text) } catch {
          throw new Error(`섹션 ${i + 1} 변환 실패: ${text || res.statusText}`)
        }
        if (!res.ok) throw new Error(data.error || `섹션 ${i + 1} 변환 실패`)
        svgs.push(data.svg)
      }
      setResults(svgs); setStatus('done')
    } catch (err: any) {
      setErrorMsg(err.message); setStatus('error')
    }
  }

  function downloadSvg(svg: string, idx: number) {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${file?.name.replace(/\.[^.]+$/, '')}_section${idx + 1}.svg`
    a.click(); URL.revokeObjectURL(url)
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function cropImageToBase64(file: File, y1: number, y2: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = y2 - y1
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, y1, img.naturalWidth, y2 - y1, 0, 0, img.naturalWidth, y2 - y1)
        URL.revokeObjectURL(url)
        const dataUrl = canvas.toDataURL('image/png')
        resolve(dataUrl.split(',')[1])
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 크롭 실패')) }
      img.src = url
    })
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
          PNG → <span style={{ color: 'var(--accent)' }}>SVG 템플릿</span> 변환
        </h1>
        <p style={{ color: '#666', marginBottom: 32 }}>이미지를 업로드하고 분할선을 클릭으로 추가하세요. 섹션별로 SVG가 생성돼요.</p>

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
                <p style={{ fontSize: 12, color: '#bbb', marginTop: 6 }}>세로 1800px 초과 시 분할선을 추가해주세요</p>
                <p style={{ fontSize: 12, color: '#f0a070', marginTop: 8, background: '#fff5f0', padding: '6px 14px', borderRadius: 8 }}>
                  💡 1800px 미만 한 장씩 변환 시 품질이 가장 좋아요
                </p>
              </div>
            ) : (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>📐 분할선 설정</span>
                  <button onClick={() => inputRef.current?.click()} style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>다른 파일</button>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 10, padding: '8px 12px', background: '#f8f6f2', borderRadius: 8 }}>
                  💡 클릭 → 분할선 추가 · 드래그 → 위치 조정 · ✕ 버튼 → 삭제
                </div>

                {/* 이미지 미리보기 */}
                <div
                  ref={previewRef}
                  style={{ position: 'relative', width: PREVIEW_WIDTH, cursor: 'crosshair', userSelect: 'none', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}
                  onClick={handlePreviewClick}
                >
                  <img src={imageUrl} style={{ width: PREVIEW_WIDTH, display: 'block' }} alt="미리보기" draggable={false} />

                  {/* 분할선 */}
                  {sortedLines.map((yPx, idx) => {
                    const yScreen = yPx * scale

                    // 이 선 기준 위 섹션 높이
                    const prevY = idx === 0 ? 0 : sortedLines[idx - 1]
                    const heightAbove = yPx - prevY

                    // 이 선 기준 아래 섹션 높이
                    const nextY = idx === sortedLines.length - 1 ? (imageDims?.h || 0) : sortedLines[idx + 1]
                    const heightBelow = nextY - yPx

                    // 위/아래 섹션 각각 독립적으로 초과 여부 판단
                    const isAboveRed = heightAbove > MAX_SECTION_HEIGHT
                    const isBelowRed = heightBelow > MAX_SECTION_HEIGHT

                    const lineColor = isAboveRed ? '#ff4444' : '#22c55e'
                    const aboveColor = isAboveRed ? '#ff4444' : '#22c55e'
                    const belowColor = isBelowRed ? '#ff4444' : '#22c55e'

                    return (
                      <div
                        key={`line-${yPx}`}
                        style={{ position: 'absolute', left: 0, right: 0, top: yScreen - 10, height: 20, cursor: 'ns-resize', zIndex: 10 }}
                        onMouseDown={e => startDrag(e, idx)}
                      >
                        {/* 선 */}
                        <div style={{
                          position: 'absolute', left: 0, right: 0, top: 9, height: 2,
                          background: lineColor,
                          boxShadow: `0 0 6px ${lineColor}`,
                          transition: 'background 0.15s, box-shadow 0.15s',
                        }} />

                        {/* 왼쪽: 위 섹션 높이 */}
                        <div style={{
                          position: 'absolute', left: 6, top: 1,
                          background: aboveColor,
                          borderRadius: 4, padding: '1px 7px',
                          fontSize: 9, color: 'white', fontWeight: 700,
                          fontFamily: 'Space Mono, monospace',
                          transition: 'background 0.15s',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                        }}>
                          ↑ {heightAbove.toLocaleString()}px
                        </div>

                        {/* 가운데: 아래 섹션 높이 */}
                        <div style={{
                          position: 'absolute', left: '50%', top: 1,
                          transform: 'translateX(-50%)',
                          background: belowColor,
                          borderRadius: 4, padding: '1px 7px',
                          fontSize: 9, color: 'white', fontWeight: 700,
                          fontFamily: 'Space Mono, monospace',
                          transition: 'background 0.15s',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                        }}>
                          ↓ {heightBelow.toLocaleString()}px
                        </div>

                        {/* 오른쪽: ✕ 삭제 버튼 */}
                        <div
                          onClick={e => removeLine(e, yPx)}
                          style={{
                            position: 'absolute', right: 6, top: 1,
                            width: 18, height: 18,
                            background: '#333',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: 10, color: 'white', fontWeight: 900,
                            zIndex: 20,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#ff4444')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#333')}
                        >✕</div>
                      </div>
                    )
                  })}
                </div>

                {hasOverflow && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: '#fff5f2', borderRadius: 8, fontSize: 12, color: 'var(--accent)', border: '1px solid #ffc4b3' }}>
                    🔴 1800px 초과 섹션이 있어요. 분할선을 추가하거나 드래그해서 조정해주세요.
                  </div>
                )}

                <div style={{ marginTop: 10, padding: '10px 14px', background: '#f8f6f2', borderRadius: 8, fontSize: 12, color: '#666' }}>
                  총 <strong>{sections.length}개 섹션</strong>
                  {imageDims && <span style={{ color: '#aaa' }}> · 원본 {imageDims.h.toLocaleString()}px</span>}
                  {sections.length > 0 && <span> · <strong style={{ color: 'var(--accent)' }}>{sections.length}크레딧</strong> 차감 예정</span>}
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
                ? <><span className="spinner" style={{ marginRight: 8 }} />변환 중... ({sections.length}개 섹션)</>
                : !file ? '이미지를 먼저 업로드해주세요'
                  : hasOverflow ? '🔴 빨간 섹션을 먼저 분할해주세요'
                    : `✨ ${sections.length}개 섹션 SVG로 변환`}
            </button>
          </div>

          {/* 우측: 결과 */}
          <div>
            {status === 'done' && results.length > 0 ? (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>✅ 변환 완료 ({results.length}개)</span>
                  <button className="btn-primary" style={{ padding: '8px 18px', fontSize: 13 }} onClick={() => results.forEach((svg, i) => downloadSvg(svg, i))}>
                    전체 다운로드 ↓
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {results.map((svg, i) => (
                    <div key={i} style={{ padding: '12px 16px', background: '#f8f6f2', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#555' }}>섹션 {i + 1} · {sections[i]?.height.toLocaleString()}px</span>
                      <button onClick={() => downloadSvg(svg, i)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', padding: '6px 14px', borderRadius: 20, cursor: 'pointer' }}>
                        SVG 다운로드 ↓
                      </button>
                    </div>
                  ))}
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
                  왼쪽에서 이미지를 업로드하고<br />분할선을 추가한 후 변환 버튼을 눌러주세요
                </p>
              </div>
            )}
            <div className="card" style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📌 사용 방법</p>
              <ol style={{ fontSize: 12, color: '#666', lineHeight: 2.2, paddingLeft: 16 }}>
                <li>이미지 업로드</li>
                <li>이미지 클릭 → 분할선 추가</li>
                <li>드래그로 위치 조정</li>
                <li>🟢 초록 = 변환 가능 / 🔴 빨강 = 1800px 초과</li>
                <li>모두 초록이면 변환 버튼 클릭</li>
                <li>SVG 파일 → 피그마에 붙여넣기</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
