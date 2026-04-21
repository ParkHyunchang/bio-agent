import { ref, computed } from 'vue'
import {
  fetchRecords, deleteRecord as apiDeleteRecord,
  extractGel, uploadGel, autoExtractCt as apiAutoExtractCt,
  trainModel as apiTrainModel, resetModel as apiResetModel
} from '@/services/gel.service'

export function useGelTraining(emit) {
  const records = ref([])
  const isLoadingRecords = ref(false)
  const selectedIds = ref([])
  const isDeleting = ref(false)

  const isTraining = ref(false)
  const trainResult = ref(null)

  const multiLaneFile = ref(null)
  const multiLaneFileInput = ref(null)
  const multiLaneExtracted = ref([])
  const laneCtInputs = ref({})
  const isExtractingLanes = ref(false)
  const isExtractingCt = ref(false)
  const isUploadingMultiLane = ref(false)
  const isDraggingMulti = ref(false)

  const allSelected = computed(() =>
    records.value.length > 0 && selectedIds.value.length === records.value.length
  )
  const someSelected = computed(() =>
    selectedIds.value.length > 0 && selectedIds.value.length < records.value.length
  )

  async function loadRecords() {
    isLoadingRecords.value = true
    try {
      records.value = await fetchRecords()
    } catch (e) {
      console.error('목록 로드 실패', e)
    } finally {
      isLoadingRecords.value = false
    }
  }

  async function deleteRecord(id) {
    if (!confirm('이 학습 데이터를 삭제하시겠습니까?')) return
    try {
      await apiDeleteRecord(id)
      records.value = records.value.filter(r => r.id !== id)
      selectedIds.value = selectedIds.value.filter(sid => sid !== id)
      if (records.value.length === 0) {
        await apiResetModel()
      }
      emit('model-updated')
    } catch (e) {
      alert('삭제 실패: ' + (e.response?.data || e.message))
    }
  }

  async function deleteSelected() {
    if (!confirm(`선택한 ${selectedIds.value.length}개의 학습 데이터를 삭제하시겠습니까?`)) return
    isDeleting.value = true
    try {
      await Promise.all(selectedIds.value.map(id => apiDeleteRecord(id)))
      const deletedSet = new Set(selectedIds.value)
      records.value = records.value.filter(r => !deletedSet.has(r.id))
      selectedIds.value = []
      if (records.value.length === 0) await apiResetModel()
      emit('model-updated')
    } catch (e) {
      alert('일부 삭제 실패: ' + (e.response?.data || e.message))
      await loadRecords()
      selectedIds.value = []
    } finally {
      isDeleting.value = false
    }
  }

  function toggleSelectAll() {
    if (allSelected.value) {
      selectedIds.value = []
    } else {
      selectedIds.value = records.value.map(r => r.id)
    }
  }

  function toggleSelect(id) {
    const idx = selectedIds.value.indexOf(id)
    if (idx === -1) selectedIds.value.push(id)
    else selectedIds.value.splice(idx, 1)
  }

  async function trainModel() {
    isTraining.value = true
    trainResult.value = null
    try {
      trainResult.value = await apiTrainModel()
      emit('model-updated')
    } catch (e) {
      alert('학습 실패: ' + (e.response?.data?.error || e.message))
    } finally {
      isTraining.value = false
    }
  }

  function onMultiLaneFileChange(e) {
    multiLaneFile.value = e.target.files[0] || null
    multiLaneExtracted.value = []
    laneCtInputs.value = {}
  }

  function onMultiLaneDrop(e) {
    isDraggingMulti.value = false
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      multiLaneFile.value = file
      multiLaneExtracted.value = []
      laneCtInputs.value = {}
    }
  }

  async function autoExtractCt() {
    if (!multiLaneFile.value) return
    isExtractingCt.value = true
    try {
      const form = new FormData()
      form.append('file', multiLaneFile.value)
      const data = await apiAutoExtractCt(form)
      const count = Object.keys(data).length
      if (count === 0) {
        alert('이미지에서 Ct값을 찾지 못했습니다.\n이미지에 "Ct = 숫자" 형태의 텍스트가 있는지 확인하세요.')
      } else {
        Object.assign(laneCtInputs.value, data)
        alert(`${count}개 레인의 Ct값이 자동으로 입력되었습니다.`)
      }
    } catch (e) {
      alert('Ct값 자동 추출 실패: ' + (e.response?.data?.error || e.message))
    } finally {
      isExtractingCt.value = false
    }
  }

  async function extractLanesForTraining() {
    if (!multiLaneFile.value) return
    isExtractingLanes.value = true
    multiLaneExtracted.value = []
    laneCtInputs.value = {}
    try {
      const form = new FormData()
      form.append('file', multiLaneFile.value)
      const data = await extractGel(form)
      multiLaneExtracted.value = Array.isArray(data) ? data : []
    } catch (e) {
      alert('레인 분석 실패: ' + (e.response?.data?.error || e.message))
    } finally {
      isExtractingLanes.value = false
    }
  }

  async function uploadMultiLaneGel() {
    if (Object.keys(laneCtInputs.value).length === 0) return
    isUploadingMultiLane.value = true
    try {
      const form = new FormData()
      form.append('file', multiLaneFile.value)
      form.append('ctValues', JSON.stringify(laneCtInputs.value))
      const data = await uploadGel(form)
      if (data.duplicate) {
        alert('이미 등록된 데이터입니다.')
      } else {
        const count = Array.isArray(data) ? data.length : 0
        alert(`${count}개 레인이 저장되었습니다.`)
        multiLaneFile.value = null
        multiLaneExtracted.value = []
        laneCtInputs.value = {}
        if (multiLaneFileInput.value) multiLaneFileInput.value.value = ''
        await loadRecords()
      }
    } catch (e) {
      if (e.response?.status === 409) {
        alert('이미 등록된 데이터입니다.')
      } else {
        alert('업로드 실패: ' + (e.response?.data?.error || e.message))
      }
    } finally {
      isUploadingMultiLane.value = false
    }
  }

  return {
    records, isLoadingRecords, selectedIds, isDeleting,
    isTraining, trainResult,
    multiLaneFile, multiLaneFileInput, multiLaneExtracted, laneCtInputs,
    isExtractingLanes, isExtractingCt, isUploadingMultiLane, isDraggingMulti,
    allSelected, someSelected,
    loadRecords, deleteRecord, deleteSelected, toggleSelectAll, toggleSelect,
    trainModel, onMultiLaneFileChange, onMultiLaneDrop,
    autoExtractCt, extractLanesForTraining, uploadMultiLaneGel
  }
}
