import { ref, nextTick } from 'vue'
import { uploadFiles as apiUploadFiles, fetchRecords as apiFetchRecords, deleteRecord as apiDeleteRecord } from '@/services/exam.service'
import { formatDateShort } from '@/utils/format'

export function useExamAnalysis(rootEl) {
  const isDragging = ref(false)
  const selectedFiles = ref([])
  const isUploading = ref(false)
  const records = ref([])
  const selectedRecord = ref(null)

  function onFileChange(e) {
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  function onDrop(e) {
    isDragging.value = false
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    addFiles(files)
  }

  function addFiles(files) {
    const existing = new Set(selectedFiles.value.map(f => f.name))
    files.forEach(f => { if (!existing.has(f.name)) selectedFiles.value.push(f) })
  }

  function removeFile(index) {
    selectedFiles.value.splice(index, 1)
  }

  async function uploadFiles() {
    if (selectedFiles.value.length === 0 || isUploading.value) return
    isUploading.value = true
    selectedRecord.value = null
    try {
      const formData = new FormData()
      selectedFiles.value.forEach(f => formData.append('files', f))
      const data = await apiUploadFiles(formData)
      selectedFiles.value = []
      await loadRecords()
      if (data.length > 0) {
        selectedRecord.value = data[data.length - 1]
        if (window.innerWidth <= 768) {
          await nextTick()
          rootEl.value?.querySelector('.detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    } catch (e) {
      console.error('업로드 오류', e)
    } finally {
      isUploading.value = false
    }
  }

  async function loadRecords() {
    try {
      records.value = await apiFetchRecords()
    } catch (e) {
      console.error('기록 로드 오류', e)
    }
  }

  async function selectRecord(record) {
    selectedRecord.value = record
    if (window.innerWidth <= 768) {
      await nextTick()
      rootEl.value?.querySelector('.detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  async function deleteRecord(id) {
    try {
      await apiDeleteRecord(id)
      if (selectedRecord.value?.id === id) selectedRecord.value = null
      await loadRecords()
    } catch (e) {
      console.error('삭제 오류', e)
    }
  }

  return {
    isDragging, selectedFiles, isUploading, records, selectedRecord,
    onFileChange, onDrop, addFiles, removeFile,
    uploadFiles, loadRecords, selectRecord, deleteRecord,
    formatDate: formatDateShort
  }
}
