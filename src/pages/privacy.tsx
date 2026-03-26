import Navbar from '../components/Navbar'
import type { Session } from '@supabase/supabase-js'

interface Props { session: Session | null }

export default function PrivacyPage({ session }: Props) {
  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '100px 32px 80px', lineHeight: 1.9, color: '#333' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>개인정보처리방침</h1>
        <p style={{ color: '#999', fontSize: 13, marginBottom: 48 }}>시행일: 2025년 1월 1일</p>

        <p style={{ fontSize: 14, color: '#555', marginBottom: 40 }}>
          배러댄(이하 "회사")은 개인정보보호법에 따라 회원의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립합니다.
        </p>

        <Section title="제1조 (수집하는 개인정보 항목)">
          <ul>
            <li><strong>필수항목:</strong> 이메일 주소, 비밀번호(암호화 저장)</li>
            <li><strong>선택 항목:</strong> 결제 관련 정보 (카드 번호는 PG사에서 직접 처리하며 회사는 저장하지 않음)</li>
            <li><strong>자동 수집:</strong> 서비스 이용 기록, 접속 IP, 쿠키</li>
          </ul>
        </Section>

        <Section title="제2조 (개인정보의 수집 및 이용 목적)">
          <ul>
            <li>회원 관리 및 서비스 이용 확인</li>
            <li>결제 처리 및 크레딧 관리</li>
            <li>서비스 관련 공지 및 소모 처리</li>
            <li>서비스 개선 및 통계 분석</li>
          </ul>
        </Section>

        <Section title="제3조 (개인정보의 보유 및 이용 기간)">
          <ul>
            <li>회원 탈퇴 시까지 보유하며, 탈퇴 시 즉시 파기합니다.</li>
            <li>단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</li>
            <li>전자상거래 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
            <li>접속 로그: 3개월 (통신비밀보호법)</li>
          </ul>
        </Section>

        <Section title="제4조 (개인정보의 제3자 제공)">
          <ul>
            <li>회사는 원칙적으로 회원의 개인정보를 외부에 제공하지 않습니다.</li>
            <li>예외: 회원이 사전에 동의한 경우, 법령에 따라 수사기관의 요청이 있는 경우</li>
          </ul>
        </Section>

        <Section title="제5조 (업로드 이미지 처리)">
          <ul>
            <li>회원이 업로드한 이미지는 SVG 변환 목적으로만 사용됩니다.</li>
            <li>변환 완료 후 업로드 이미지는 시스템에서 자동 삭제됩니다.</li>
            <li>이미지는 AI 모델 학습에 사용되지 않습니다.</li>
          </ul>
        </Section>

        <Section title="제6조 (개인정보 보호 책임자)">
          <ul>
            <li>이름: 장석환</li>
            <li>이메일: bodywick@naver.com</li>
          </ul>
        </Section>

        <Section title="제7조 (회원의 권리)">
          회원은 언제든지 자신의 개인정보에 대한 열람, 수정, 삭제, 처리 정지를 요청할 수 있습니다. 요청은 개인정보 보호 책임자(bodywick@naver.com)에게 연락하시기 바랍니다.
        </Section>

        <Section title="제8조 (쿠키 정책)">
          서비스는 로그인 상태 유지 및 서비스 품질 향상을 위해 쿠키를 사용합니다. 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으며, 이 경우 일부 서비스 이용이 제한될 수 있습니다.
        </Section>

        <div style={{ marginTop: 48, padding: '24px 0', borderTop: '1px solid var(--border)', fontSize: 13, color: '#999' }}>
          상호명: 배러댄 &nbsp;|&nbsp; 대표자: 장석환 &nbsp;|&nbsp; 사업자등록번호: 594-17-00968<br />
          주소: 경기도 남양주시 진건읍 양진로 375-81 &nbsp;|&nbsp; 고객센터: bodywick@naver.com
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
