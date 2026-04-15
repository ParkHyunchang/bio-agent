<template>
  <div class="paper-review">

    <!-- 검색 바 -->
    <div class="search-bar">
      <div class="search-bar__inner">
        <span class="search-bar__icon">🔍</span>
        <input
          v-model="query"
          class="search-bar__input"
          type="text"
          placeholder="키워드 입력 (예: BRCA2, Alzheimer, CRISPR-Cas9)..."
          @keyup.enter="search"
        />
        <button class="search-bar__btn" :disabled="isSearching || !query.trim()" @click="search">
          <span v-if="isSearching" class="spinner"></span>
          <span v-else>검색</span>
        </button>
      </div>
    </div>

    <!-- 본문 -->
    <div class="content">

      <!-- 왼쪽: 검색 결과 목록 -->
      <aside class="results-panel">
        <!-- 초기 상태 -->
        <div v-if="!hasSearched && !isSearching" class="panel-empty">
          <div class="panel-empty__icon">📄</div>
          <p>검색어를 입력하면<br>PubMed 논문이 나타납니다</p>
        </div>

        <!-- 로딩 -->
        <div v-else-if="isSearching" class="panel-loading">
          <div class="spinner spinner--lg"></div>
          <p>PubMed 검색 중...</p>
        </div>

        <!-- 결과 없음 -->
        <div v-else-if="papers.length === 0" class="panel-empty">
          <div class="panel-empty__icon">🔎</div>
          <p>검색 결과가 없습니다</p>
        </div>

        <!-- 결과 목록 -->
        <template v-else>
          <div class="results-header">
            <span class="results-count">{{ papers.length }}건</span>
          </div>
          <ul class="paper-list">
            <li
              v-for="paper in papers"
              :key="paper.pmid"
              class="paper-item"
              :class="{ 'paper-item--active': selectedPmid === paper.pmid }"
              @click="selectPaper(paper.pmid)"
            >
              <p class="paper-item__title">{{ paper.title }}</p>
              <p class="paper-item__meta">
                {{ formatAuthors(paper.authors) }}
              </p>
              <p class="paper-item__journal">{{ paper.journal }} · {{ paper.pubDate }}</p>
            </li>
          </ul>
        </template>
      </aside>

      <!-- 오른쪽: 논문 상세 + AI 리뷰 -->
      <main class="detail-panel">

        <!-- 미선택 상태 -->
        <div v-if="!selectedPaper && !isLoadingDetail" class="panel-empty">
          <div class="panel-empty__icon">🧬</div>
          <p>논문을 선택하면<br>상세 정보와 AI 분석을 볼 수 있습니다</p>
        </div>

        <!-- 상세 로딩 -->
        <div v-else-if="isLoadingDetail" class="panel-loading">
          <div class="spinner spinner--lg"></div>
          <p>논문 정보 불러오는 중...</p>
        </div>

        <!-- 논문 상세 -->
        <div v-else-if="selectedPaper" class="paper-detail">
          <div class="paper-detail__header">
            <h2 class="paper-detail__title">{{ selectedPaper.title }}</h2>
            <div class="paper-detail__badges">
              <span class="badge">{{ selectedPaper.journal }}</span>
              <span class="badge badge--muted">{{ selectedPaper.pubDate }}</span>
              <a
                :href="`https://pubmed.ncbi.nlm.nih.gov/${selectedPaper.pmid}`"
                target="_blank"
                rel="noopener"
                class="badge badge--link"
              >PubMed ↗</a>
            </div>
            <p class="paper-detail__authors">{{ selectedPaper.authors.join(', ') }}</p>
          </div>

          <!-- 초록 -->
          <div class="abstract-box">
            <div class="abstract-box__label">Abstract</div>
            <pre class="abstract-box__text">{{ selectedPaper.abstractText || '초록 정보가 없습니다.' }}</pre>
          </div>

          <!-- AI 리뷰 섹션 -->
          <div class="review-section">
            <button
              class="review-btn"
              :disabled="isReviewing"
              @click="generateReview"
            >
              <span v-if="isReviewing" class="spinner"></span>
              <span v-else>✨ AI 요약 생성</span>
            </button>

            <!-- 리뷰 결과 -->
            <div v-if="review" class="review-result">
              <div class="review-result__label">AI 분석 결과</div>
              <div class="review-result__body" v-html="renderedReview"></div>
            </div>

            <!-- 리뷰 로딩 -->
            <div v-if="isReviewing" class="review-loading">
              <div class="spinner spinner--lg"></div>
              <p>Claude가 논문을 분석하고 있습니다...</p>
            </div>
          </div>
        </div>

      </main>
    </div>
  </div>
</template>

<script>
import axios from '@/axios'

export default {
  name: 'PaperReviewView',
  data() {
    return {
      query: '',
      isSearching: false,
      hasSearched: false,
      papers: [],
      selectedPmid: null,
      selectedPaper: null,
      isLoadingDetail: false,
      isReviewing: false,
      review: null,
    }
  },
  computed: {
    renderedReview() {
      if (!this.review) return ''
      return this.review
        .split('\n')
        .map(line => {
          if (line.startsWith('## ')) return `<h3 class="rv-h3">${line.slice(3)}</h3>`
          if (line.startsWith('### ')) return `<h4 class="rv-h4">${line.slice(4)}</h4>`
          if (line.startsWith('- ') || line.startsWith('* ')) return `<li class="rv-li">${line.slice(2)}</li>`
          if (line.trim() === '') return '<div class="rv-gap"></div>'
          return `<p class="rv-p">${line}</p>`
        })
        .join('')
    }
  },
  methods: {
    async search() {
      if (!this.query.trim() || this.isSearching) return
      this.isSearching = true
      this.hasSearched = true
      this.papers = []
      this.selectedPaper = null
      this.selectedPmid = null
      this.review = null
      try {
        const res = await axios.get('/api/papers/search', {
          params: { query: this.query.trim(), maxResults: 10 }
        })
        this.papers = res.data
      } catch (e) {
        console.error('검색 오류', e)
      } finally {
        this.isSearching = false
      }
    },

    async selectPaper(pmid) {
      if (this.selectedPmid === pmid) return
      this.selectedPmid = pmid
      this.selectedPaper = null
      this.review = null
      this.isLoadingDetail = true
      try {
        const res = await axios.get(`/api/papers/${pmid}`)
        this.selectedPaper = res.data
        // 모바일: 상세 패널로 자동 스크롤
        if (window.innerWidth <= 768) {
          this.$nextTick(() => {
            this.$el.querySelector('.detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          })
        }
      } catch (e) {
        console.error('논문 상세 조회 오류', e)
      } finally {
        this.isLoadingDetail = false
      }
    },

    async generateReview() {
      if (!this.selectedPaper || this.isReviewing) return
      this.isReviewing = true
      this.review = null
      try {
        const res = await axios.post('/api/papers/review', { pmid: this.selectedPaper.pmid })
        this.review = res.data.review
      } catch (e) {
        console.error('AI 리뷰 오류', e)
        this.review = 'AI 분석 중 오류가 발생했습니다.'
      } finally {
        this.isReviewing = false
      }
    },

    formatAuthors(authors) {
      if (!authors || authors.length === 0) return ''
      if (authors.length <= 3) return authors.join(', ')
      return authors.slice(0, 3).join(', ') + ' et al.'
    }
  }
}
</script>

<style scoped>
.paper-review {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  overflow: hidden;
}

/* ===== 검색 바 ===== */
.search-bar {
  padding: 1.25rem 2rem;
  border-bottom: 1px solid var(--card-border);
  background: var(--surface);
  flex-shrink: 0;
}

.search-bar__inner {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 0.5rem 0.75rem 0.5rem 1rem;
  transition: border-color 0.2s;
}

.search-bar__inner:focus-within {
  border-color: var(--card-border-strong);
}

.search-bar__icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.search-bar__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-family: inherit;
}

.search-bar__input::placeholder {
  color: var(--text-muted);
}

.search-bar__btn {
  padding: 0.45rem 1.2rem;
  background: var(--accent);
  color: #080d0b;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
  transition: opacity 0.2s;
}

.search-bar__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== 본문 2단 레이아웃 ===== */
.content {
  flex: 1;
  display: grid;
  grid-template-columns: 360px 1fr;
  overflow: hidden;
}

/* ===== 왼쪽 패널 ===== */
.results-panel {
  border-right: 1px solid var(--card-border);
  overflow-y: auto;
  background: var(--surface);
}

.results-header {
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--card-border);
  display: flex;
  align-items: center;
}

.results-count {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 500;
}

.paper-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.paper-item {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--card-border);
  cursor: pointer;
  transition: background 0.15s;
}

.paper-item:hover {
  background: var(--surface-2);
}

.paper-item--active {
  background: var(--accent-dim);
  border-left: 3px solid var(--accent);
}

.paper-item__title {
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.5;
  margin-bottom: 0.35rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.paper-item--active .paper-item__title {
  color: var(--accent-light);
}

.paper-item__meta {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-bottom: 0.2rem;
}

.paper-item__journal {
  font-size: 0.75rem;
  color: var(--accent);
  opacity: 0.7;
}

/* ===== 오른쪽 패널 ===== */
.detail-panel {
  overflow-y: auto;
  padding: 2rem;
  background: var(--primary);
}

.paper-detail {
  max-width: 760px;
}

.paper-detail__header {
  margin-bottom: 1.5rem;
}

.paper-detail__title {
  font-family: "Montserrat", sans-serif;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.5;
  margin-bottom: 0.75rem;
}

.paper-detail__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.badge {
  padding: 0.2rem 0.65rem;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  font-size: 0.75rem;
  color: var(--accent);
  background: var(--accent-dim);
}

.badge--muted {
  color: var(--text-muted);
  background: transparent;
}

.badge--link {
  color: var(--accent);
  text-decoration: none;
  transition: border-color 0.2s;
}

.badge--link:hover {
  border-color: var(--accent);
}

.paper-detail__authors {
  font-size: 0.82rem;
  color: var(--text-muted);
  line-height: 1.6;
}

/* ===== 초록 박스 ===== */
.abstract-box {
  background: var(--surface-2);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.abstract-box__label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 0.75rem;
}

.abstract-box__text {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.8;
  white-space: pre-wrap;
  font-family: "DM Sans", sans-serif;
  max-height: 280px;
  overflow-y: auto;
}

/* ===== AI 리뷰 ===== */
.review-section {
  margin-top: 0.5rem;
}

.review-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.5rem;
  background: var(--accent-dim);
  border: 1px solid var(--card-border-strong);
  border-radius: 8px;
  color: var(--accent);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  font-family: inherit;
}

.review-btn:hover:not(:disabled) {
  background: rgba(78, 202, 139, 0.2);
  border-color: var(--accent);
}

.review-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.review-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.review-result {
  margin-top: 1.25rem;
  background: var(--surface-2);
  border: 1px solid var(--card-border-strong);
  border-radius: 10px;
  padding: 1.5rem;
}

.review-result__label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1rem;
}

.review-result__body {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.8;
}

/* ===== 빈 상태 / 로딩 공통 ===== */
.panel-empty,
.panel-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  gap: 0.75rem;
  color: var(--text-muted);
  font-size: 0.875rem;
  text-align: center;
  line-height: 1.7;
}

.panel-empty__icon {
  font-size: 2rem;
  opacity: 0.5;
}

/* ===== 스피너 ===== */
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(78, 202, 139, 0.3);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner--lg {
  width: 24px;
  height: 24px;
  border-width: 3px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== 리뷰 마크다운 스타일 ===== */
:deep(.rv-h3) {
  font-family: "Montserrat", sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--accent);
  margin: 1.2rem 0 0.4rem;
}

:deep(.rv-h4) {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0.8rem 0 0.3rem;
}

:deep(.rv-p) {
  margin: 0.2rem 0;
}

:deep(.rv-li) {
  list-style: disc;
  margin-left: 1.2rem;
  margin-top: 0.2rem;
}

:deep(.rv-gap) {
  height: 0.5rem;
}

/* ===== 반응형 (태블릿/모바일) ===== */
@media (max-width: 768px) {
  /* 고정 높이 해제 → 자연스러운 스크롤 */
  .paper-review {
    height: auto;
    min-height: calc(100vh - 60px);
    overflow: visible;
  }

  .content {
    flex: none;
    height: auto;
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    overflow: visible;
  }

  /* 결과 패널: 최대 높이 제한 후 내부 스크롤 */
  .results-panel {
    border-right: none;
    border-bottom: 1px solid var(--card-border);
    max-height: 45vh;
    overflow-y: auto;
  }

  /* 상세 패널: 자연 높이로 펼침 */
  .detail-panel {
    overflow: visible;
    padding: 1.5rem;
  }

  .panel-empty,
  .panel-loading {
    min-height: 160px;
  }
}

/* ===== 소형 모바일 (≤480px) ===== */
@media (max-width: 480px) {
  .search-bar {
    padding: 0.75rem 1rem;
  }

  /* 검색창: 버튼을 아래로 내림 */
  .search-bar__inner {
    flex-wrap: wrap;
    padding: 0.6rem 0.75rem;
    gap: 0.5rem;
  }

  .search-bar__icon {
    display: none;
  }

  .search-bar__btn {
    width: 100%;
    justify-content: center;
    padding: 0.55rem;
  }

  .paper-detail__title {
    font-size: 1.05rem;
  }

  .abstract-box__text {
    font-size: 0.825rem;
    max-height: 200px;
  }

  /* AI 요약 버튼: 전체 너비 */
  .review-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
