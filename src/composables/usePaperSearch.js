import { ref, computed, nextTick } from 'vue'
import { searchPapers, fetchPaper, generateReview as apiGenerateReview } from '@/services/paper.service'
import { formatAuthors } from '@/utils/format'
import { renderPaperReview } from '@/utils/markdown'

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
    isSearching.value = true
    hasSearched.value = true
    papers.value = []
    selectedPaper.value = null
    selectedPmid.value = null
    review.value = null
    if (page === 1) {
      originalQuery.value = query.value.trim()
      correctedQuery.value = null
    }
    try {
      const data = await searchPapers(query.value.trim(), page, pageSize.value)
      papers.value = data.papers
      total.value = data.total
      currentPage.value = data.page
      tooBroad.value = data.tooBroad
      if (data.correctedQuery) {
        correctedQuery.value = data.correctedQuery
        originalQuery.value = query.value.trim()
      }
    } catch (e) {
      console.error('검색 오류', e)
    } finally {
      isSearching.value = false
    }
  }

  async function goToPage(page) {
    if (page < 1 || page > totalPages.value || page === currentPage.value) return
    await fetchPage(page)
    rootEl.value?.querySelector('.results-panel')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function selectPaper(pmid) {
    if (selectedPmid.value === pmid) return
    selectedPmid.value = pmid
    selectedPaper.value = null
    review.value = null
    isLoadingDetail.value = true
    try {
      selectedPaper.value = await fetchPaper(pmid)
      if (window.innerWidth <= 768) {
        await nextTick()
        rootEl.value?.querySelector('.detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } catch (e) {
      console.error('논문 상세 조회 오류', e)
    } finally {
      isLoadingDetail.value = false
    }
  }

  async function generateReview() {
    if (!selectedPaper.value || isReviewing.value) return
    isReviewing.value = true
    review.value = null
    try {
      const data = await apiGenerateReview(selectedPaper.value.pmid)
      review.value = data.review
    } catch (e) {
      console.error('AI 리뷰 오류', e)
      review.value = 'AI 분석 중 오류가 발생했습니다.'
    } finally {
      isReviewing.value = false
    }
  }

  return {
    query, isSearching, hasSearched, papers, total,
    currentPage, pageSize, tooBroad, correctedQuery, originalQuery,
    selectedPmid, selectedPaper, isLoadingDetail, isReviewing, review,
    totalPages, pageNumbers, renderedReview,
    search, fetchPage, goToPage, selectPaper, generateReview,
    formatAuthors
  }
}
