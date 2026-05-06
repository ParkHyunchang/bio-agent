<template>
  <main class="detail-panel">

    <div v-if="!selectedPaper && !isLoadingDetail" class="panel-empty">
      <div class="panel-empty__icon">🧬</div>
      <p>논문을 선택하면<br>상세 정보와 AI 분석을 볼 수 있습니다</p>
      <p class="panel-empty__hint">↑/↓ 키로 결과 이동, Enter로 선택</p>
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
        <div
          v-if="selectedPaper.abstractSections && selectedPaper.abstractSections.length"
          class="abstract-box__sections"
        >
          <div
            v-for="(section, idx) in selectedPaper.abstractSections"
            :key="idx"
            class="abstract-section"
          >
            <div v-if="section.label" class="abstract-section__label">{{ section.label }}</div>
            <p class="abstract-section__text">{{ section.text }}</p>
          </div>
        </div>
        <pre v-else class="abstract-box__text">{{ selectedPaper.abstractText || '초록 정보가 없습니다.' }}</pre>
      </div>

      <div class="review-section">
        <div v-if="!review && !isReviewing" class="review-prompt">
          <p class="review-prompt__hint">
            Claude가 {{ selectedPaper.pmcid ? '논문 본문 전체' : '초록' }}를 읽고 한국어로 분석 요약합니다.
          </p>
          <div class="review-options">
            <label class="filter-field">
              <span class="filter-field__label">길이</span>
              <select v-model="reviewLength" class="filter-field__select">
                <option value="short">짧게</option>
                <option value="normal">보통</option>
                <option value="detailed">자세히</option>
              </select>
            </label>
            <label class="filter-field">
              <span class="filter-field__label">관점</span>
              <select v-model="reviewPerspective" class="filter-field__select">
                <option value="default">기본</option>
                <option value="clinical">임상 적용</option>
                <option value="mechanism">기전 분석</option>
                <option value="statistics">통계·방법론</option>
              </select>
            </label>
          </div>
          <button class="review-btn" @click="generateReview">
            <span>{{ selectedPaper.pmcid ? '✨ AI 요약 생성 (PMC 본문 분석)' : '✨ AI 요약 생성 (초록 분석)' }}</span>
          </button>
        </div>

        <div v-if="isReviewing && !review" class="review-loading">
          <div class="spinner spinner--lg"></div>
          <p>Claude가 논문을 분석하고 있습니다...</p>
        </div>

        <div v-if="review" class="review-result">
          <div class="review-result__head">
            <div class="review-result__label">
              AI 분석 결과
              <span v-if="isReviewing" class="review-result__streaming">· 생성 중...</span>
            </div>
            <div class="review-result__actions">
              <button class="ra-btn" :disabled="isReviewing" @click="copyReview" title="AI 요약 텍스트를 클립보드에 복사">
                <span v-if="copyDone">✓ 복사됨</span>
                <span v-else>📋 복사</span>
              </button>
              <button class="ra-btn" :disabled="isReviewing || isExportingPdf" @click="onExportPdf" title="제목·저자·초록·AI 요약을 PDF로 다운로드">
                <span v-if="isExportingPdf" class="spinner"></span>
                <span v-else>📄 PDF</span>
              </button>
              <button class="ra-btn" :disabled="isReviewing || isExportingWord" @click="onExportWord" title="제목·저자·초록·AI 요약을 Word로 다운로드">
                <span v-if="isExportingWord" class="spinner"></span>
                <span v-else>📝 Word</span>
              </button>
              <button class="ra-btn" :disabled="isReviewing" @click="generateReview" title="AI 요약을 다시 생성">🔄 다시 생성</button>
            </div>
          </div>
          <p
            v-if="fullTextTruncated"
            class="review-result__truncation"
            title="PMC 본문이 매우 길어 컷오프되었습니다"
          >
            ⚠ 본문이 길어 일부(약 15만자)만 분석되었습니다.
          </p>
          <div class="review-result__body" v-html="renderedReview"></div>
        </div>
      </div>
    </div>

  </main>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { injectPaperSearch } from '@/composables/usePaperSearch'
import { exportSummaryAsPdf, exportSummaryAsWord, pmcPdfUrl } from '@/utils/exportPaper'
import { useToast } from '@/composables/useToast'

const {
  selectedPmid, selectedPaper, isLoadingDetail, isReviewing, review,
  reviewLength, reviewPerspective, fullTextTruncated, renderedReview,
  generateReview,
} = injectPaperSearch()

const toast = useToast()
const isExportingPdf = ref(false)
const isExportingWord = ref(false)
const copyDone = ref(false)

const pmcPdfHref = computed(() => pmcPdfUrl(selectedPaper.value?.pmcid))

watch(() => selectedPmid.value, () => { copyDone.value = false })

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
</script>
