import { GetServerSideProps } from 'next'

const BASE_URL = 'https://www.templateai.shop'
const SITE_TITLE = 'templateAI - 상세페이지 피그마 템플릿 자동 변환'
const SITE_DESCRIPTION = '상세페이지 이미지를 올리면 30초 만에 편집 가능한 피그마 템플릿으로 변환. AI가 자동으로 만들어드립니다.'

const pages = [
  {
    path: '/',
    title: '상세페이지 피그마 템플릿 자동 변환 | templateAI',
    description: '상세페이지 이미지를 올리면 30초 만에 편집 가능한 피그마 템플릿으로 변환. 스마트스토어·쿠팡 셀러 필수 도구.',
  },
  {
    path: '/pricing',
    title: '요금제 | templateAI',
    description: 'templateAI 요금제 안내. 합리적인 가격으로 AI 상세페이지 변환 서비스를 이용하세요.',
  },
  {
    path: '/terms',
    title: '이용약관 | templateAI',
    description: 'templateAI 서비스 이용약관',
  },
  {
    path: '/privacy',
    title: '개인정보처리방침 | templateAI',
    description: 'templateAI 개인정보처리방침',
  },
  {
    path: '/refund',
    title: '환불정책 | templateAI',
    description: 'templateAI 환불 및 취소 정책 안내',
  },
]

function generateRss() {
  const pubDate = new Date().toUTCString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_TITLE}</title>
    <link>${BASE_URL}</link>
    <description>${SITE_DESCRIPTION}</description>
    <language>ko</language>
    <lastBuildDate>${pubDate}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${pages
  .map(
    ({ path, title, description }) => `    <item>
      <title>${title}</title>
      <link>${BASE_URL}${path}</link>
      <description>${description}</description>
      <guid isPermaLink="true">${BASE_URL}${path}</guid>
      <pubDate>${pubDate}</pubDate>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>`
}

function RssXml() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate')
  res.write(generateRss())
  res.end()
  return { props: {} }
}

export default RssXml
