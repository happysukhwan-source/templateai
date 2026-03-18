import Navbar from '../components/Navbar'
import type { Session } from '@supabase/supabase-js'

interface Props { session: Session | null }

export default function RefundPage({ session }: Props) {
  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '100px 32px 80px', lineHeight: 1.9, color: '#333' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>환불 정책</h1>
        <p style={{ color: '#999', fontSize: 13, marginBottom: 48 }}>시행일: 2025년 1월 1일</p>

        <p style={{ fontSize: 14, color: '#555', marginBottom: 40 }}>
          templateAI(운영: 배러댄)은 회원의 원활한 서비스 이용을 위해 아래와 같은 환불 정책을 운영합니다.
        </p>

        <Section title="환불 가능 기간">
          크레딧 구매일로부터 <strong>7일 이내</strong>
        </Section>

        <Section title="환불 가능한 경우">
          <ul>
            <li>크레딧 구매일로부터 7일 이내에 요청한 경우</li>
            <li>환불 요청 시점의 <strong>미사용 잔여 크레딧</strong>에 한해 환불됩니다.</li>
            <li>무료로 지급된 크레딧(가입 시 지급 5크레딧 등)은 환불 대상에서 제외됩니다.</li>
          </ul>
        </Section>

        <Section title="환불 불가한 경우">
          <ul>
            <li>구매일로부터 7일이 경과한 크레딧</li>
            <li>이미 사용된 크레딧 (변환에 사용 완료)</li>
            <li>이벤트로 지급된 크레딧</li>
            <li>회원의 귀책사유로 인한 서비스 이용 제한 등</li>
          </ul>
        </Section>

        <Section title="환불 처리 기간">
          영업일 기준 3~5일 (카드사의 정책에 따라 다름)
        </Section>

        <Section title="환불 요청 방법">
          <p style={{ marginBottom: 12 }}>아래 양식에 맞추어 고객센터 이메일로 발송해 주세요.</p>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', fontSize: 13 }}>
            <div><strong>이메일:</strong> bodywick@naver.com</div>
            <div><strong>제목:</strong> [환불 요청] 가입 이메일 주소</div>
            <div><strong>내용:</strong> 구매일시, 구매 크레딧 개수, 환불 요청 크레딧 개수, 환불 이유</div>
          </div>
          <p style={{ marginTop: 12, fontSize: 13, color: '#888' }}>영업일 기준 1~2일 내 처리 여부를 이메일로 안내드립니다.</p>
        </Section>

        <Section title="특별 사유에 의한 환불">
          회사 귀책 사유(시스템 오류, 변환 기능 오류 등)로 크레딧이 차감되었으나 서비스가 정상 제공되지 않은 경우, 해당 크레딧을 전부 복원하거나 환불해 드립니다. bodywick@naver.com으로 연락해 주세요.
        </Section>

        <Section title="관련 법령">
          이 환불 정책은 전자상거래 등에서의 소비자보호에 관한 법률에 따라 법령이 정하는 범위 내에서 운영됩니다.
        </Section>

        <div style={{ marginTop: 48, padding: '24px 0', borderTop: '1px solid var(--border)', fontSize: 13, color: '#999' }}>
          상호명: 배러댄 &nbsp;|&nbsp; 대표자: 장석환 &nbsp;|&nbsp; 사업자등록번호: 594-17-00968<br />
          주소: 경기도 남양주시 진건읍 양진로 371-8 &nbsp;|&nbsp; 고객센터: bodywick@naver.com
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#111' }}>{title}</h2>
      <div style={{ fontSize: 14, color: '#555', lineHeight: 1.9 }}>
        {children}
      </div>
    </div>
  )
}
