# Bio Agent — Frontend

Vue.js 3 기반 바이오 AI 에이전트 플랫폼 프론트엔드.

## 기술 스택

- **Vue 3** + Vue Router
- **Axios** (HTTP 클라이언트)
- **Vue CLI** (빌드 도구)
- **Nginx** (프로덕션 서빙)

## 시작하기

### 의존성 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run serve
```

→ http://localhost:8080

백엔드(`bio-agent-back`)가 먼저 실행되어 있어야 합니다.

### 프로덕션 빌드

```bash
npm run build
```

빌드 결과물은 `dist/` 디렉토리에 생성됩니다.

## 프로젝트 구조

```
src/
├── assets/
│   └── css/base/
│       ├── vars.css              # 다크 그린 테마 CSS 변수
│       ├── reset.css             # CSS 리셋
│       └── fonts.css             # Google Fonts (DM Sans, Montserrat)
├── components/
│   └── AppHeader.vue             # 상단 헤더 (로고 + 네비게이션)
├── views/
│   ├── HomeView.vue              # 메인 홈 화면
│   └── PaperReviewView.vue       # 논문 리뷰 페이지
├── router/
│   └── index.js                  # 라우터 설정
├── axios.js                      # Axios 인스턴스 (baseURL: env > 호스트 폴백)
├── App.vue
└── main.js
```

## 페이지

| 경로 | 설명 |
|------|------|
| `/` | 홈 — 서비스 소개 및 기능 카드 |
| `/paper-review` | 논문 리뷰 — PubMed 검색 + Claude AI 요약 |

### 논문 리뷰 (`/paper-review`)

1. 상단 검색창에 키워드 입력 (예: `BRCA2`, `Alzheimer`, `CRISPR-Cas9`)
2. PubMed에서 논문 검색
3. 왼쪽 목록에서 논문 선택 → 오른쪽에 초록 표시
4. **AI 요약 생성** 버튼 클릭 → Claude가 한국어로 분석 요약

#### 검색 팁 — PubMed 필드 태그

PubMed E-utilities 문법을 그대로 지원합니다. 자주 쓰는 패턴:

| 검색어 예시 | 의미 |
|---|---|
| `BRCA2` | 모든 필드(제목·초록·저자 등)에서 검색 |
| `cancer[Title]` | 제목에만 `cancer` 들어간 논문 |
| `Smith J[Author]` | 저자 검색 |
| `Nature[Journal]` | 저널명 검색 |
| `cancer[Title] AND 2024[Year]` | 제목 + 연도 조합 |

#### 논문 본문(Full Text)까지 분석하려면

기본 검색은 PubMed 초록만 잡히고, AI 요약도 초록 기반으로 동작합니다.
**PMC(PubMed Central)에 풀텍스트가 등재된 오픈액세스 논문**만 골라서 검색하려면 `pubmed pmc[sb]` 필터를 붙이세요:

```
cancer[Title] AND pubmed pmc[sb]
```

이렇게 검색하면:
- 결과 목록의 논문은 모두 PMC 풀텍스트 보유 → 상세 패널에 **`PMC 본문 ↗`** 배지 표시
- AI 요약 버튼이 **"✨ AI 요약 생성 (PMC 본문 분석)"** 으로 바뀌고, Claude가 초록이 아닌 **본문 전체**를 읽고 더 깊이 있게 요약

> 🔎 일반 키워드 검색에서도 PMC 등재된 논문은 자동으로 본문 분석으로 동작합니다. 위 필터는 "본문이 있는 논문만 보고 싶을 때" 쓰는 옵션입니다.

## 백엔드 연결

백엔드 URL은 빌드 타임 환경변수 `VUE_APP_API_URL`로 결정됩니다.

| 파일 | 값 | 적용 시점 |
|------|----|----------|
| `.env.development` | `http://localhost:3211` | `npm run serve` |
| `.env.production`  | `https://hyunchang.synology.me:3213` | `npm run build` |

운영은 Synology 역방향 프록시(3213, HTTPS)를 통해 백엔드(3211)로 전달됩니다. env 미설정 시에는 호스트명을 보고 localhost 또는 `https://hyunchang.synology.me:3213` 으로 폴백합니다.

백엔드가 실행되지 않은 경우 홈 화면에 "서버 대기 중" 상태가 표시됩니다.

## 배포 (Nginx)

`nginx.conf`는 두 가지 캐시 정책을 갖습니다:

- **해시 붙은 정적 자산**(`*.js`, `*.css`, 폰트, 이미지 등): `Cache-Control: public, immutable` + 1년. 파일명 hash가 바뀌면 브라우저가 자동으로 새 버전을 받습니다.
- **HTML / SPA 라우팅**: `expires -1` — 캐시 금지. 새 배포가 즉시 반영됩니다.
