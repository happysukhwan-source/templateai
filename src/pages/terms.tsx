import Navbar from '../components/Navbar'
import type { Session } from '@supabase/supabase-js'

interface Props { session: Session | null }

export default function TermsPage({ session }: Props) {
  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '100px 32px 80px', lineHeight: 1.9, color: '#333' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>이용약관</h1>
        <p style={{ color: '#999', fontSize: 13, marginBottom: 48 }}>시행일: 2025년 1월 1일</p>

        <Section title="제1조 (목적)">
          이 약관은 배러댄(이하 "회사")이 운영하는 templateAI(이하 "서비스")의 이용 조건 및 절차, 회사와 회원의 권리·의무 및 책임사항 및 기타 필요한 사항을 규정합니다.
        </Section>

        <Section title="제2조 (정의)">
          <ul>
            <li>"서비스"란 회원이 업로드하는 PNG/JPG 이미지를 피그마 편집 가능한 SVG 파일로 변환하는 AI 기반 서비스를 말합니다.</li>
            <li>"회원"이란 이 약관에 동의하고 서비스를 이용하는 자를 말합니다.</li>
            <li>"크레딧"이란 서비스 이용을 위한 가상의 결제 단위를 말합니다.</li>
          </ul>
        </Section>

        <Section title="제3조 (약관의 효력 및 변경)">
          <ul>
            <li>이 약관은 서비스를 이용하고자 하는 모든 회원에게 적용됩니다.</li>
            <li>회사는 필요한 경우 약관의 내용을 변경할 수 있으며, 변경 시 사전에 서비스 내 공지로 알려드립니다.</li>
            <li>약관의 변경에 동의하지 않는 경우 회원은 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="제4조 (서비스 이용)">
          <ul>
            <li>서비스는 회원가입 후 이용 가능하며, 가입 시 모든 회원에게 5크레딧이 무료로 제공됩니다.</li>
            <li>이미지 길이에 따라 1회 변환 시 1~2크레딧이 차감됩니다. (원본 세로 5,000px 이상은 2크레딧, 미만은 1크레딧)</li>
            <li>1크레딧의 구매 금액은 600원입니다.</li>
            <li>회사는 서비스 품질 향상 및 정책에 따라 서비스를 일시 중단할 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="제5조 (크레딧 결제 및 환불 방침)">
          <ul>
            <li>크레딧은 신용카드 등을 통해 구매할 수 있습니다.</li>
            <li>구매한 크레딧 중 미사용 크레딧은 구매일로부터 7일 이내에 전액 환불 요청이 가능합니다.</li>
            <li>이미 사용된 크레딧은 환불되지 않습니다.</li>
            <li>환불은 원래 결제수단으로 반환되며, 처리 기간은 카드사에 따라 영업일 기준 3~5일이 소요될 수 있습니다.</li>
            <li>환불 문의: bodywick@naver.com</li>
          </ul>
        </Section>

        <Section title="제6조 (회원의 의무)">
          <ul>
            <li>회원은 타인의 저작권을 침해하는 이미지를 업로드해서는 안 됩니다.</li>
            <li>회원은 서비스를 이용한 결과물을 비합법적으로 활용할 수 없으며, 이에 대한 법적 책임은 회원 본인에게 있습니다.</li>
            <li>회원은 서비스 이용 권한을 타인에게 양도하거나 판매할 수 없습니다.</li>
          </ul>
        </Section>

        <Section title="제7조 (회사의 책임)">
          <ul>
            <li>회사는 AI 변환 결과의 품질이 기대와 정확히 일치하지 않을 수 있습니다.</li>
            <li>회사는 업로드된 이미지에 포함된 저작권 관련 문제에 대해 책임을 지지 않습니다.</li>
            <li>천재지변, 서비스 장애 등 불가항력적 원인에 의한 서비스 중단에 대해 회사의 책임이 없습니다.</li>
          </ul>
        </Section>

        <Section title="제8조 (분쟁 해결)">
          이 약관의 해석이나 적용에 관해 회사와 회원간에 분쟁이 발생할 경우 관할 법원을 통해 해결합니다.
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
