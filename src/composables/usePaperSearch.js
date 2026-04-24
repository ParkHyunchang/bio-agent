import { ref, computed, nextTick } from 'vue'
import {
  searchPapers, fetchPaper,
  generateReview as apiGenerateReview,
  fetchReviewHistory, deleteReviewHistory as apiDeleteReviewHistory
} from '@/services/paper.service'
import { formatAuthors, formatDateShort } from '@/utils/format'
import { renderPaperReview } from '@/utils/markdown'
import { useToast } from '@/composables/useToast'

export function usePaperSearch(rootEl) {
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
  const selectedPmid = ref(null)
  const selectedPaper = ref(null)
  const isLoadingDetail = ref(false)
  const isReviewing = ref(false)
  const review = ref(null)

  const reviewHistory = ref([])
  const selectedHistoryId = ref(null)

  const toast = useToast()
  let searchRequestSeq = 0
  let detailRequestSeq = 0

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

  async function search() {
    if (!query.value.trim() || isSearching.value) return
    await fetchPage(1)
  }

  async function fetchPage(page) {
    const reqId = ++searchRequestSeq
    isSearching.value = true
    hasSearched.value = true
    papers.value = []
    selectedPaper.value = null
    selectedPmid.value = null
    review.value = null
    selectedHistoryId.value = null
    if (page === 1) {
      originalQuery.value = query.value.trim()
      correctedQuery.value = null
    }
    try {
      const data = await searchPapers(query.value.trim(), page, pageSize.value)
      if (reqId !== searchRequestSeq) return // stale: 새 검색이 시작됨
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
    const reqId = ++detailRequestSeq
    selectedPmid.value = pmid
    selectedPaper.value = null
    review.value = null
    selectedHistoryId.value = null
    isLoadingDetail.value = true
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

  async function generateReview() {
    if (!selectedPaper.value || isReviewing.value) return
    isReviewing.value = true
    review.value = null
    try {
      const data = await apiGenerateReview(selectedPaper.value, originalQuery.value || null)
      review.value = data.review
      await loadReviewHistory()
    } catch (e) {
      console.error('AI 리뷰 오류', e)
      review.value = 'AI 분석 중 오류가 발생했습니다.'
      toast.error('AI 리뷰 생성에 실패했습니다.')
    } finally {
      isReviewing.value = false
    }
  }

  async function loadReviewHistory() {
    try {
      reviewHistory.value = await fetchReviewHistory()
    } catch (e) {
      console.error('히스토리 로드 오류', e)
      toast.error('리뷰 히스토리를 불러오지 못했습니다.')
    }
  }

  async function selectHistory(record) {
    const reqId = ++detailRequestSeq
    selectedHistoryId.value = record.id
    selectedPmid.value = record.pmid
    review.value = record.reviewText
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
      // 저장된 리뷰는 이미 보여지고 있으므로 에러는 경고만
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
      await loadReviewHistory()
      toast.success('삭제되었습니다.')
    } catch (e) {
      console.error('히스토리 삭제 오류', e)
      toast.error('삭제에 실패했습니다.')
    }
  }

  return {
    query, isSearching, hasSearched, papers, total,
    currentPage, pageSize, tooBroad, correctedQuery, originalQuery,
    selectedPmid, selectedPaper, isLoadingDetail, isReviewing, review,
    totalPages, pageNumbers, renderedReview,
    reviewHistory, selectedHistoryId,
    search, fetchPage, goToPage, selectPaper, generateReview,
    loadReviewHistory, selectHistory, deleteReviewHistory,
    formatAuthors, formatDate: formatDateShort
  }
}
