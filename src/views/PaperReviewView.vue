<template>
  <div class="paper-review" ref="rootEl">

    <PaperSearchBar />

    <div class="content" :class="{ 'content--history-hidden': !historyVisible }">

      <button
        v-if="!historyVisible"
        class="history-rail"
        @click="toggleHistory"
        :title="`리뷰 히스토리 보기${reviewHistory.length ? ` (${reviewHistory.length}건)` : ''}`"
      >
        <span class="history-rail__icon">▶</span>
        <span class="history-rail__text">📋 리뷰 히스토리</span>
        <span class="history-rail__count" v-if="reviewHistory.length > 0">{{ reviewHistory.length }}</span>
      </button>

      <aside class="history-panel" :class="{ 'history-panel--hidden': !historyVisible }">
        <div class="history-panel__header">
          <span class="history-panel__title">리뷰 히스토리</span>
          <span class="history-panel__count" v-if="reviewHistoryTotal > 0">
            {{ reviewHistory.length }}<span v-if="reviewHistoryTotal > reviewHistory.length"> / {{ reviewHistoryTotal }}</span>
          </span>
          <button
            class="history-panel__close"
            @click="toggleHistory"
            title="히스토리 숨기기"
            aria-label="히스토리 숨기기"
          >×</button>
        </div>
        <div class="history-panel__body">
          <div v-if="reviewHistory.length === 0 && !isLoadingHistory" class="list-empty">
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
          <button
            v-if="reviewHistory.length < reviewHistoryTotal"
            class="history-load-more"
            :disabled="isLoadingHistory"
            @click="loadMoreReviewHistory"
          >
            <span v-if="isLoadingHistory" class="spinner"></span>
            <span v-else>더 보기 ({{ reviewHistoryTotal - reviewHistory.length }}건 남음)</span>
          </button>
        </div>
      </aside>

      <PaperResultsList />
      <PaperDetailPane />
    </div>
  </div>
</template>

<script setup>
import { ref, provide, onMounted, onUnmounted } from 'vue'
import { usePaperSearch, PAPER_SEARCH_KEY } from '@/composables/usePaperSearch'
import PaperSearchBar from '@/components/paper/PaperSearchBar.vue'
import PaperResultsList from '@/components/paper/PaperResultsList.vue'
import PaperDetailPane from '@/components/paper/PaperDetailPane.vue'

const rootEl = ref(null)
const searchInputEl = ref(null)

const HISTORY_VISIBLE_KEY = 'paperReview.historyVisible'
const historyVisible = ref(loadHistoryVisible())

function loadHistoryVisible() {
  if (window.innerWidth <= 768) return false
  const saved = localStorage.getItem(HISTORY_VISIBLE_KEY)
  if (saved === null) return true
  return saved === '1'
}

function toggleHistory() {
  historyVisible.value = !historyVisible.value
  if (window.innerWidth > 768) {
    localStorage.setItem(HISTORY_VISIBLE_KEY, historyVisible.value ? '1' : '0')
  }
}

const ctx = usePaperSearch(rootEl)
// 자식 컴포넌트가 input 엘리먼트에 접근할 수 있도록 ref도 함께 provide
ctx.searchInputEl = searchInputEl
provide(PAPER_SEARCH_KEY, ctx)

const {
  query, papers, focusedIndex,
  reviewHistory, reviewHistoryTotal, isLoadingHistory,
  selectedHistoryId,
  loadReviewHistory, loadMoreReviewHistory, loadReviewedPmids,
  selectHistory, deleteReviewHistory,
  focusNext, focusPrev, activateFocused,
  formatDate,
} = ctx

function clearSearch() {
  query.value = ''
  searchInputEl.value?.focus()
}

function onKeydown(e) {
  const tag = (e.target?.tagName || '').toLowerCase()
  const inEditable = tag === 'input' || tag === 'textarea' || tag === 'select'

  if (!inEditable && (e.key === '/' || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)))) {
    e.preventDefault()
    searchInputEl.value?.focus()
    searchInputEl.value?.select?.()
    return
  }

  if (e.key === 'Escape' && document.activeElement === searchInputEl.value && query.value) {
    clearSearch()
    return
  }

  if (inEditable && e.target !== searchInputEl.value) return

  if (e.key === 'ArrowDown') {
    if (papers.value.length === 0) return
    e.preventDefault()
    focusNext()
  } else if (e.key === 'ArrowUp') {
    if (papers.value.length === 0) return
    e.preventDefault()
    focusPrev()
  } else if (e.key === 'Enter' && focusedIndex.value >= 0 && !inEditable) {
    e.preventDefault()
    activateFocused()
  }
}

onMounted(() => {
  loadReviewHistory()
  loadReviewedPmids()
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
