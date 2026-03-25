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
          templateAI(운영: 배러단)는 회원의 합리적인 서비스 이용을 위해 아래와 같은 환불 정책을 운영합니다.
        </p>

        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', fontSize: 14, marginBottom: 40 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 0', fontWeight: 700, width: '40%', color: '#111' }}>환불 가능 기간</td>
                <td style={{ padding: '10px 0', color: '#555' }}>이용권 구매일로부터 7일 이내</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 0', fontWeight: 700, color: '#111' }}>환불 대상</td>
                <td style={{ padding: '10px 0', color: '#555' }}>미사용 이용권에 한함</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 0', fontWeight: 700, color: '#111' }}>환불 신청 방법</td>
                <td style={{ padding: '10px 0', color: '#555' }}>이메일: bodywick@naver.com</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 0', fontWeight: 700, color: '#111' }}>처리 기간</td>
                <td style={{ padding: '10px 0', color: '#555' }}>영업일 기준 3~5일 (카드사 사정에 따라 상이)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Section title="환불 가능 조건">
          <ul>
            <li>이용권 구매일로부터 7일 이내에 신청한 경우</li>
            <li>환불 신청 시점에 <strong>미사용 상태인 이용권</strong>에 한해 환불됩니다.</li>
            <li>무료로 지급된 이용권(가입 시 제공 5이용권 등)은 환불 대상에서 제외됩니다.</li>
          </ul>
        </Section>

        <Section title="환불 불가 조건">
          <ul>
            <li>구매일로부터 7일이 경과한 이용권</li>
            <li>이미 사용된 이용권 (변환에 사용된 경우)</li>
            <li>무료로 제공된 이용권</li>
            <li>회원의 귀책사유로 인한 서비스 이용 제한 시</li>
          </ul>
        </Section>

        <Section title="환불 신청 방법">
          <p style={{ marginBottom: 12 }}>아래 내용을 포함하여 고객센터 이메일로 문의해 주세요.</p>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', fontSize: 13 }}>
            <div><strong>이메일:</strong> bodywick@naver.com</div>
            <div><strong>제목:</strong> [환불 신청] 가입 이메일 주소</div>
            <div><strong>내용:</strong> 구매일, 구매 이용권 수량, 환불 신청 이용권 수량, 환불 사유</div>
          </div>
          <p style={{ marginTop: 12, fontSize: 13, color: '#888' }}>접수 후 영업일 기준 1~2일 내 처리 여부를 이메일로 안내드립니다.</p>
        </Section>

        <Section title="서비스 장애로 인한 환불">
          회사 귀책 사유(서버 오류, 변환 실패 등)로 이용권이 차감되었으나 서비스가 정상 제공되지 않은 경우, 해당 이용권은 즉시 복구하거나 환불해 드립니다. bodywick@naver.com으로 문의해 주세요.
        </Section>

        <Section title="관련 법령">
          본 환불 정책은 전자상거래 등에서의 소비자보호에 관한 법률 및 콘텐츠산업 진흥법에 따라 운영됩니다.
        </Section>

        <div style={{ marginTop: 48, padding: '24px 0', borderTop: '1px solid var(--border)', fontSize: 13, color: '#999' }}>
          사업자명: 배러단 &nbsp;|&nbsp; 대표자: 장석환 &nbsp;|&nbsp; 사업자등록번호: 594-17-00968<br />
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
