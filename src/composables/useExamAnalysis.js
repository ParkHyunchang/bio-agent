import { ref, nextTick } from 'vue'
import { uploadFiles as apiUploadFiles, fetchRecords as apiFetchRecords, deleteRecord as apiDeleteRecord } from '@/services/exam.service'
import { formatDateShort } from '@/utils/format'
import { useToast } from '@/composables/useToast'

export function useExamAnalysis(rootEl) {
  const isDragging = ref(false)
  const selectedFiles = ref([])
  const isUploading = ref(false)
  const isMutating = ref(false) // 업로드/삭제 동안 상호 배타적 가드
  const records = ref([])
  const selectedRecord = ref(null)
  const toast = useToast()
  let recordsRequestSeq = 0

  function onFileChange(e) {
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  function onDrop(e) {
    isDragging.value = false
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length === 0) {
      toast.warn('이미지 파일만 업로드할 수 있습니다.')
      return
    }
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
    if (selectedFiles.value.length === 0 || isUploading.value || isMutating.value) return
    isUploading.value = true
    isMutating.value = true
    selectedRecord.value = null
    try {
      const formData = new FormData()
      selectedFiles.value.forEach(f => formData.append('files', f))
      const data = await apiUploadFiles(formData)
      selectedFiles.value = []
      await loadRecords()
      if (Array.isArray(data) && data.length > 0) {
        selectedRecord.value = data[data.length - 1]
        const errors = data.filter(r => r.documentType === '오류' || r.documentType === '거부')
        if (errors.length > 0) {
          toast.warn(`${data.length - errors.length}장 성공, ${errors.length}장 실패`)
        } else {
          toast.success(`${data.length}장 업로드 완료`)
        }
        if (window.innerWidth <= 768) {
          await nextTick()
          rootEl.value?.querySelector('.detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    } catch (e) {
      console.error('업로드 오류', e)
      toast.error('파일 업로드에 실패했습니다.')
    } finally {
      isUploading.value = false
      isMutating.value = false
    }
  }

  async function loadRecords() {
    const reqId = ++recordsRequestSeq
    try {
      const data = await apiFetchRecords()
      if (reqId !== recordsRequestSeq) return // stale
      records.value = data
    } catch (e) {
      if (reqId !== recordsRequestSeq) return
      console.error('기록 로드 오류', e)
      toast.error('기록 목록을 불러오지 못했습니다.')
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
    if (isMutating.value) return
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm('이 기록을 삭제하시겠습니까?')) return
    }
    isMutating.value = true
    try {
      await apiDeleteRecord(id)
      if (selectedRecord.value?.id === id) selectedRecord.value = null
      await loadRecords()
      toast.success('삭제되었습니다.')
    } catch (e) {
      console.error('삭제 오류', e)
      toast.error('삭제에 실패했습니다.')
    } finally {
      isMutating.value = false
    }
  }

  return {
    isDragging, selectedFiles, isUploading, records, selectedRecord,
    onFileChange, onDrop, addFiles, removeFile,
    uploadFiles, loadRecords, selectRecord, deleteRecord,
    formatDate: formatDateShort
  }
}
