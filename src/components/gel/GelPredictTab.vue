<template>
  <div class="tab-content">
    <section class="predict-section">
      <h2 class="section-title">새 이미지로 Ct값 예측</h2>
      <p class="section-desc">젤 이미지를 여러 장 업로드하면 이미지당 10개 레인을 분석하여 레인별 Ct값을 예측합니다.</p>

      <div v-if="!modelStatus.trained" class="result-box result-box--warn">
        모델이 아직 학습되지 않았습니다. 학습 데이터 탭에서 데이터를 등록하고 학습을 실행하세요.
      </div>

      <div
        class="upload-area upload-area--wide"
        :class="{ 'upload-area--drag': isGelPredictDragging }"
        @dragover.prevent="isGelPredictDragging = true"
        @dragleave.prevent="isGelPredictDragging = false"
        @drop.prevent="onGelPredictDrop"
      >
        <input
          ref="gelPredictFileInput"
          type="file"
          accept="image/*"
          multiple
          class="upload-area__input"
          @change="onGelPredictFilesChange"
        />
        <div class="upload-area__inner" @click="gelPredictFileInput.click()">
          <div class="upload-area__icon">🔬</div>
          <p class="upload-area__text">젤 이미지를 끌어다 놓거나 클릭 (여러 장 가능)</p>
          <p class="upload-area__sub">JPG, PNG · 최대 20MB</p>
        </div>
      </div>

      <div class="predict-actions" style="margin-top:0.75rem">
        <button
          class="btn-secondary"
          :disabled="!hasPendingGelItems || isAnyGelPredicting || !modelStatus.trained"
          @click="predictAllGelLanes"
        >
          <span v-if="isAnyGelPredicting" class="spinner spinner--dark"></span>
          <span v-else>전체 예측 ({{ gelPredictItems.filter(i => i.status === 'pending').length }}개)</span>
        </button>
        <span class="predict-count">{{ gelPredictItems.length }}개 이미지</span>
        <button v-if="gelPredictItems.length > 0" class="btn-clear" @click="clearGelPredict">전체 초기화</button>
      </div>

      <div
        v-for="(item, idx) in gelPredictItems"
        :key="idx"
        class="gel-predict-panel"
        :class="{
          'gel-predict-panel--done': item.status === 'done',
          'gel-predict-panel--error': item.status === 'error'
        }"
      >
        <div class="gel-predict-panel__header">
          <span class="gel-predict-panel__name">{{ item.file.name }}</span>
          <span v-if="item.status === 'pending'" class="chip chip--gray">대기</span>
          <span v-else-if="item.status === 'predicting'" class="chip chip--orange">분석 중</span>
          <span v-else-if="item.status === 'error'" class="chip chip--red">오류</span>
          <span v-if="item.status === 'done' && itemLod(item)" class="lod-badge">LOD: {{ itemLod(item) }}</span>
          <div style="margin-left:auto;display:flex;gap:0.5rem;align-items:center">
            <button
              class="btn-secondary"
              style="padding:0.3rem 0.75rem;font-size:0.8rem"
              :disabled="item.status === 'predicting' || !modelStatus.trained"
              @click="predictSingleGelItem(item)"
            >
              <span v-if="item.status === 'predicting'" class="spinner spinner--dark spinner--sm"></span>
              <span v-else>예측</span>
            </button>
            <button class="btn-delete" @click="removeGelPredictItem(idx)">×</button>
          </div>
        </div>

        <p v-if="item.status === 'error'" class="error-text" style="margin:0.4rem 0 0;font-size:0.82rem">
          {{ item.errorMsg }}
        </p>

        <div v-if="item.status === 'done' && item.laneResults.length > 0" class="lane-result-wrap" style="margin-top:0.75rem">
          <div class="records-table-wrap">
            <table class="records-table lane-table">
              <thead>
                <tr>
                  <th>레인</th>
                  <th>레이블</th>
                  <th>예측 Ct</th>
                  <th>실측 Ct</th>
                  <th>밝기</th>
                  <th>상대강도</th>
                  <th>밴드 면적</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="lane in item.laneResults"
                  :key="lane.laneIndex"
                  :class="laneRowClass(lane)"
                >
                  <td>{{ lane.laneIndex }}</td>
                  <td class="lane-label-cell">{{ lane.concentrationLabel }}</td>
                  <td class="col-ct">
                    <span v-if="lane.concentrationLabel === 'M' || lane.concentrationLabel === 'NTC'" class="muted">—</span>
                    <span v-else-if="lane.isNegative" class="muted">—</span>
                    <span v-else>{{ lane.predictedCt != null ? lane.predictedCt.toFixed(2) : '—' }}</span>
                  </td>
                  <td>
                    <input
                      v-if="lane.concentrationLabel !== 'M' && lane.concentrationLabel !== 'NTC'"
                      v-model.number="item.actualCtInputs[lane.concentrationLabel]"
                      type="number"
                      step="0.01"
                      min="0"
                      max="50"
                      placeholder="실측값"
                      class="ct-input ct-input--sm ct-input--actual"
                    />
                    <span v-else class="muted">—</span>
                  </td>
                  <td>{{ fmt(lane.bandIntensity) }}</td>
                  <td>{{ fmt(lane.relativeIntensity) }}</td>
                  <td>{{ fmt(lane.bandArea) }}</td>
                  <td>
                    <span v-if="lane.concentrationLabel === 'M'" class="chip chip--gray">래더</span>
                    <span v-else-if="lane.concentrationLabel === 'NTC' && lane.isNegative" class="chip chip--green">NTC 음성</span>
                    <span v-else-if="lane.concentrationLabel === 'NTC' && !lane.isNegative" class="chip chip--red">오염의심 ⚠</span>
                    <span v-else-if="lane.isSaturated" class="chip chip--orange">포화 (고농도)</span>
                    <span v-else-if="lane.isNegative" class="chip chip--gray">mecA 음성</span>
                    <span v-else-if="lane.isPrimerDimer" class="chip chip--orange">다이머 노이즈</span>
                    <span v-else class="chip chip--green">mecA 양성</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="lod-summary">
            <div class="lod-summary__title">저농도 구간 집중 분석 (10¹~10³)</div>
            <div class="lod-summary__lanes">
              <div
                v-for="entry in itemLowConcLanes(item)"
                :key="entry.label"
                class="lod-lane-card"
                :class="entry.lane ? (entry.detected ? 'lod-lane-card--pos' : 'lod-lane-card--neg') : 'lod-lane-card--missing'"
              >
                <span class="lod-lane-card__label">{{ entry.label }}</span>
                <span v-if="!entry.lane" class="lod-lane-card__status muted">레인 없음</span>
                <template v-else>
                  <span class="lod-lane-card__status">{{ entry.detected ? 'mecA 양성' : 'mecA 음성' }}</span>
                  <span class="lod-lane-card__intensity">강도: {{ fmt(entry.lane.relativeIntensity) }}</span>
                </template>
              </div>
            </div>
            <p v-if="itemLod(item)" class="lod-desc">
              검출 한계(LOD): <strong>{{ itemLod(item) }}</strong> — Tm 59.72°C 프라이머 기준, 육안 확인 불가 구간에서의 AI 탐지 결과입니다.
            </p>
            <p v-else class="lod-desc lod-desc--none">저농도 구간(10¹~10³) 전 레인 mecA 음성 — LOD 미달 또는 음성 샘플.</p>
          </div>

          <div class="register-training-wrap">
            <div class="register-training-hint">실측 Ct값을 입력한 레인을 학습 데이터로 등록합니다.</div>
            <div class="register-training-actions">
              <button
                class="btn-primary"
                :disabled="item.isRegistering || !hasActualCt(item)"
                @click="uploadPredictAsTraining(item)"
              >
                <span v-if="item.isRegistering" class="spinner"></span>
                <span v-else>학습 데이터로 등록 ({{ countActualCt(item) }}개 레인)</span>
              </button>
              <span
                v-if="item.registerMsg"
                class="register-msg"
                :class="{
                  'register-msg--ok': item.registerMsg.type === 'ok',
                  'register-msg--dup': item.registerMsg.type === 'duplicate',
                  'register-msg--err': item.registerMsg.type === 'error'
                }"
              >{{ item.registerMsg.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useGelPredict } from '@/composables/useGelPredict'
import { fmt } from '@/utils/format'

defineProps({
  modelStatus: { type: Object, required: true }
})

const emit = defineEmits(['records-changed'])

const {
  gelPredictItems, isGelPredictDragging, gelPredictFileInput,
  hasPendingGelItems, isAnyGelPredicting,
  onGelPredictFilesChange, onGelPredictDrop,
  removeGelPredictItem, clearGelPredict,
  predictSingleGelItem, predictAllGelLanes,
  itemLod, laneRowClass, hasActualCt, countActualCt,
  uploadPredictAsTraining, itemLowConcLanes
} = useGelPredict(emit)
</script>

<style scoped>
@import '@/assets/css/gel/shared.css';
@import '@/assets/css/gel/predict.css';
</style>
