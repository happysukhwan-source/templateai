import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        {/* 네이버 사이트 소유 확인 메타 태그 */}
        <meta name="naver-site-verification" content="02f75f4b20f91b5ad298dd48fa69c6b598b6fc0b" />
        
        {/* 기타 기본 웹 폰트 및 메타 태그 (필요시 추가) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
