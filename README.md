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
├── axios.js                      # Axios 인스턴스 (baseURL 자동 설정)
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

접속 호스트에 따라 백엔드 URL이 자동으로 결정됩니다.

| 환경 | 프론트 | 백엔드 |
|------|--------|--------|
| 로컬 | localhost:8080 | localhost:3211 |
| NAS  | 125.141.20.218 | 125.141.20.218:3211 |

백엔드가 실행되지 않은 경우 홈 화면에 "서버 대기 중" 상태가 표시됩니다.
