<template>
  <div class="exam-analysis" ref="rootEl">

    <aside class="records-panel">
      <div class="upload-area"
           :class="{ 'upload-area--drag': isDragging }"
           @dragover.prevent="isDragging = true"
           @dragleave.prevent="isDragging = false"
           @drop.prevent="onDrop">
        <input ref="fileInput" type="file" multiple accept="image/*" class="upload-area__input" @change="onFileChange" />
        <div class="upload-area__inner" @click="fileInput.click()">
          <div class="upload-area__icon">📎</div>
          <p class="upload-area__text">이미지를 끌어다 놓거나 클릭하여 선택</p>
          <p class="upload-area__sub">JPG, PNG, WEBP · 파일당 최대 20MB</p>
        </div>
      </div>

      <div v-if="selectedFiles.length > 0" class="file-preview">
        <div v-for="(f, i) in selectedFiles" :key="i" class="file-chip">
          <span class="file-chip__name">{{ f.name }}</span>
          <button class="file-chip__remove" @click="removeFile(i)">×</button>
        </div>
      </div>

      <button class="btn-primary" :disabled="selectedFiles.length === 0 || isUploading" @click="uploadFiles">
        <span v-if="isUploading" class="spinner"></span>
        <span v-else>OCR 추출</span>
      </button>

      <div class="records-list">
        <div class="records-list__header">저장된 기록</div>
        <div v-if="records.length === 0" class="list-empty"><p>아직 저장된 기록이 없습니다</p></div>
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

    <main class="detail-panel">
      <div v-if="!selectedRecord && !isUploading" class="panel-empty">
        <div class="panel-empty__icon">🔬</div>
        <p>이미지를 업로드하거나<br>기록을 선택하세요</p>
      </div>

      <div v-else-if="isUploading" class="panel-loading">
        <div class="spinner spinner--lg"></div>
        <p>Claude Vision으로 이미지를 분석하고 있습니다...</p>
      </div>

      <div v-else-if="selectedRecord" class="record-detail">
        <div class="record-detail__header">
          <h2 class="record-detail__title">{{ selectedRecord.fileName }}</h2>
          <div class="record-detail__badges">
            <span class="badge">{{ selectedRecord.documentType }}</span>
            <span class="badge badge--muted">{{ formatDate(selectedRecord.createdAt) }}</span>
          </div>
        </div>

        <div class="raw-text-box">
          <div class="box-label">인식된 텍스트</div>
          <pre class="raw-text-box__text">{{ selectedRecord.rawText || '텍스트 없음' }}</pre>
        </div>

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
                  <td data-label="항목명" class="td--name"><span>{{ item.itemName }}</span></td>
                  <td data-label="수치" class="td--value"><span>{{ item.value || '—' }}</span></td>
                  <td data-label="단위" class="td--unit"><span>{{ item.unit || '—' }}</span></td>
                  <td data-label="참고범위" class="td--ref"><span>{{ item.referenceRange || '—' }}</span></td>
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

<script setup>
import { ref, onMounted } from 'vue'
import { useExamAnalysis } from '@/composables/useExamAnalysis'

const rootEl = ref(null)
const fileInput = ref(null)

const {
  isDragging, selectedFiles, isUploading, records, selectedRecord,
  onFileChange, onDrop, removeFile,
  uploadFiles, loadRecords, selectRecord, deleteRecord,
  formatDate
} = useExamAnalysis(rootEl)

onMounted(loadRecords)
</script>

<style scoped>
@import '@/assets/css/views/exam-analysis.css';
</style>
