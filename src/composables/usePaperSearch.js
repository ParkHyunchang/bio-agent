import { ref, computed, nextTick, watch, onMounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** provide/inject 키. PaperReviewView가 provide, 자식 컴포넌트가 inject. */
export const PAPER_SEARCH_KEY = Symbol('PaperSearch')

/** 자식 컴포넌트에서 호출. 부모가 provide한 usePaperSearch 결과를 그대로 받는다. */
export function injectPaperSearch() {
  const ctx = inject(PAPER_SEARCH_KEY)
  if (!ctx) throw new Error('injectPaperSearch must be called inside a PaperReviewView')
  return ctx
}
import {
  searchPapers, fetchPaper,
  streamReview, fetchReviewedPmids,
  fetchReviewHistory, deleteReviewHistory as apiDeleteReviewHistory
} from '@/services/paper.service'
import { formatAuthors, formatDateShort } from '@/utils/format'
import { renderPaperReview } from '@/utils/markdown'
import { useToast } from '@/composables/useToast'

const RECENT_SEARCHES_KEY = 'paperReview.recentSearches'
const RECENT_SEARCHES_MAX = 10

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(s => typeof s === 'string' && s.trim()).slice(0, RECENT_SEARCHES_MAX) : []
  } catch { return [] }
}

function saveRecentSearches(list) {
  try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, RECENT_SEARCHES_MAX))) }
  catch { /* localStorage 사용 불가 환경 무시 */ }
}

export function usePaperSearch(rootEl) {
  const route = useRoute()
  const router = useRouter()

  const query = ref('')
  const isSearching = ref(false)
  const hasSearched = ref(false)
  const papers = ref([])
  const total = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const tooBroad = ref(false)
  const correctedQuery = ref(null)
  const originalQuery = ref('')
  const sort = ref('relevance')
  const pubType = ref('')
  const onlyPmc = ref(false)
  const yearFrom = ref(null)
  const yearTo = ref(null)
  const selectedPmid = ref(null)
  const selectedPaper = ref(null)
  const isLoadingDetail = ref(false)
  const isReviewing = ref(false)
  const review = ref(null)
  const reviewLength = ref('normal')
  const reviewPerspective = ref('default')
  const fullTextTruncated = ref(false)

  const reviewHistory = ref([])
  const reviewHistoryTotal = ref(0)
  const reviewHistoryPage = ref(0)
  const reviewHistoryPageSize = 50
  const isLoadingHistory = ref(false)
  const selectedHistoryId = ref(null)
  const reviewedPmids = ref(new Set())

  const focusedIndex = ref(-1)
  const recentSearches = ref(loadRecentSearches())

  const toast = useToast()
  let searchRequestSeq = 0
  let detailRequestSeq = 0
  let reviewStreamHandle = null
  let filterDebounceTimer = null
  let urlSyncTimer = null
  let initializing = true

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  const pageNumbers = computed(() => {
    const delta = 2
    const start = Math.max(1, currentPage.value - delta)
    const end = Math.min(totalPages.value, currentPage.value + delta)
    const pages = []
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  })

  const renderedReview = computed(() => {
    if (!review.value) return ''
    return renderPaperReview(review.value)
  })

  function cancelReviewStream() {
    if (reviewStreamHandle) {
      reviewStreamHandle.abort()
      reviewStreamHandle = null
    }
  }

  function pushRecentSearch(q) {
    const trimmed = (q || '').trim()
    if (!trimmed) return
    const next = [trimmed, ...recentSearches.value.filter(x => x !== trimmed)].slice(0, RECENT_SEARCHES_MAX)
    recentSearches.value = next
    saveRecentSearches(next)
  }

  function clearRecentSearches() {
    recentSearches.value = []
    saveRecentSearches([])
  }

  async function search() {
    if (!query.value.trim() || isSearching.value) return
    pushRecentSearch(query.value)
    await fetchPage(1)
  }

  async function fetchPage(page) {
    cancelReviewStream()
    const reqId = ++searchRequestSeq
    isSearching.value = true
    hasSearched.value = true
    papers.value = []
    selectedPaper.value = null
    selectedPmid.value = null
    review.value = null
    fullTextTruncated.value = false
    selectedHistoryId.value = null
    focusedIndex.value = -1
    if (page === 1) {
      originalQuery.value = query.value.trim()
      correctedQuery.value = null
    }
    try {
      const data = await searchPapers(query.value.trim(), page, pageSize.value, {
        sort: sort.value,
        pubType: pubType.value,
        onlyPmc: onlyPmc.value,
        yearFrom: yearFrom.value,
        yearTo: yearTo.value
      })
      if (reqId !== searchRequestSeq) return
      papers.value = data.papers
      total.value = data.total
      currentPage.value = data.page
      tooBroad.value = data.tooBroad
      if (data.correctedQuery) {
        correctedQuery.value = data.correctedQuery
        originalQuery.value = query.value.trim()
      }
    } catch (e) {
      if (reqId !== searchRequestSeq) return
      console.error('검색 오류', e)
      toast.error('논문 검색에 실패했습니다.')
    } finally {
      if (reqId === searchRequestSeq) isSearching.value = false
    }
  }

  async function goToPage(page) {
    if (page < 1 || page > totalPages.value || page === currentPage.value) return
    await fetchPage(page)
    rootEl.value?.querySelector('.results-panel')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function selectPaper(pmid) {
    if (selectedPmid.value === pmid) return
    cancelReviewStream()
    const reqId = ++detailRequestSeq
    selectedPmid.value = pmid
    selectedPaper.value = null
    review.value = null
    fullTextTruncated.value = false
    selectedHistoryId.value = null
    isLoadingDetail.value = true
    const idx = papers.value.findIndex(p => p.pmid === pmid)
    if (idx >= 0) focusedIndex.value = idx
    try {
      const data = await fetchPaper(pmid)
      if (reqId !== detailRequestSeq) return
      selectedPaper.value = data
      if (window.innerWidth <= 768) {
        await nextTick()
        rootEl.value?.querySelector('.detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } catch (e) {
      if (reqId !== detailRequestSeq) return
      console.error('논문 상세 조회 오류', e)
      toast.error('논문 상세 정보를 가져오지 못했습니다.')
    } finally {
      if (reqId === detailRequestSeq) isLoadingDetail.value = false
    }
  }

  function generateReview() {
    if (!selectedPaper.value || isReviewing.value) return
    isReviewing.value = true
    review.value = ''
    fullTextTruncated.value = false

    cancelReviewStream()

    reviewStreamHandle = streamReview(
      selectedPaper.value,
      originalQuery.value || null,
      { length: reviewLength.value, perspective: reviewPerspective.value },
      {
        onChunk: (_chunk, accumulated) => { review.value = accumulated },
        onMeta: (meta) => { fullTextTruncated.value = !!meta?.fullTextTruncated },
        onDone: async () => {
          isReviewing.value = false
          reviewStreamHandle = null
          await Promise.all([loadReviewHistory(), loadReviewedPmids()])
        },
        onError: (e) => {
          console.error('AI 리뷰 스트리밍 오류', e)
          if (!review.value) review.value = 'AI 분석 중 오류가 발생했습니다.'
          isReviewing.value = false
          reviewStreamHandle = null
          toast.error('AI 리뷰 생성에 실패했습니다.')
        }
      }
    )
  }

  async function loadReviewHistory(reset = true) {
    if (isLoadingHistory.value) return
    isLoadingHistory.value = true
    try {
      const data = await fetchReviewHistory(0, reviewHistoryPageSize)
      reviewHistory.value = data.items || []
      reviewHistoryTotal.value = data.total || 0
      reviewHistoryPage.value = 0
      // reset 인자는 향후 확장(예: 첫 페이지 강제 리로드 후 selection 클리어 여부)을 위한 hook이며 현재는 사용하지 않음
      void reset
    } catch (e) {
      console.error('히스토리 로드 오류', e)
      toast.error('리뷰 히스토리를 불러오지 못했습니다.')
    } finally {
      isLoadingHistory.value = false
    }
  }

  async function loadMoreReviewHistory() {
    if (isLoadingHistory.value) return
    if (reviewHistory.value.length >= reviewHistoryTotal.value) return
    isLoadingHistory.value = true
    try {
      const nextPage = reviewHistoryPage.value + 1
      const data = await fetchReviewHistory(nextPage, reviewHistoryPageSize)
      reviewHistory.value = [...reviewHistory.value, ...(data.items || [])]
      reviewHistoryTotal.value = data.total || reviewHistoryTotal.value
      reviewHistoryPage.value = nextPage
    } catch (e) {
      console.error('히스토리 추가 로드 오류', e)
      toast.error('히스토리를 더 불러오지 못했습니다.')
    } finally {
      isLoadingHistory.value = false
    }
  }

  async function loadReviewedPmids() {
    try {
      reviewedPmids.value = await fetchReviewedPmids()
    } catch (e) {
      console.error('리뷰 PMID 로드 오류', e)
    }
  }

  async function selectHistory(record) {
    cancelReviewStream()
    const reqId = ++detailRequestSeq
    selectedHistoryId.value = record.id
    selectedPmid.value = record.pmid
    review.value = record.reviewText
    fullTextTruncated.value = false
    selectedPaper.value = {
      pmid: record.pmid,
      title: record.paperTitle,
      authors: [],
      journal: '',
      pubDate: '',
      abstractText: ''
    }
    isLoadingDetail.value = true
    try {
      const fresh = await fetchPaper(record.pmid)
      if (reqId !== detailRequestSeq) return
      selectedPaper.value = fresh
    } catch (e) {
      if (reqId !== detailRequestSeq) return
      console.error('논문 상세 조회 오류', e)
      toast.warn('최신 논문 정보를 가져오지 못했지만 저장된 리뷰는 표시됩니다.')
    } finally {
      if (reqId === detailRequestSeq) isLoadingDetail.value = false
    }
    if (window.innerWidth <= 768) {
      await nextTick()
      rootEl.value?.querySelector('.detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  async function deleteReviewHistory(id) {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm('이 리뷰 기록을 삭제하시겠습니까?')) return
    }
    try {
      await apiDeleteReviewHistory(id)
      if (selectedHistoryId.value === id) {
        selectedHistoryId.value = null
        selectedPaper.value = null
        selectedPmid.value = null
        review.value = null
      }
      await Promise.all([loadReviewHistory(), loadReviewedPmids()])
      toast.success('삭제되었습니다.')
    } catch (e) {
      console.error('히스토리 삭제 오류', e)
      toast.error('삭제에 실패했습니다.')
    }
  }

  function focusNext() {
    if (papers.value.length === 0) return
    focusedIndex.value = Math.min(papers.value.length - 1, focusedIndex.value + 1)
    scrollFocusedIntoView()
  }
  function focusPrev() {
    if (papers.value.length === 0) return
    focusedIndex.value = Math.max(0, focusedIndex.value <= 0 ? 0 : focusedIndex.value - 1)
    scrollFocusedIntoView()
  }
  function activateFocused() {
    if (focusedIndex.value < 0 || focusedIndex.value >= papers.value.length) return
    selectPaper(papers.value[focusedIndex.value].pmid)
  }
  function scrollFocusedIntoView() {
    nextTick(() => {
      const list = rootEl.value?.querySelectorAll('.paper-item')
      list?.[focusedIndex.value]?.scrollIntoView({ block: 'nearest' })
    })
  }

  // 필터 변경 시 디바운스 후 1페이지부터 재조회 (yearFrom 입력 중 글자마다 검색 트리거 방지)
  watch([sort, pubType, onlyPmc, yearFrom, yearTo], () => {
    if (initializing) return
    if (!hasSearched.value || !query.value.trim()) return
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
    filterDebounceTimer = setTimeout(() => { fetchPage(1) }, 300)
  })

  // refs → URL 동기화 (debounce). 다른 라우트로 갔다 돌아왔을 때 초기 read는 onMounted에서.
  watch([query, sort, pubType, onlyPmc, yearFrom, yearTo], () => {
    if (initializing) return
    if (urlSyncTimer) clearTimeout(urlSyncTimer)
    urlSyncTimer = setTimeout(() => {
      const q = {}
      if (query.value.trim()) q.q = query.value.trim()
      if (sort.value && sort.value !== 'relevance') q.sort = sort.value
      if (pubType.value) q.pubType = pubType.value
      if (onlyPmc.value) q.onlyPmc = '1'
      if (yearFrom.value) q.yearFrom = String(yearFrom.value)
      if (yearTo.value) q.yearTo = String(yearTo.value)
      router.replace({ query: q }).catch(() => { /* duplicate navigation 무시 */ })
    }, 300)
  })

  function applyRouteToState() {
    const q = route.query || {}
    if (typeof q.q === 'string') query.value = q.q
    if (typeof q.sort === 'string') sort.value = q.sort
    if (typeof q.pubType === 'string') pubType.value = q.pubType
    if (q.onlyPmc === '1' || q.onlyPmc === 'true') onlyPmc.value = true
    const yf = parseInt(q.yearFrom, 10)
    const yt = parseInt(q.yearTo, 10)
    if (!Number.isNaN(yf)) yearFrom.value = yf
    if (!Number.isNaN(yt)) yearTo.value = yt
  }

  onMounted(() => {
    applyRouteToState()
    initializing = false
    if (query.value.trim()) {
      pushRecentSearch(query.value)
      fetchPage(1)
    }
  })

  return {
    query, isSearching, hasSearched, papers, total,
    currentPage, pageSize, tooBroad, correctedQuery, originalQuery,
    sort, pubType, onlyPmc, yearFrom, yearTo,
    selectedPmid, selectedPaper, isLoadingDetail, isReviewing, review,
    reviewLength, reviewPerspective, fullTextTruncated,
    totalPages, pageNumbers, renderedReview,
    reviewHistory, reviewHistoryTotal, isLoadingHistory,
    selectedHistoryId, reviewedPmids,
    focusedIndex, recentSearches,
    search, fetchPage, goToPage, selectPaper, generateReview,
    loadReviewHistory, loadMoreReviewHistory, loadReviewedPmids,
    selectHistory, deleteReviewHistory,
    focusNext, focusPrev, activateFocused,
    pushRecentSearch, clearRecentSearches,
    formatAuthors, formatDate: formatDateShort
  }
}
