<template>
  <div class="gel-analysis">

    <!-- 탭 헤더 -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'train' }"
        @click="activeTab = 'train'"
      >
        훈련 데이터 관리
      </button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'predict' }"
        @click="activeTab = 'predict'"
      >
        Ct값 예측
      </button>

      <!-- 모델 상태 배지 -->
      <div class="model-badge" :class="modelStatus.trained ? 'model-badge--ok' : 'model-badge--none'">
        <span v-if="modelStatus.trained">
          모델 학습됨 · R² {{ modelStatus.cv_r2_mean }} · {{ modelStatus.sample_count }}개
        </span>
        <span v-else>모델 미학습</span>
      </div>
    </div>

    <!-- ────────────── 탭 1: 훈련 데이터 관리 ────────────── -->
    <div v-if="activeTab === 'train'" class="tab-content">

      <!-- 업로드 폼 -->
      <section class="upload-section">
        <h2 class="section-title">훈련 데이터 등록</h2>
        <p class="section-desc">PCR 젤 이미지와 외부 기관에서 측정한 qPCR Ct값을 함께 업로드합니다.</p>

        <div class="upload-row">
          <!-- 드래그&드롭 영역 -->
          <div
            class="upload-area"
            :class="{ 'upload-area--drag': isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
          >
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="upload-area__input"
              @change="onFileChange"
            />
            <div class="upload-area__inner" @click="$refs.fileInput.click()">
              <div class="upload-area__icon">🧫</div>
              <p class="upload-area__text">젤 이미지를 끌어다 놓거나 클릭</p>
              <p class="upload-area__sub">JPG, PNG · 최대 20MB</p>
            </div>
          </div>

          <!-- Ct값 입력 + 업로드 버튼 -->
          <div class="ct-input-group">
            <label class="input-label">실측 Ct값 (qPCR)</label>
            <input
              v-model.number="ctValue"
              type="number"
              step="0.01"
              min="0"
              max="50"
              placeholder="예: 24.35"
              class="ct-input"
            />
            <p v-if="selectedFile" class="file-chip">
              <span>{{ selectedFile.name }}</span>
              <button class="file-chip__remove" @click="clearFile">×</button>
            </p>
            <button
              class="btn-primary"
              :disabled="!selectedFile || ctValue === null || isUploading"
              @click="uploadTrainingData"
            >
              <span v-if="isUploading" class="spinner"></span>
              <span v-else>업로드</span>
            </button>
          </div>
        </div>

        <!-- 업로드 결과 -->
        <div v-if="uploadResult" class="result-box result-box--success">
          <strong>업로드 완료:</strong> {{ uploadResult.fileName }}
          — 밝기 {{ fmt(uploadResult.bandIntensity) }}, 면적 {{ fmt(uploadResult.bandArea) }},
          상대강도 {{ fmt(uploadResult.relativeIntensity) }}
          <span v-if="uploadResult.warning" class="warn-text"> ⚠ {{ uploadResult.warning }}</span>
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
        <p class="section-desc">저장된 훈련 데이터 전체를 사용해 회귀 모델을 재학습합니다. 최소 3개 이상 필요.</p>

        <div v-if="trainResult" class="result-box result-box--info">
          <strong>학습 완료</strong> · 모델: {{ trainResult.model_type }}
          · 훈련 R²: {{ trainResult.train_r2 }}
          · CV R²: {{ trainResult.cv_r2_mean }} ± {{ trainResult.cv_r2_std }}
          · RMSE: {{ trainResult.train_rmse }} Ct
          · 샘플: {{ trainResult.sample_count }}개
        </div>
      </section>

      <!-- 훈련 데이터 목록 -->
      <section class="records-section">
        <h2 class="section-title">훈련 데이터 목록</h2>

        <div v-if="isLoadingRecords" class="list-loading">
          <div class="spinner"></div>
        </div>

        <div v-else-if="records.length === 0" class="list-empty">
          등록된 훈련 데이터가 없습니다.
        </div>

        <div v-else class="records-table-wrap">
          <table class="records-table">
            <thead>
              <tr>
                <th>파일명</th>
                <th>Ct값</th>
                <th>밝기</th>
                <th>면적</th>
                <th>상대강도</th>
                <th>등록일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in records" :key="r.id" :class="{ 'row--warn': r.warning }">
                <td class="col-name">{{ r.fileName }}</td>
                <td class="col-ct">{{ r.ctValue }}</td>
                <td>{{ fmt(r.bandIntensity) }}</td>
                <td>{{ fmt(r.bandArea) }}</td>
                <td>{{ fmt(r.relativeIntensity) }}</td>
                <td class="col-date">{{ formatDate(r.createdAt) }}</td>
                <td>
                  <button class="btn-delete" @click="deleteRecord(r.id)">삭제</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- ────────────── 탭 2: Ct값 예측 ────────────── -->
    <div v-if="activeTab === 'predict'" class="tab-content">
      <section class="predict-section">
        <h2 class="section-title">새 이미지로 Ct값 예측</h2>
        <p class="section-desc">PCR 젤 이미지를 업로드하면 학습된 모델이 qPCR Ct값을 예측합니다.</p>

        <div v-if="!modelStatus.trained" class="result-box result-box--warn">
          모델이 아직 학습되지 않았습니다. 훈련 데이터 탭에서 데이터를 등록하고 학습을 실행하세요.
        </div>

        <div class="upload-row">
          <div
            class="upload-area"
            :class="{ 'upload-area--drag': isPredictDragging }"
            @dragover.prevent="isPredictDragging = true"
            @dragleave.prevent="isPredictDragging = false"
            @drop.prevent="onPredictDrop"
          >
            <input
              ref="predictFileInput"
              type="file"
              accept="image/*"
              class="upload-area__input"
              @change="onPredictFileChange"
            />
            <div class="upload-area__inner" @click="$refs.predictFileInput.click()">
              <div class="upload-area__icon">🔬</div>
              <p class="upload-area__text">예측할 젤 이미지 선택</p>
              <p class="upload-area__sub">JPG, PNG · 최대 20MB</p>
            </div>
          </div>

          <div class="ct-input-group">
            <p v-if="predictFile" class="file-chip">
              <span>{{ predictFile.name }}</span>
              <button class="file-chip__remove" @click="predictFile = null">×</button>
            </p>
            <button
              class="btn-primary"
              :disabled="!predictFile || isPredicting || !modelStatus.trained"
              @click="predictCt"
            >
              <span v-if="isPredicting" class="spinner"></span>
              <span v-else>예측하기</span>
            </button>
          </div>
        </div>

        <!-- 예측 결과 -->
        <div v-if="predictResult" class="predict-result">
          <div class="predict-result__ct">
            <span class="predict-result__label">예측 Ct값</span>
            <span class="predict-result__value">{{ predictResult.predictedCt }}</span>
          </div>
          <div class="predict-result__meta">
            <span>모델 R²: {{ predictResult.modelR2 }}</span>
            <span>RMSE: ±{{ predictResult.modelRmse }} Ct</span>
          </div>
          <div v-if="predictResult.features" class="predict-result__features">
            <div class="feature-chip">밝기 {{ fmt(predictResult.features.band_intensity) }}</div>
            <div class="feature-chip">면적 {{ fmt(predictResult.features.band_area) }}</div>
            <div class="feature-chip">상대강도 {{ fmt(predictResult.features.relative_intensity) }}</div>
            <div class="feature-chip">너비 {{ fmt(predictResult.features.band_width) }}</div>
          </div>
          <div v-if="predictResult.features?.warning" class="warn-text">
            ⚠ {{ predictResult.features.warning }}
          </div>
        </div>
      </section>
    </div>

  </div>
</template>

<script>
import api from '@/axios'

export default {
  name: 'GelAnalysisView',
  data() {
    return {
      activeTab: 'train',

      // 훈련 데이터 업로드
      selectedFile: null,
      ctValue: null,
      isDragging: false,
      isUploading: false,
      uploadResult: null,

      // 훈련
      isTraining: false,
      trainResult: null,

      // 목록
      records: [],
      isLoadingRecords: false,

      // 예측
      predictFile: null,
      isPredictDragging: false,
      isPredicting: false,
      predictResult: null,

      // 모델 상태
      modelStatus: { trained: false }
    }
  },
  mounted() {
    this.loadRecords()
    this.loadModelStatus()
  },
  methods: {
    // ── 파일 선택 ────────────────────────────────────────────────
    onFileChange(e) {
      this.selectedFile = e.target.files[0] || null
    },
    onDrop(e) {
      this.isDragging = false
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) this.selectedFile = file
    },
    clearFile() {
      this.selectedFile = null
      this.$refs.fileInput.value = ''
    },

    onPredictFileChange(e) {
      this.predictFile = e.target.files[0] || null
    },
    onPredictDrop(e) {
      this.isPredictDragging = false
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) this.predictFile = file
    },

    // ── 훈련 데이터 업로드 ──────────────────────────────────────
    async uploadTrainingData() {
      if (!this.selectedFile || this.ctValue === null) return
      this.isUploading = true
      this.uploadResult = null
      try {
        const form = new FormData()
        form.append('file', this.selectedFile)
        form.append('ctValue', this.ctValue)
        const { data } = await api.post('/api/gel/upload', form)
        this.uploadResult = data
        this.clearFile()
        this.ctValue = null
        await this.loadRecords()
      } catch (e) {
        alert('업로드 실패: ' + (e.response?.data || e.message))
      } finally {
        this.isUploading = false
      }
    },

    // ── 목록 로드 / 삭제 ────────────────────────────────────────
    async loadRecords() {
      this.isLoadingRecords = true
      try {
        const { data } = await api.get('/api/gel/records')
        this.records = data
      } catch (e) {
        console.error('목록 로드 실패', e)
      } finally {
        this.isLoadingRecords = false
      }
    },
    async deleteRecord(id) {
      if (!confirm('이 훈련 데이터를 삭제하시겠습니까?')) return
      try {
        await api.delete(`/api/gel/records/${id}`)
        this.records = this.records.filter(r => r.id !== id)
      } catch (e) {
        alert('삭제 실패: ' + (e.response?.data || e.message))
      }
    },

    // ── 모델 학습 ───────────────────────────────────────────────
    async trainModel() {
      this.isTraining = true
      this.trainResult = null
      try {
        const { data } = await api.post('/api/gel/train')
        this.trainResult = data
        await this.loadModelStatus()
      } catch (e) {
        alert('학습 실패: ' + (e.response?.data?.error || e.message))
      } finally {
        this.isTraining = false
      }
    },

    // ── Ct값 예측 ───────────────────────────────────────────────
    async predictCt() {
      if (!this.predictFile) return
      this.isPredicting = true
      this.predictResult = null
      try {
        const form = new FormData()
        form.append('file', this.predictFile)
        const { data } = await api.post('/api/gel/predict', form)
        this.predictResult = data
      } catch (e) {
        alert('예측 실패: ' + (e.response?.data || e.message))
      } finally {
        this.isPredicting = false
      }
    },

    // ── 모델 상태 ───────────────────────────────────────────────
    async loadModelStatus() {
      try {
        const { data } = await api.get('/api/gel/model/status')
        this.modelStatus = data
      } catch {
        this.modelStatus = { trained: false }
      }
    },

    // ── 유틸 ────────────────────────────────────────────────────
    fmt(v) {
      if (v === null || v === undefined) return '—'
      return Number(v).toFixed(2)
    },
    formatDate(dt) {
      if (!dt) return ''
      return new Date(dt).toLocaleDateString('ko-KR', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      })
    }
  }
}
</script>

<style scoped>
.gel-analysis {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

/* ── 탭 바 ─────────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--card-border);
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 0.6rem 1.25rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-size: 0.95rem;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.tab-btn--active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.model-badge {
  margin-left: auto;
  font-size: 0.8rem;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--card-border);
}

.model-badge--ok  { color: #4caf50; border-color: #4caf50; }
.model-badge--none { color: var(--text-secondary); }

/* ── 섹션 공통 ─────────────────────────────────────────────── */
.tab-content { display: flex; flex-direction: column; gap: 2rem; }

.section-title { font-size: 1rem; font-weight: 600; margin: 0 0 0.25rem; }
.section-desc  { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 1rem; }

/* ── 업로드 영역 ───────────────────────────────────────────── */
.upload-row {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.upload-area {
  flex: 1;
  min-width: 220px;
  border: 2px dashed var(--card-border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s;
  position: relative;
}

.upload-area--drag { border-color: var(--accent); }
.upload-area:hover  { border-color: var(--accent); }

.upload-area__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.upload-area__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  gap: 0.4rem;
}

.upload-area__icon { font-size: 2rem; }
.upload-area__text { font-size: 0.9rem; margin: 0; }
.upload-area__sub  { font-size: 0.75rem; color: var(--text-secondary); margin: 0; }

/* ── Ct 입력 그룹 ──────────────────────────────────────────── */
.ct-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 180px;
}

.input-label { font-size: 0.85rem; color: var(--text-secondary); }

.ct-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 1rem;
  width: 100%;
}

.ct-input:focus { outline: none; border-color: var(--accent); }

/* ── 파일 칩 ───────────────────────────────────────────────── */
.file-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin: 0;
  overflow: hidden;
}

.file-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-chip__remove {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}

/* ── 버튼 ──────────────────────────────────────────────────── */
.btn-primary {
  padding: 0.55rem 1.25rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 0.45rem 1rem;
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-delete {
  padding: 0.25rem 0.6rem;
  background: transparent;
  border: 1px solid #e57373;
  color: #e57373;
  border-radius: 4px;
  font-size: 0.78rem;
  cursor: pointer;
}

/* ── 결과 박스 ─────────────────────────────────────────────── */
.result-box {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  line-height: 1.6;
  margin-top: 0.75rem;
}

.result-box--success { background: rgba(76, 175, 80, 0.1); border: 1px solid #4caf50; }
.result-box--info    { background: rgba(33, 150, 243, 0.1); border: 1px solid #2196f3; }
.result-box--warn    { background: rgba(255, 152, 0, 0.1);  border: 1px solid #ff9800; }

.warn-text { color: #ff9800; font-size: 0.82rem; }

/* ── 학습 헤더 ─────────────────────────────────────────────── */
.train-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.25rem;
}

/* ── 테이블 ────────────────────────────────────────────────── */
.records-table-wrap { overflow-x: auto; }

.records-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.records-table th,
.records-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--card-border);
  text-align: left;
  white-space: nowrap;
}

.records-table th { color: var(--text-secondary); font-weight: 500; }

.col-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.col-ct   { font-weight: 600; color: var(--accent); }
.col-date { color: var(--text-secondary); }

.row--warn td { background: rgba(255, 152, 0, 0.05); }

/* ── 예측 결과 ─────────────────────────────────────────────── */
.predict-result {
  margin-top: 1.5rem;
  padding: 1.5rem;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.predict-result__ct {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.predict-result__label { font-size: 0.85rem; color: var(--text-secondary); }
.predict-result__value { font-size: 2.4rem; font-weight: 700; color: var(--accent); }

.predict-result__meta {
  display: flex;
  gap: 1.5rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.predict-result__features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.feature-chip {
  padding: 0.2rem 0.6rem;
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

/* ── 로딩 / 빈 상태 ────────────────────────────────────────── */
.list-loading, .list-empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

/* ── 스피너 ────────────────────────────────────────────────── */
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── 반응형 ────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .upload-row { flex-direction: column; }
  .ct-input-group { min-width: unset; }
  .predict-result__ct { flex-direction: column; gap: 0.25rem; }
}
</style>
