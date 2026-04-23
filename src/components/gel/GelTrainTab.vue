<template>
  <div class="tab-content">

    <!-- 업로드 폼 -->
    <section class="upload-section">
      <h2 class="section-title">학습 데이터 등록</h2>
      <p class="section-desc">PCR 젤 이미지를 업로드하고 각 레인의 실측 Ct값을 입력합니다. 등록 시 AI가 각 레인의 <strong>ROI(타겟 밴드 영역)</strong>를 자동 추출하고 픽셀 밝기를 정규화(Intensity Normalization)하여 학습에 반영합니다.</p>

      <!-- 단계 표시기 -->
      <div class="step-bar">
        <div class="step" :class="uploadStep >= 1 ? 'step--done' : 'step--active'">
          <div class="step__dot">{{ uploadStep >= 1 ? '✓' : '1' }}</div>
          <span class="step__label">이미지 선택</span>
        </div>
        <div class="step__line" :class="{ 'step__line--done': uploadStep >= 2 }"></div>
        <div class="step" :class="uploadStep > 1 ? 'step--done' : uploadStep === 1 ? 'step--active' : ''">
          <div class="step__dot">{{ uploadStep > 1 ? '✓' : '2' }}</div>
          <span class="step__label">레인 분석</span>
        </div>
        <div class="step__line" :class="{ 'step__line--done': uploadStep >= 3 }"></div>
        <div class="step" :class="uploadStep > 2 ? 'step--done' : uploadStep === 2 ? 'step--active' : ''">
          <div class="step__dot">{{ uploadStep > 2 ? '✓' : '3' }}</div>
          <span class="step__label">Ct값 입력</span>
        </div>
        <div class="step__line"></div>
        <div class="step" :class="uploadStep === 3 ? 'step--active' : ''">
          <div class="step__dot">4</div>
          <span class="step__label">저장</span>
        </div>
      </div>

      <div class="upload-row">
        <div
          class="upload-area"
          :class="{ 'upload-area--drag': isDraggingMulti, 'upload-area--filled': multiLaneFile }"
          @dragover.prevent="isDraggingMulti = true"
          @dragleave.prevent="isDraggingMulti = false"
          @drop.prevent="onMultiLaneDrop"
        >
          <input
            ref="multiLaneFileInput"
            type="file"
            accept="image/*"
            class="upload-area__input"
            @change="onMultiLaneFileChange"
          />
          <div class="upload-area__inner" @click="multiLaneFileInput.click()">
            <img v-if="imagePreviewUrl" :src="imagePreviewUrl" class="upload-area__preview" alt="미리보기" />
            <div v-else class="upload-area__icon">🧫</div>
            <p class="upload-area__text">{{ multiLaneFile ? multiLaneFile.name : '젤 이미지를 끌어다 놓거나 클릭' }}</p>
            <p class="upload-area__sub">
              {{ multiLaneFile ? '클릭하여 다른 파일 선택' : 'JPG, PNG · 최대 20MB' }}
            </p>
          </div>
          <button
            v-if="multiLaneFile"
            class="upload-area__clear"
            title="파일 초기화"
            @click.stop="resetUploadForm"
          >×</button>
        </div>

        <div class="ct-input-group">
          <button
            class="btn-secondary btn-step"
            :disabled="!multiLaneFile || isExtractingLanes"
            @click="extractLanesForTraining"
          >
            <span v-if="isExtractingLanes" class="spinner spinner--dark"></span>
            <span v-else>① 레인 분석</span>
          </button>
          <button
            class="btn-secondary btn-step"
            :disabled="multiLaneExtracted.length === 0 || isExtractingCt"
            @click="autoExtractCt"
            title="이미지에 표시된 Ct값을 AI가 자동으로 읽어옵니다"
          >
            <span v-if="isExtractingCt" class="spinner spinner--dark"></span>
            <span v-else>✨ ② Ct 자동 추출</span>
          </button>
        </div>
      </div>

      <!-- 중복 감지 배너 -->
      <div v-if="isDuplicate" class="duplicate-banner">
        <div class="duplicate-banner__body">
          <span class="duplicate-banner__icon">⚠</span>
          <span class="duplicate-banner__text">이미 등록된 파일입니다. Ct값을 수정하여 덮어쓰거나, 폼을 초기화하고 다른 파일을 선택하세요.</span>
        </div>
        <div class="duplicate-banner__actions">
          <button
            class="btn-dup-overwrite"
            :disabled="isDeleting || isUploadingMultiLane || !canSave"
            @click="overwriteDuplicate"
          >
            <span v-if="isDeleting || isUploadingMultiLane" class="spinner spinner--dark spinner--sm"></span>
            <span v-else>덮어쓰기 (Ct값 수정)</span>
          </button>
          <button
            class="btn-dup-reset"
            :disabled="isDeleting || isUploadingMultiLane"
            @click="resetUploadForm"
          >
            폼 초기화
          </button>
        </div>
      </div>

      <div v-if="multiLaneExtracted.length > 0" class="lane-result-wrap">
        <div class="lane-result-header">
          <span class="lane-result-title">③ 레인별 Ct값 입력</span>
        </div>
        <div class="records-table-wrap">
          <table class="records-table lane-table">
            <thead>
              <tr>
                <th>레인</th>
                <th>레이블</th>
                <th>밝기</th>
                <th>상태</th>
                <th>실측 Ct값</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="lane in multiLaneExtracted"
                :key="lane.laneIndex"
                :class="lane.concentrationLabel === 'M' || lane.concentrationLabel === 'NTC' ? 'row--muted' : ''"
              >
                <td>{{ lane.laneIndex }}</td>
                <td class="lane-label-cell">{{ lane.concentrationLabel }}</td>
                <td>{{ fmt(lane.bandIntensity) }}</td>
                <td>
                  <span v-if="lane.concentrationLabel === 'M'" class="chip chip--gray">래더</span>
                  <span v-else-if="lane.concentrationLabel === 'NTC'" class="chip chip--gray">음성대조</span>
                  <span v-else-if="lane.isSaturated" class="chip chip--orange">포화</span>
                  <span v-else-if="lane.isNegative" class="chip chip--gray">미검출</span>
                  <span v-else class="chip chip--green">검출</span>
                </td>
                <td>
                  <template v-if="lane.concentrationLabel !== 'M' && lane.concentrationLabel !== 'NTC'">
                    <input
                      v-model.number="laneCtInputs[lane.concentrationLabel]"
                      type="number"
                      step="0.01"
                      min="0"
                      max="50"
                      placeholder="예: 24.35"
                      class="ct-input ct-input--sm"
                      :class="{ 'ct-input--warn': ctWarning(laneCtInputs[lane.concentrationLabel]) }"
                    />
                    <span v-if="ctWarning(laneCtInputs[lane.concentrationLabel])" class="ct-warn-hint">비정상 범위</span>
                  </template>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="predict-actions">
          <button
            class="btn-primary"
            :disabled="isUploadingMultiLane || !canSave"
            @click="uploadMultiLaneGel"
          >
            <span v-if="isUploadingMultiLane" class="spinner"></span>
            <span v-else>④ 저장</span>
          </button>
          <span v-if="!canSave" class="save-hint">Ct값을 1개 이상 입력해야 저장할 수 있습니다</span>
        </div>
      </div>
    </section>

    <!-- 모델 재학습 -->
    <section class="train-section">
      <div class="train-header">
        <h2 class="section-title">
          모델 재학습
          <span v-if="needsRetraining" class="retrain-badge">재학습 필요</span>
        </h2>
        <button
          class="btn-secondary"
          :class="{ 'btn-secondary--warn': needsRetraining }"
          :disabled="records.length < 3 || isTraining"
          @click="trainModel"
        >
          <span v-if="isTraining" class="spinner spinner--dark"></span>
          <span v-else>학습 실행 ({{ records.length }}개)</span>
        </button>
      </div>
      <div v-if="needsRetraining" class="retrain-banner">
        <span class="retrain-banner__icon">⚠</span>
        <span class="retrain-banner__text">
          학습 데이터가 변경되었습니다<template v-if="retrainingDiffText"> {{ retrainingDiffText }}</template>. 현재 모델은 최신 데이터를 반영하지 않습니다. 모델을 재학습해주세요.
        </span>
      </div>
      <p class="section-desc">저장된 학습 데이터 전체를 사용해 모델을 재학습합니다. 최소 3개 이상 필요. 학습 목표: ① mecA 이진 분류(양성/음성) ② 저농도(10¹~10³) LOD 탐지 ③ 프라이머 다이머 노이즈 필터링.</p>

      <div v-if="trainResult" class="result-box result-box--info">
        <div class="result-main-line">
          <strong>학습 완료</strong>
          <span v-if="trainQuality" class="quality-badge" :class="trainQuality.cls">{{ trainQuality.label }}</span>
        </div>
        <div class="result-metrics">
          모델: {{ trainResult.model_type }} · 학습 R²: {{ trainResult.train_r2 }} · CV R²: {{ trainResult.cv_r2_mean }} ± {{ trainResult.cv_r2_std }} · RMSE: {{ trainResult.train_rmse }} Ct · 샘플: {{ trainResult.sample_count }}개
        </div>
        <div v-if="trainQuality?.reason" class="result-quality-reason" :class="trainQuality.cls">
          {{ trainQuality.reason }}
        </div>
        <span class="result-objectives">학습 목표 반영: mecA 이진 분류 · 저농도(10¹~10³) LOD 탐지 · 프라이머 다이머 노이즈 필터링</span>
      </div>
    </section>

    <!-- 학습 데이터 목록 -->
    <section class="records-section">
      <div class="records-header">
        <h2 class="section-title">
          학습 데이터 목록
          <span v-if="records.length > 0" class="count-badge">{{ records.length }}</span>
        </h2>
        <div class="records-header__actions">
          <button v-if="records.length > 0" class="btn-csv" @click="exportCsv" title="CSV로 내보내기">↓ CSV</button>
          <button
            v-if="selectedIds.length > 0"
            class="btn-delete-selected"
            :disabled="isDeleting"
            @click="deleteSelected"
          >
            <span v-if="isDeleting" class="spinner spinner--sm spinner--red"></span>
            <span v-else>선택 삭제 ({{ selectedIds.length }}개)</span>
          </button>
        </div>
      </div>

      <div v-if="isLoadingRecords" class="list-loading">
        <div class="spinner spinner--dark"></div>
      </div>

      <template v-else-if="records.length === 0">
        <div class="list-empty">
          <div class="list-empty__icon">📋</div>
          <p class="list-empty__text">등록된 학습 데이터가 없습니다.</p>
          <p class="list-empty__hint">위에서 젤 이미지를 업로드하여 첫 번째 데이터를 등록해보세요.</p>
        </div>
      </template>

      <template v-else>
        <!-- 데이터셋 통계 -->
        <div v-if="datasetStats" class="dataset-stats">
          <div class="dataset-stats__labels">
            <span
              v-for="(count, label) in datasetStats.labelCounts"
              :key="label"
              class="dataset-stats__item"
            >
              <span class="dataset-stats__label">{{ label }}</span>
              <span class="dataset-stats__count">×{{ count }}</span>
            </span>
          </div>
          <div v-if="datasetStats.ctMin !== null" class="dataset-stats__ct">
            Ct 범위: {{ datasetStats.ctMin }} ~ {{ datasetStats.ctMax }} · 평균 {{ datasetStats.ctAvg }}
          </div>
        </div>

        <!-- 레이블 불균형 경고 -->
        <div v-if="labelWarnings.length > 0" class="imbalance-banner">
          <span class="imbalance-banner__icon">⚠</span>
          <span class="imbalance-banner__text">
            샘플 부족 —
            <span v-for="(w, i) in labelWarnings" :key="w.label">
              <strong>{{ w.label }}</strong> {{ w.count }}개<span v-if="i < labelWarnings.length - 1">, </span>
            </span>
            · 레이블당 최소 3개 이상 권장합니다.
          </span>
        </div>

        <!-- 검색 + 컬럼 토글 -->
        <div class="table-controls">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="파일명 또는 레이블 검색..."
            class="search-input"
          />
          <button class="btn-col-toggle" @click="showTechCols = !showTechCols">
            {{ showTechCols ? '기술 컬럼 숨기기' : '기술 컬럼 보기' }}
          </button>
        </div>

        <div class="records-table-wrap">
          <table class="records-table">
            <thead>
              <tr>
                <th class="col-check">
                  <input
                    type="checkbox"
                    class="row-checkbox"
                    :checked="allSelected"
                    :ref="el => { if (el) el.indeterminate = someSelected }"
                    @change="toggleSelectAll"
                  />
                </th>
                <th class="sortable" @click="setSort('fileName')">
                  파일명 <span class="sort-icon">{{ sortIcon('fileName') }}</span>
                </th>
                <th class="sortable" @click="setSort('laneIndex')">
                  레인 <span class="sort-icon">{{ sortIcon('laneIndex') }}</span>
                </th>
                <th>레이블</th>
                <th class="sortable" @click="setSort('ctValue')">
                  Ct값 <span class="sort-icon">{{ sortIcon('ctValue') }}</span>
                </th>
                <th v-if="showTechCols" class="sortable" @click="setSort('bandIntensity')">
                  밝기 <span class="sort-icon">{{ sortIcon('bandIntensity') }}</span>
                </th>
                <th v-if="showTechCols" class="sortable" @click="setSort('bandArea')">
                  면적 <span class="sort-icon">{{ sortIcon('bandArea') }}</span>
                </th>
                <th v-if="showTechCols" class="sortable" @click="setSort('relativeIntensity')">
                  상대강도 <span class="sort-icon">{{ sortIcon('relativeIntensity') }}</span>
                </th>
                <th class="sortable" @click="setSort('createdAt')">
                  등록일 <span class="sort-icon">{{ sortIcon('createdAt') }}</span>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <template v-if="filteredRecords.length === 0">
                <tr>
                  <td :colspan="showTechCols ? 10 : 7" class="empty-row">검색 결과가 없습니다.</td>
                </tr>
              </template>
              <template v-else>
                <tr
                  v-for="r in filteredRecords"
                  :key="r.id"
                  :class="{ 'row--warn': r.warning, 'row--selected': selectedIds.includes(r.id) }"
                  @click="toggleSelect(r.id)"
                >
                  <td class="col-check" @click.stop>
                    <input type="checkbox" class="row-checkbox" :value="r.id" v-model="selectedIds" />
                  </td>
                  <td class="col-name">{{ r.fileName }}</td>
                  <td>{{ r.laneIndex }}</td>
                  <td class="lane-label-cell">{{ r.concentrationLabel || '—' }}</td>
                  <td class="col-ct">{{ r.ctValue }}</td>
                  <td v-if="showTechCols">{{ fmt(r.bandIntensity) }}</td>
                  <td v-if="showTechCols">{{ fmt(r.bandArea) }}</td>
                  <td v-if="showTechCols">{{ fmt(r.relativeIntensity) }}</td>
                  <td class="col-date">{{ formatDate(r.createdAt) }}</td>
                  <td @click.stop>
                    <button class="btn-delete" @click="deleteRecord(r.id)">삭제</button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGelTraining } from '@/composables/useGelTraining'
import { fmt, formatDate } from '@/utils/format'

const emit = defineEmits(['model-updated'])

const {
  records, isLoadingRecords, selectedIds, isDeleting,
  isTraining, trainResult, needsRetraining, retrainingDiff,
  multiLaneFile, multiLaneFileInput, multiLaneExtracted, laneCtInputs,
  isExtractingLanes, isExtractingCt, isUploadingMultiLane, isDraggingMulti,
  isDuplicate,
  allSelected, someSelected,
  loadRecords, deleteRecord, deleteSelected, toggleSelectAll, toggleSelect,
  trainModel, onMultiLaneFileChange, onMultiLaneDrop,
  autoExtractCt, extractLanesForTraining, uploadMultiLaneGel,
  overwriteDuplicate, resetUploadForm
} = useGelTraining(emit)

onMounted(loadRecords)

// ── 이미지 미리보기 ───────────────────────
const imagePreviewUrl = ref(null)
watch(multiLaneFile, (newFile) => {
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imagePreviewUrl.value = newFile ? URL.createObjectURL(newFile) : null
})
onUnmounted(() => { if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value) })

// ── 업로드 단계 ──────────────────────────
const uploadStep = computed(() => {
  if (Object.keys(laneCtInputs.value).length > 0) return 3
  if (multiLaneExtracted.value.length > 0) return 2
  if (multiLaneFile.value) return 1
  return 0
})

const canSave = computed(() => Object.keys(laneCtInputs.value).length > 0)

// ── 데이터셋 통계 ─────────────────────────
const datasetStats = computed(() => {
  if (records.value.length === 0) return null
  const labelCounts = {}
  const ctValues = []
  for (const r of records.value) {
    const label = r.concentrationLabel
    if (label && label !== 'M' && label !== 'NTC') {
      labelCounts[label] = (labelCounts[label] || 0) + 1
      if (r.ctValue != null) ctValues.push(r.ctValue)
    }
  }
  const ctMin = ctValues.length ? Math.min(...ctValues).toFixed(1) : null
  const ctMax = ctValues.length ? Math.max(...ctValues).toFixed(1) : null
  const ctAvg = ctValues.length
    ? (ctValues.reduce((a, b) => a + b, 0) / ctValues.length).toFixed(1)
    : null
  return { labelCounts, ctMin, ctMax, ctAvg }
})

// ── 레이블 불균형 경고 ────────────────────
const labelWarnings = computed(() => {
  if (!datasetStats.value) return []
  return Object.entries(datasetStats.value.labelCounts)
    .filter(([, count]) => count < 3)
    .map(([label, count]) => ({ label, count }))
})

// ── 학습 품질 ─────────────────────────────
const trainQuality = computed(() => {
  if (!trainResult.value) return null
  const r2   = parseFloat(trainResult.value.cv_r2_mean)
  const rmse = parseFloat(trainResult.value.train_rmse)
  const std  = parseFloat(trainResult.value.cv_r2_std)
  if (isNaN(r2)) return null

  if (r2 >= 0.9) {
    return {
      label: '우수', cls: 'quality--great',
      reason: 'CV R²가 0.9 이상으로 예측 설명력이 충분합니다.'
    }
  }
  if (r2 >= 0.7) {
    const hints = []
    if (!isNaN(std) && std > 0.1) hints.push('교차검증 편차가 큽니다')
    if (!isNaN(rmse) && rmse > 2) hints.push(`RMSE ${rmse} Ct로 예측 오차가 있습니다`)
    return {
      label: '양호', cls: 'quality--good',
      reason: (hints.length ? hints.join(', ') + '. ' : '') + '데이터를 더 추가하면 성능이 향상됩니다.'
    }
  }

  const reasons = []
  if (r2 < 0.5) reasons.push(`CV R² ${r2} — 예측 설명력이 매우 낮습니다`)
  else reasons.push(`CV R² ${r2} — 설명력이 미흡합니다`)
  if (!isNaN(rmse) && rmse > 3) reasons.push(`RMSE ${rmse} Ct — 예측 오차가 큽니다`)
  if (!isNaN(std) && std > 0.15) reasons.push('교차검증 편차가 과도합니다 (모델 불안정)')
  return {
    label: '부족', cls: 'quality--poor',
    reason: reasons.join(', ') + '. 학습 데이터를 보완해주세요.'
  }
})

// ── 재학습 diff 텍스트 ────────────────────
const retrainingDiffText = computed(() => {
  if (!retrainingDiff.value) return ''
  const { added, removed } = retrainingDiff.value
  const parts = []
  if (added > 0) parts.push(`${added}개 추가`)
  if (removed > 0) parts.push(`${removed}개 삭제`)
  return parts.length ? `(${parts.join(', ')})` : ''
})

// ── Ct 범위 경고 ──────────────────────────
function ctWarning(val) {
  if (val == null || val === '') return false
  const n = Number(val)
  return n < 5 || n > 40
}

// ── CSV 내보내기 ──────────────────────────
function exportCsv() {
  const headers = ['ID', '파일명', '레인', '레이블', 'Ct값', '밝기', '면적', '상대강도', '등록일']
  const rows = records.value.map(r => [
    r.id, r.fileName, r.laneIndex, r.concentrationLabel || '',
    r.ctValue ?? '', fmt(r.bandIntensity), fmt(r.bandArea), fmt(r.relativeIntensity),
    formatDate(r.createdAt)
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gel_training_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── 목록 검색 / 정렬 ─────────────────────
const searchQuery = ref('')
const sortKey = ref('createdAt')
const sortDir = ref('desc')
const showTechCols = ref(false)

const filteredRecords = computed(() => {
  let list = records.value
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(r =>
      (r.fileName || '').toLowerCase().includes(q) ||
      (r.concentrationLabel || '').toLowerCase().includes(q)
    )
  }
  return [...list].sort((a, b) => {
    const av = a[sortKey.value]
    const bv = b[sortKey.value]
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})

function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function sortIcon(key) {
  if (sortKey.value !== key) return '↕'
  return sortDir.value === 'asc' ? '↑' : '↓'
}
</script>

<style scoped>
@import '@/assets/css/gel/shared.css';
@import '@/assets/css/gel/train.css';
</style>
