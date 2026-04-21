<template>
  <div class="tab-content">

    <!-- 업로드 폼 -->
    <section class="upload-section">
      <h2 class="section-title">학습 데이터 등록</h2>
      <p class="section-desc">PCR 젤 이미지를 업로드하고 각 레인의 실측 Ct값을 입력합니다. 등록 시 AI가 각 레인의 <strong>ROI(타겟 밴드 영역)</strong>를 자동 추출하고 픽셀 밝기를 정규화(Intensity Normalization)하여 학습에 반영합니다.</p>

      <div class="upload-row">
        <div
          class="upload-area"
          :class="{ 'upload-area--drag': isDraggingMulti }"
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
            <div class="upload-area__icon">🧫</div>
            <p v-if="!multiLaneFile" class="upload-area__text">젤 이미지를 끌어다 놓거나 클릭</p>
            <p v-else class="upload-area__text">{{ multiLaneFile.name }}</p>
            <p class="upload-area__sub">JPG, PNG · 최대 20MB</p>
          </div>
        </div>

        <div class="ct-input-group">
          <button
            class="btn-secondary"
            :disabled="!multiLaneFile || isExtractingLanes"
            @click="extractLanesForTraining"
          >
            <span v-if="isExtractingLanes" class="spinner spinner--dark"></span>
            <span v-else>레인 분석</span>
          </button>
          <button
            class="btn-secondary"
            style="margin-top:0.35rem"
            :disabled="!multiLaneFile || isExtractingCt"
            @click="autoExtractCt"
            title="이미지에 표시된 Ct값을 AI가 자동으로 읽어옵니다"
          >
            <span v-if="isExtractingCt" class="spinner spinner--dark"></span>
            <span v-else>✨ Ct 자동 추출</span>
          </button>
          <p v-if="multiLaneFile" class="file-chip" style="margin-top:0.35rem">
            <span>{{ multiLaneFile.name }}</span>
            <button class="file-chip__remove" @click="multiLaneFile = null; multiLaneExtracted = []; laneCtInputs = {}">×</button>
          </p>
        </div>
      </div>

      <div v-if="multiLaneExtracted.length > 0" class="lane-result-wrap" style="margin-top:1rem">
        <div class="lane-result-header">
          <span class="lane-result-title">레인별 Ct값 입력</span>
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
                  <input
                    v-if="lane.concentrationLabel !== 'M' && lane.concentrationLabel !== 'NTC'"
                    v-model.number="laneCtInputs[lane.concentrationLabel]"
                    type="number"
                    step="0.01"
                    min="0"
                    max="50"
                    placeholder="예: 24.35"
                    class="ct-input ct-input--sm"
                  />
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="predict-actions" style="margin-top:0.75rem">
          <button
            class="btn-primary"
            :disabled="isUploadingMultiLane || Object.keys(laneCtInputs).length === 0"
            @click="uploadMultiLaneGel"
          >
            <span v-if="isUploadingMultiLane" class="spinner"></span>
            <span v-else>저장</span>
          </button>
        </div>
      </div>
    </section>

    <!-- 모델 학습 -->
    <section class="train-section">
      <div class="train-header">
        <h2 class="section-title">모델 재학습</h2>
        <button
          class="btn-secondary"
          :disabled="records.length < 3 || isTraining"
          @click="trainModel"
        >
          <span v-if="isTraining" class="spinner"></span>
          <span v-else>학습 실행 ({{ records.length }}개)</span>
        </button>
      </div>
      <p class="section-desc">저장된 학습 데이터 전체를 사용해 모델을 재학습합니다. 최소 3개 이상 필요. 학습 목표: ① mecA 이진 분류(양성/음성) ② 저농도(10¹~10³) LOD 탐지 ③ 프라이머 다이머 노이즈 필터링.</p>

      <div v-if="trainResult" class="result-box result-box--info">
        <strong>학습 완료</strong> · 모델: {{ trainResult.model_type }}
        · 학습 R²: {{ trainResult.train_r2 }}
        · CV R²: {{ trainResult.cv_r2_mean }} ± {{ trainResult.cv_r2_std }}
        · RMSE: {{ trainResult.train_rmse }} Ct
        · 샘플: {{ trainResult.sample_count }}개
        <br><span class="result-objectives">학습 목표 반영: mecA 이진 분류 · 저농도(10¹~10³) LOD 탐지 · 프라이머 다이머 노이즈 필터링</span>
      </div>
    </section>

    <!-- 학습 데이터 목록 -->
    <section class="records-section">
      <div class="records-header">
        <h2 class="section-title">학습 데이터 목록</h2>
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

      <div v-if="isLoadingRecords" class="list-loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="records.length === 0" class="list-empty">
        등록된 학습 데이터가 없습니다.
      </div>

      <div v-else class="records-table-wrap">
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
              <th>파일명</th>
              <th>레인</th>
              <th>레이블</th>
              <th>Ct값</th>
              <th>밝기</th>
              <th>면적</th>
              <th>상대강도</th>
              <th>등록일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in records"
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
              <td>{{ fmt(r.bandIntensity) }}</td>
              <td>{{ fmt(r.bandArea) }}</td>
              <td>{{ fmt(r.relativeIntensity) }}</td>
              <td class="col-date">{{ formatDate(r.createdAt) }}</td>
              <td @click.stop>
                <button class="btn-delete" @click="deleteRecord(r.id)">삭제</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useGelTraining } from '@/composables/useGelTraining'
import { fmt, formatDate } from '@/utils/format'

const emit = defineEmits(['model-updated'])

const {
  records, isLoadingRecords, selectedIds, isDeleting,
  isTraining, trainResult,
  multiLaneFile, multiLaneFileInput, multiLaneExtracted, laneCtInputs,
  isExtractingLanes, isExtractingCt, isUploadingMultiLane, isDraggingMulti,
  allSelected, someSelected,
  loadRecords, deleteRecord, deleteSelected, toggleSelectAll, toggleSelect,
  trainModel, onMultiLaneFileChange, onMultiLaneDrop,
  autoExtractCt, extractLanesForTraining, uploadMultiLaneGel
} = useGelTraining(emit)

onMounted(loadRecords)
</script>

<style scoped>
@import '@/assets/css/gel/shared.css';
@import '@/assets/css/gel/train.css';
</style>
