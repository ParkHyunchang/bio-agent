<template>
  <div class="exam-analysis">

    <!-- 왼쪽 패널: 업로드 + 기록 목록 -->
    <aside class="records-panel">
      <!-- 업로드 영역 -->
      <div class="upload-area"
           :class="{ 'upload-area--drag': isDragging }"
           @dragover.prevent="isDragging = true"
           @dragleave.prevent="isDragging = false"
           @drop.prevent="onDrop">
        <input
          ref="fileInput"
          type="file"
          multiple
          accept="image/*"
          class="upload-area__input"
          @change="onFileChange"
        />
        <div class="upload-area__inner" @click="$refs.fileInput.click()">
          <div class="upload-area__icon">📎</div>
          <p class="upload-area__text">이미지를 끌어다 놓거나 클릭하여 선택</p>
          <p class="upload-area__sub">JPG, PNG, WEBP · 파일당 최대 20MB</p>
        </div>
      </div>

      <!-- 선택된 파일 미리보기 -->
      <div v-if="selectedFiles.length > 0" class="file-preview">
        <div v-for="(f, i) in selectedFiles" :key="i" class="file-chip">
          <span class="file-chip__name">{{ f.name }}</span>
          <button class="file-chip__remove" @click="removeFile(i)">×</button>
        </div>
      </div>

      <button
        class="btn-primary"
        :disabled="selectedFiles.length === 0 || isUploading"
        @click="uploadFiles"
      >
        <span v-if="isUploading" class="spinner"></span>
        <span v-else>OCR 추출</span>
      </button>

      <!-- 저장된 기록 목록 -->
      <div class="records-list">
        <div class="records-list__header">저장된 기록</div>

        <div v-if="records.length === 0" class="list-empty">
          <p>아직 저장된 기록이 없습니다</p>
        </div>

        <div
          v-for="record in records"
          :key="record.id"
          class="record-item"
          :class="{ 'record-item--active': selectedRecord?.id === record.id }"
          @click="selectRecord(record)"
        >
          <div class="record-item__name">{{ record.fileName }}</div>
          <div class="record-item__meta">
            <span class="badge">{{ record.documentType }}</span>
            <span class="record-item__date">{{ formatDate(record.createdAt) }}</span>
          </div>
          <button class="record-item__delete" @click.stop="deleteRecord(record.id)">삭제</button>
        </div>
      </div>
    </aside>

    <!-- 오른쪽 패널: 추출 결과 -->
    <main class="detail-panel">

      <!-- 기록 미선택 상태 -->
      <div v-if="!selectedRecord && !isUploading" class="panel-empty">
        <div class="panel-empty__icon">🔬</div>
        <p>이미지를 업로드하거나<br>기록을 선택하세요</p>
      </div>

      <!-- 업로드/OCR 진행 중 -->
      <div v-else-if="isUploading" class="panel-loading">
        <div class="spinner spinner--lg"></div>
        <p>Claude Vision으로 이미지를 분석하고 있습니다...</p>
      </div>

      <!-- 기록 상세 -->
      <div v-else-if="selectedRecord" class="record-detail">
        <div class="record-detail__header">
          <h2 class="record-detail__title">{{ selectedRecord.fileName }}</h2>
          <div class="record-detail__badges">
            <span class="badge">{{ selectedRecord.documentType }}</span>
            <span class="badge badge--muted">{{ formatDate(selectedRecord.createdAt) }}</span>
          </div>
        </div>

        <!-- 원시 텍스트 -->
        <div class="raw-text-box">
          <div class="box-label">인식된 텍스트</div>
          <pre class="raw-text-box__text">{{ selectedRecord.rawText || '텍스트 없음' }}</pre>
        </div>

        <!-- 추출 항목 테이블 -->
        <div v-if="selectedRecord.items && selectedRecord.items.length > 0" class="items-section">
          <div class="box-label">추출된 항목 ({{ selectedRecord.items.length }}개)</div>
          <div class="items-table-wrap">
            <table class="items-table">
              <colgroup>
                <col class="col-name">
                <col class="col-value">
                <col class="col-unit">
                <col class="col-ref">
                <col class="col-status">
              </colgroup>
              <thead>
                <tr>
                  <th>항목명</th>
                  <th>수치</th>
                  <th>단위</th>
                  <th>참고범위</th>
                  <th>판정</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, i) in selectedRecord.items"
                  :key="i"
                  :class="{ 'row--abnormal': item.isAbnormal }"
                >
                  <td data-label="항목명" class="td--name">{{ item.itemName }}</td>
                  <td data-label="수치" class="td--value">{{ item.value || '—' }}</td>
                  <td data-label="단위" class="td--unit">{{ item.unit || '—' }}</td>
                  <td data-label="참고범위" class="td--ref">{{ item.referenceRange || '—' }}</td>
                  <td data-label="판정">
                    <span v-if="item.isAbnormal" class="status status--abnormal">이상</span>
                    <span v-else class="status status--normal">정상</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else class="panel-empty panel-empty--sm">
          <p>추출된 항목 데이터가 없습니다</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import axios from '@/axios'

export default {
  name: 'ExamAnalysisView',
  data() {
    return {
      isDragging: false,
      selectedFiles: [],
      isUploading: false,
      records: [],
      selectedRecord: null,
    }
  },
  mounted() {
    this.loadRecords()
  },
  methods: {
    onFileChange(e) {
      this.addFiles(Array.from(e.target.files))
      e.target.value = ''
    },
    onDrop(e) {
      this.isDragging = false
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
      this.addFiles(files)
    },
    addFiles(files) {
      const existing = new Set(this.selectedFiles.map(f => f.name))
      files.forEach(f => { if (!existing.has(f.name)) this.selectedFiles.push(f) })
    },
    removeFile(index) {
      this.selectedFiles.splice(index, 1)
    },

    async uploadFiles() {
      if (this.selectedFiles.length === 0 || this.isUploading) return
      this.isUploading = true
      this.selectedRecord = null
      try {
        const formData = new FormData()
        this.selectedFiles.forEach(f => formData.append('files', f))
        const res = await axios.post('/api/exam/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        this.selectedFiles = []
        await this.loadRecords()
        if (res.data.length > 0) {
          this.selectedRecord = res.data[res.data.length - 1]
          if (window.innerWidth <= 768) {
            this.$nextTick(() => {
              this.$el.querySelector('.detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            })
          }
        }
      } catch (e) {
        console.error('업로드 오류', e)
      } finally {
        this.isUploading = false
      }
    },

    async loadRecords() {
      try {
        const res = await axios.get('/api/exam/records')
        this.records = res.data
      } catch (e) {
        console.error('기록 로드 오류', e)
      }
    },

    selectRecord(record) {
      this.selectedRecord = record
      if (window.innerWidth <= 768) {
        this.$nextTick(() => {
          this.$el.querySelector('.detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    },

    async deleteRecord(id) {
      try {
        await axios.delete(`/api/exam/records/${id}`)
        if (this.selectedRecord?.id === id) this.selectedRecord = null
        await this.loadRecords()
      } catch (e) {
        console.error('삭제 오류', e)
      }
    },

    formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    }
  }
}
</script>

<style scoped>
.exam-analysis {
  display: grid;
  grid-template-columns: 320px 1fr;
  height: calc(100vh - 60px);
  overflow: hidden;
}

/* ===== 왼쪽 패널 ===== */
.records-panel {
  border-right: 1px solid var(--card-border);
  background: var(--surface);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ===== 업로드 영역 ===== */
.upload-area {
  margin: 1rem;
  border: 1.5px dashed var(--card-border);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.upload-area--drag,
.upload-area:hover {
  border-color: var(--accent);
  background: var(--accent-dim);
}

.upload-area__input {
  display: none;
}

.upload-area__inner {
  padding: 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.upload-area__icon {
  font-size: 1.5rem;
}

.upload-area__text {
  font-size: 0.82rem;
  color: var(--text-secondary);
  text-align: center;
}

.upload-area__sub {
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* ===== 파일 미리보기 ===== */
.file-preview {
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.file-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface-2);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  padding: 0.3rem 0.6rem;
}

.file-chip__name {
  font-size: 0.78rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-chip__remove {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.2rem;
  flex-shrink: 0;
}

.file-chip__remove:hover {
  color: var(--accent);
}

/* ===== OCR 버튼 ===== */
.btn-primary {
  margin: 0.75rem 1rem;
  padding: 0.6rem;
  width: calc(100% - 2rem);
  background: var(--accent);
  color: #080d0b;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  transition: opacity 0.2s;
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ===== 기록 목록 ===== */
.records-list {
  flex: 1;
  border-top: 1px solid var(--card-border);
}

.records-list__header {
  padding: 0.6rem 1rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--card-border);
}

.list-empty {
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.record-item {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--card-border);
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.record-item:hover {
  background: var(--surface-2);
}

.record-item--active {
  background: var(--accent-dim);
  border-left: 3px solid var(--accent);
}

.record-item__name {
  font-size: 0.85rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.3rem;
}

.record-item--active .record-item__name {
  color: var(--accent-light);
}

.record-item__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.record-item__date {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.record-item__delete {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: 1px solid var(--card-border);
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 0.72rem;
  padding: 0.15rem 0.4rem;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  opacity: 0;
}

.record-item:hover .record-item__delete {
  opacity: 1;
}

.record-item__delete:hover {
  color: #e06c6c;
  border-color: #e06c6c;
}

/* ===== 오른쪽 상세 패널 ===== */
.detail-panel {
  overflow-y: auto;
  padding: 2rem;
  background: var(--primary);
}

.record-detail {
  max-width: 780px;
}

.record-detail__header {
  margin-bottom: 1.5rem;
}

.record-detail__title {
  font-family: "Montserrat", sans-serif;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.6rem;
  word-break: break-all;
}

.record-detail__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* ===== 원시 텍스트 ===== */
.raw-text-box {
  background: var(--surface-2);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.box-label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 0.75rem;
}

.raw-text-box__text {
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.8;
  white-space: pre-wrap;
  font-family: "DM Sans", sans-serif;
  max-height: 200px;
  overflow-y: auto;
}

/* ===== 항목 테이블 ===== */
.items-section {
  background: var(--surface-2);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 1.25rem;
}

.items-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin-top: 0.5rem;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  table-layout: fixed;
}

/* 컬럼 너비 고정 */
.col-name   { width: 30%; }
.col-value  { width: 28%; }
.col-unit   { width: 10%; }
.col-ref    { width: 18%; }
.col-status { width: 14%; }

.items-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  border-bottom: 1px solid var(--card-border);
  white-space: nowrap;
}

.items-table td {
  padding: 0.55rem 0.75rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--card-border);
  vertical-align: middle;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.items-table tbody tr:last-child td {
  border-bottom: none;
}

.items-table tbody tr:hover td {
  background: rgba(78, 202, 139, 0.04);
}

.row--abnormal td {
  background: rgba(224, 108, 108, 0.06);
}

.td--name {
  color: var(--text-primary);
  font-weight: 500;
}

.td--value {
  font-weight: 600;
  color: var(--text-primary);
  font-family: "DM Mono", monospace;
  font-size: 0.82rem;
  word-break: break-all;
}

.td--unit {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.td--ref {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.status {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
}

.status--normal {
  background: rgba(78, 202, 139, 0.15);
  color: var(--accent);
}

.status--abnormal {
  background: rgba(224, 108, 108, 0.15);
  color: #e06c6c;
}

/* ===== 배지 ===== */
.badge {
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  font-size: 0.72rem;
  color: var(--accent);
  background: var(--accent-dim);
}

.badge--muted {
  color: var(--text-muted);
  background: transparent;
}

/* ===== 공통: 빈 상태 / 로딩 ===== */
.panel-empty,
.panel-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  gap: 0.75rem;
  color: var(--text-muted);
  font-size: 0.875rem;
  text-align: center;
  line-height: 1.7;
}

.panel-empty--sm {
  min-height: 80px;
}

.panel-empty__icon {
  font-size: 2rem;
  opacity: 0.5;
}

/* ===== 스피너 ===== */
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(78, 202, 139, 0.3);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner--lg {
  width: 28px;
  height: 28px;
  border-width: 3px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== 반응형 (태블릿/모바일) ===== */
@media (max-width: 768px) {
  .exam-analysis {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }

  /* 위쪽 패널: 최대 높이 제한 후 내부 스크롤 */
  .records-panel {
    border-right: none;
    border-bottom: 1px solid var(--card-border);
    max-height: 50vh;
    overflow-y: auto;
  }

  /* 기록 목록 높이 제한 */
  .records-list {
    max-height: none;
    overflow-y: visible;
  }

  /* 아래 패널: 자연 높이 */
  .detail-panel {
    overflow: visible;
    padding: 1.25rem;
    min-height: 50vh;
  }

  .record-detail {
    max-width: 100%;
  }

  .record-detail__title {
    font-size: 1rem;
    word-break: break-all;
  }

  /* 원시 텍스트 높이 축소 */
  .raw-text-box__text {
    max-height: 150px;
  }

  /* 항목 테이블 — 가로 스크롤 */
  .items-table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .items-table {
    min-width: 480px;
  }

  /* 삭제 버튼: 모바일에서 항상 표시 */
  .record-item__delete {
    opacity: 1;
  }
}

/* ===== 소형 모바일 (≤480px) ===== */
@media (max-width: 480px) {
  .upload-area__inner {
    padding: 1rem 0.75rem;
  }

  .upload-area__text {
    font-size: 0.78rem;
  }

  .upload-area__sub {
    font-size: 0.68rem;
  }

  .raw-text-box__text {
    font-size: 0.78rem;
    max-height: 120px;
  }

  .record-detail__badges {
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  /* 테이블 → 카드형 레이아웃 전환 */
  .items-table-wrap {
    overflow-x: visible;
  }

  .items-table,
  .items-table thead,
  .items-table tbody,
  .items-table tr,
  .items-table th,
  .items-table td {
    display: block;
  }

  /* 헤더 숨김 */
  .items-table thead {
    display: none;
  }

  /* 각 행을 카드로 */
  .items-table tbody tr {
    background: var(--surface);
    border: 1px solid var(--card-border);
    border-radius: 8px;
    margin-bottom: 0.6rem;
    padding: 0.5rem 0;
    overflow: hidden;
  }

  .items-table tbody tr:last-child {
    margin-bottom: 0;
  }

  .row--abnormal {
    border-color: rgba(224, 108, 108, 0.4) !important;
  }

  /* 각 셀: label — value 형태 */
  .items-table td {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.3rem 0.75rem;
    border-bottom: 1px solid var(--card-border);
    font-size: 0.82rem;
  }

  .items-table td:last-child {
    border-bottom: none;
  }

  /* data-label을 앞에 표시 */
  .items-table td::before {
    content: attr(data-label);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    min-width: 52px;
    flex-shrink: 0;
    padding-top: 0.1rem;
  }
}
</style>
