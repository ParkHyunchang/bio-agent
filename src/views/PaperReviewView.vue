<template>
  <div class="paper-review" ref="rootEl">

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

    <div class="content">

      <!-- 히스토리 패널 -->
      <aside class="history-panel" :class="{ 'history-panel--collapsed': !historyExpanded }">
        <button class="history-panel__header" @click="historyExpanded = !historyExpanded">
          <span>리뷰 히스토리</span>
          <span class="history-panel__count" v-if="reviewHistory.length > 0">{{ reviewHistory.length }}</span>
          <span class="history-panel__toggle">{{ historyExpanded ? '▲' : '▼' }}</span>
        </button>
        <div class="history-panel__body">
          <div v-if="reviewHistory.length === 0" class="list-empty">
            <p>아직 저장된 리뷰가 없습니다</p>
          </div>
          <div
            v-for="record in reviewHistory"
            :key="record.id"
            class="history-item"
            :class="{ 'history-item--active': selectedHistoryId === record.id }"
            @click="selectHistory(record)"
          >
            <div class="history-item__title">{{ record.paperTitle }}</div>
            <div class="history-item__meta">
              <span v-if="record.queryText" class="history-item__query">{{ record.queryText }}</span>
              <span class="history-item__date">{{ formatDate(record.createdAt) }}</span>
            </div>
            <button class="history-item__delete" @click.stop="deleteReviewHistory(record.id)">삭제</button>
          </div>
        </div>
      </aside>

      <!-- 검색 결과 패널 -->
      <aside class="results-panel">
        <div v-if="!hasSearched && !isSearching" class="panel-empty">
          <div class="panel-empty__icon">📄</div>
          <p>검색어를 입력하면<br>PubMed 논문이 나타납니다</p>
        </div>

        <div v-else-if="isSearching" class="panel-loading">
          <div class="spinner spinner--lg"></div>
          <p>PubMed 검색 중...</p>
        </div>

        <div v-else-if="papers.length === 0" class="panel-empty">
          <div class="panel-empty__icon">🔎</div>
          <p>검색 결과가 없습니다</p>
        </div>

        <template v-else>
          <div v-if="correctedQuery" class="spell-correction">
            <span>'{{ originalQuery }}'를 '<strong>{{ correctedQuery }}</strong>'로 자동 교정하여 검색했습니다.</span>
          </div>

          <div v-if="tooBroad" class="broad-warning">
            <span class="broad-warning__icon">⚠</span>
            <span>검색어가 너무 광범위합니다. 더 구체적으로 입력해 주세요.</span>
          </div>

          <div class="results-header">
            <span class="results-count">총 {{ total.toLocaleString() }}건</span>
            <span class="results-page">{{ currentPage }} / {{ totalPages }}페이지</span>
          </div>

          <ul class="paper-list">
            <li
              v-for="paper in papers"
              :key="paper.pmid"
              class="paper-item"
              :class="{ 'paper-item--active': selectedPmid === paper.pmid && !selectedHistoryId }"
              @click="selectPaper(paper.pmid)"
            >
              <p class="paper-item__title">{{ paper.title }}</p>
              <p class="paper-item__meta">{{ formatAuthors(paper.authors) }}</p>
              <p class="paper-item__journal">{{ paper.journal }} · {{ paper.pubDate }}</p>
            </li>
          </ul>

          <div class="pagination">
            <button class="pg-btn" @click="goToPage(1)" :disabled="currentPage <= 1">«</button>
            <button class="pg-btn" @click="goToPage(currentPage - 1)" :disabled="currentPage <= 1">‹</button>
            <button
              v-for="p in pageNumbers"
              :key="p"
              class="pg-btn pg-btn--num"
              :class="{ 'pg-btn--active': p === currentPage }"
              @click="goToPage(p)"
            >{{ p }}</button>
            <button class="pg-btn" @click="goToPage(currentPage + 1)" :disabled="currentPage >= totalPages">›</button>
            <button class="pg-btn" @click="goToPage(totalPages)" :disabled="currentPage >= totalPages">»</button>
          </div>
        </template>
      </aside>

      <!-- 상세 + AI 리뷰 패널 -->
      <main class="detail-panel">

        <div v-if="!selectedPaper && !isLoadingDetail" class="panel-empty">
          <div class="panel-empty__icon">🧬</div>
          <p>논문을 선택하면<br>상세 정보와 AI 분석을 볼 수 있습니다</p>
        </div>

        <div v-else-if="isLoadingDetail" class="panel-loading">
          <div class="spinner spinner--lg"></div>
          <p>논문 정보 불러오는 중...</p>
        </div>

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

          <div class="abstract-box">
            <div class="abstract-box__label">Abstract</div>
            <pre class="abstract-box__text">{{ selectedPaper.abstractText || '초록 정보가 없습니다.' }}</pre>
          </div>

          <div class="review-section">
            <button class="review-btn" :disabled="isReviewing" @click="generateReview">
              <span v-if="isReviewing" class="spinner"></span>
              <span v-else>✨ AI 요약 생성</span>
            </button>

            <div v-if="review" class="review-result">
              <div class="review-result__label">AI 분석 결과</div>
              <div class="review-result__body" v-html="renderedReview"></div>
            </div>

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

<script setup>
import { ref, onMounted } from 'vue'
import { usePaperSearch } from '@/composables/usePaperSearch'

const rootEl = ref(null)
const historyExpanded = ref(window.innerWidth > 768)

const {
  query, isSearching, hasSearched, papers, total,
  currentPage, tooBroad, correctedQuery, originalQuery,
  selectedPmid, selectedPaper, isLoadingDetail, isReviewing, review,
  totalPages, pageNumbers, renderedReview,
  reviewHistory, selectedHistoryId,
  search, goToPage, selectPaper, generateReview,
  loadReviewHistory, selectHistory, deleteReviewHistory,
  formatAuthors, formatDate
} = usePaperSearch(rootEl)

onMounted(loadReviewHistory)
</script>

<style scoped>
@import '@/assets/css/views/paper-review.css';
</style>
