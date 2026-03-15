# templateAI 🎨
> PNG 상세페이지 → 피그마 편집 가능한 SVG 템플릿 자동 변환 서비스

---

## 🚀 Antigravity에서 시작하기

### 1단계 - 이 폴더를 Antigravity에서 열기
```
File > Open Folder > templateai 폴더 선택
```

### 2단계 - 패키지 설치
터미널에서:
```bash
npm install
```

### 3단계 - 환경변수 설정
`.env.example` 파일을 `.env.local`로 복사 후 값 입력:
```bash
cp .env.example .env.local
```

**.env.local에 채워야 할 값들:**

#### A) Anthropic API 키
1. https://console.anthropic.com 접속
2. API Keys 메뉴에서 새 키 생성
3. `ANTHROPIC_API_KEY=sk-ant-...` 입력

#### B) Supabase (무료)
1. https://supabase.com 에서 새 프로젝트 생성
2. Settings > API에서 URL과 anon key 복사
3. SQL Editor에서 아래 테이블 생성:

```sql
-- profiles 테이블
create table profiles (
  id uuid references auth.users primary key,
  email text,
  free_credits int default 5,
  paid_credits int default 0,
  created_at timestamp default now()
);

-- conversions 테이블
create table conversions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  original_filename text,
  svg_result text,
  is_free boolean default true,
  created_at timestamp default now()
);

-- payments 테이블
create table payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  order_id text,
  payment_key text,
  amount int,
  credits_added int,
  created_at timestamp default now()
);
```

#### C) 토스페이먼츠 (결제, 나중에 추가)
1. https://developers.tosspayments.com 가입
2. 테스트 키로 먼저 테스트 가능
3. 사업자 등록 후 실제 키로 전환

### 4단계 - 개발 서버 시작
```bash
npm run dev
```
브라우저에서 http://localhost:3000 열기

---

## 📁 파일 구조

```
templateai/
├── src/
│   ├── pages/
│   │   ├── index.tsx          ← 랜딩페이지
│   │   ├── convert.tsx        ← 핵심 변환 페이지
│   │   ├── pricing.tsx        ← 요금제 페이지
│   │   ├── login.tsx          ← 로그인
│   │   ├── signup.tsx         ← 회원가입
│   │   ├── payment/
│   │   │   └── success.tsx    ← 결제 완료
│   │   └── api/
│   │       ├── convert.ts     ← 변환 API (핵심!)
│   │       └── payment/
│   │           └── confirm.ts ← 결제 승인 API
│   ├── components/
│   │   └── Navbar.tsx         ← 상단 네비게이션
│   ├── lib/
│   │   └── supabase.ts        ← Supabase 클라이언트
│   └── styles/
│       └── globals.css        ← 전역 스타일
├── .env.example               ← 환경변수 템플릿
├── package.json
└── README.md
```

---

## 💰 비용 구조

| 항목 | 비용 |
|---|---|
| Claude API (변환 1건) | 약 ₩15~20 |
| Supabase | 무료 (월 50만 건) |
| Vercel 배포 | 무료 |
| 고객 결제 (건당) | ₩990 |
| **마진** | **약 97%** |

---

## 🌐 배포 (Vercel)
```bash
npm install -g vercel
vercel
```
환경변수는 Vercel 대시보드 > Settings > Environment Variables에 동일하게 입력

---

## 📞 도움이 필요하면
Claude에게 물어보세요! 이 코드에 대한 모든 질문에 답해드릴 수 있어요.
