<template>
  <div class="paper-review" ref="rootEl">

    <div class="search-bar">
      <div class="search-bar__inner">
        <span class="search-bar__icon">🔍</span>
        <input
          v-model="query"
          ref="searchInputEl"
          class="search-bar__input"
          type="text"
          placeholder="키워드 입력 (예: BRCA2, Alzheimer, CRISPR-Cas9)..."
          @keyup.enter="search"
        />
        <button
          v-if="query"
          class="search-bar__clear"
          @click="clearSearch"
          title="검색어 지우기 (Esc)"
        >×</button>
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
              <a
                v-if="selectedPaper.pmcid"
                :href="`https://www.ncbi.nlm.nih.gov/pmc/articles/${selectedPaper.pmcid}/`"
                target="_blank"
                rel="noopener"
                class="badge badge--link badge--accent"
                title="PMC 오픈액세스 본문 사용 가능"
              >PMC 본문 ↗</a>
              <a
                v-if="selectedPaper.pmcid"
                :href="pmcPdfHref"
                target="_blank"
                rel="noopener"
                class="badge badge--link badge--accent"
                title="PMC 원문 PDF 다운로드"
              >📥 PDF ↗</a>
            </div>
            <p class="paper-detail__authors">{{ selectedPaper.authors.join(', ') }}</p>
            <p v-if="!selectedPaper.pmcid" class="paper-detail__no-pdf" title="저작권 보호로 PubMed는 원문 PDF를 직접 제공하지 않습니다">
              ℹ PMC 미등재 — 원문 PDF는 PubMed에서 직접 제공하지 않습니다
            </p>
          </div>

          <div class="abstract-box">
            <div class="abstract-box__label">Abstract</div>
            <pre class="abstract-box__text">{{ selectedPaper.abstractText || '초록 정보가 없습니다.' }}</pre>
          </div>

          <div class="review-section">
            <div v-if="!review && !isReviewing" class="review-prompt">
              <p class="review-prompt__hint">
                Claude가 {{ selectedPaper.pmcid ? '논문 본문 전체' : '초록' }}를 읽고 한국어로 분석 요약합니다.
              </p>
              <button class="review-btn" @click="generateReview">
                <span>{{ selectedPaper.pmcid ? '✨ AI 요약 생성 (PMC 본문 분석)' : '✨ AI 요약 생성 (초록 분석)' }}</span>
              </button>
            </div>

            <div v-if="isReviewing" class="review-loading">
              <div class="spinner spinner--lg"></div>
              <p>Claude가 논문을 분석하고 있습니다...</p>
            </div>

            <div v-if="review && !isReviewing" class="review-result">
              <div class="review-result__head">
                <div class="review-result__label">AI 분석 결과</div>
                <div class="review-result__actions">
                  <button class="ra-btn" @click="copyReview" title="AI 요약 텍스트를 클립보드에 복사">
                    <span v-if="copyDone">✓ 복사됨</span>
                    <span v-else>📋 복사</span>
                  </button>
                  <button class="ra-btn" :disabled="isExportingPdf" @click="onExportPdf" title="제목·저자·초록·AI 요약을 PDF로 다운로드">
                    <span v-if="isExportingPdf" class="spinner"></span>
                    <span v-else>📄 PDF</span>
                  </button>
                  <button class="ra-btn" :disabled="isExportingWord" @click="onExportWord" title="제목·저자·초록·AI 요약을 Word로 다운로드">
                    <span v-if="isExportingWord" class="spinner"></span>
                    <span v-else>📝 Word</span>
                  </button>
                  <button class="ra-btn" @click="generateReview" title="AI 요약을 다시 생성">🔄 다시 생성</button>
                </div>
              </div>
              <div class="review-result__body" v-html="renderedReview"></div>
            </div>
          </div>
        </div>

      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { usePaperSearch } from '@/composables/usePaperSearch'
import { exportSummaryAsPdf, exportSummaryAsWord, pmcPdfUrl } from '@/utils/exportPaper'
import { useToast } from '@/composables/useToast'

const rootEl = ref(null)
const searchInputEl = ref(null)
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

const toast = useToast()
const isExportingPdf = ref(false)
const isExportingWord = ref(false)
const copyDone = ref(false)

const pmcPdfHref = computed(() => pmcPdfUrl(selectedPaper.value?.pmcid))

async function onExportPdf() {
  if (!selectedPaper.value || isExportingPdf.value) return
  isExportingPdf.value = true
  try {
    await exportSummaryAsPdf(selectedPaper.value, review.value)
  } catch (e) {
    console.error('PDF 내보내기 오류', e)
    toast.error('PDF 다운로드에 실패했습니다.')
  } finally {
    isExportingPdf.value = false
  }
}

async function onExportWord() {
  if (!selectedPaper.value || isExportingWord.value) return
  isExportingWord.value = true
  try {
    await exportSummaryAsWord(selectedPaper.value, review.value)
  } catch (e) {
    console.error('Word 내보내기 오류', e)
    toast.error('Word 다운로드에 실패했습니다.')
  } finally {
    isExportingWord.value = false
  }
}

async function copyReview() {
  if (!review.value) return
  try {
    await navigator.clipboard.writeText(review.value)
    copyDone.value = true
    toast.success('AI 요약을 복사했습니다.')
    setTimeout(() => { copyDone.value = false }, 1800)
  } catch (e) {
    console.error('복사 실패', e)
    toast.error('복사에 실패했습니다.')
  }
}

function clearSearch() {
  query.value = ''
  searchInputEl.value?.focus()
}

function onKeydown(e) {
  if (e.key === 'Escape' && document.activeElement === searchInputEl.value && query.value) {
    clearSearch()
  }
}

watch(() => selectedPmid.value, () => { copyDone.value = false })

onMounted(() => {
  loadReviewHistory()
  if (window.innerWidth > 768) searchInputEl.value?.focus()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
@import '@/assets/css/views/paper-review.css';
</style>
