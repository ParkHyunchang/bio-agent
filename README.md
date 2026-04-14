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
│       ├── vars.css      # 다크 그린 테마 CSS 변수
│       ├── reset.css     # CSS 리셋
│       └── fonts.css     # Google Fonts (DM Sans, Montserrat)
├── components/
│   └── AppHeader.vue     # 상단 헤더 (로고 + 네비게이션)
├── views/
│   └── HomeView.vue      # 메인 홈 화면
├── router/
│   └── index.js          # 라우터 설정
├── axios.js              # Axios 인스턴스 (baseURL 자동 설정)
├── App.vue
└── main.js
```

## 백엔드 연결

접속 호스트에 따라 백엔드 URL이 자동으로 결정됩니다.

| 환경 | 프론트 | 백엔드 |
|------|--------|--------|
| 로컬 | localhost:8080 | localhost:3211 |
| NAS  | 125.141.20.218 | 125.141.20.218:3211 |

백엔드가 실행되지 않은 경우 홈 화면에 "서버 대기 중" 상태가 표시됩니다.
