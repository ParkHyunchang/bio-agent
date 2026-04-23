import { ref, computed } from 'vue'
import {
  fetchRecords, deleteRecord as apiDeleteRecord,
  extractGel, uploadGel, autoExtractCt as apiAutoExtractCt,
  trainModel as apiTrainModel, resetModel as apiResetModel
} from '@/services/gel.service'
import { useToast } from './useToast'
import { useConfirm } from './useConfirm'

const TRAIN_RESULT_KEY = 'gel_train_result'
const TRAINED_IDS_KEY = 'gel_trained_record_ids'

export function useGelTraining(emit) {
  const { success, error, info, warn } = useToast()
  const { confirm } = useConfirm()

  const records = ref([])
  const isLoadingRecords = ref(false)
  const selectedIds = ref([])
  const isDeleting = ref(false)

  const isTraining = ref(false)

  const stored = localStorage.getItem(TRAIN_RESULT_KEY)
  const trainResult = ref(stored ? JSON.parse(stored) : null)

  const storedTrainedIds = localStorage.getItem(TRAINED_IDS_KEY)
  const trainedIds = ref(storedTrainedIds ? JSON.parse(storedTrainedIds) : null)

  const needsRetraining = computed(() => {
    if (!trainResult.value) return false
    if (!trainedIds.value) return true
    const current = new Set(records.value.map(r => r.id))
    const trained = new Set(trainedIds.value)
    if (current.size !== trained.size) return true
    for (const id of current) {
      if (!trained.has(id)) return true
    }
    return false
  })

  const retrainingDiff = computed(() => {
    if (!trainResult.value || !trainedIds.value) return null
    const currentSet = new Set(records.value.map(r => r.id))
    const trainedSet = new Set(trainedIds.value)
    const added = [...currentSet].filter(id => !trainedSet.has(id)).length
    const removed = [...trainedSet].filter(id => !currentSet.has(id)).length
    return { added, removed }
  })

  const multiLaneFile = ref(null)
  const multiLaneFileInput = ref(null)
  const multiLaneExtracted = ref([])
  const laneCtInputs = ref({})
  const isExtractingLanes = ref(false)
  const isExtractingCt = ref(false)
  const isUploadingMultiLane = ref(false)
  const isDraggingMulti = ref(false)
  const isDuplicate = ref(false)

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
      error('목록 로드 실패: ' + (e.response?.data || e.message))
    } finally {
      isLoadingRecords.value = false
    }
  }

  async function deleteRecord(id) {
    const ok = await confirm('이 학습 데이터를 삭제하시겠습니까?')
    if (!ok) return
    try {
      await apiDeleteRecord(id)
      records.value = records.value.filter(r => r.id !== id)
      selectedIds.value = selectedIds.value.filter(sid => sid !== id)
      if (records.value.length === 0) await apiResetModel()
      emit('model-updated')
      success('삭제되었습니다.')
    } catch (e) {
      error('삭제 실패: ' + (e.response?.data || e.message))
    }
  }

  async function deleteSelected() {
    const ok = await confirm(`선택한 ${selectedIds.value.length}개의 학습 데이터를 삭제하시겠습니까?`)
    if (!ok) return
    isDeleting.value = true
    try {
      await Promise.all(selectedIds.value.map(id => apiDeleteRecord(id)))
      const deletedSet = new Set(selectedIds.value)
      records.value = records.value.filter(r => !deletedSet.has(r.id))
      selectedIds.value = []
      if (records.value.length === 0) await apiResetModel()
      emit('model-updated')
      success(`${deletedSet.size}개 삭제되었습니다.`)
    } catch (e) {
      error('일부 삭제 실패: ' + (e.response?.data || e.message))
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
      localStorage.setItem(TRAIN_RESULT_KEY, JSON.stringify(trainResult.value))
      trainedIds.value = records.value.map(r => r.id)
      localStorage.setItem(TRAINED_IDS_KEY, JSON.stringify(trainedIds.value))
      emit('model-updated')
      success('모델 학습이 완료되었습니다.')
    } catch (e) {
      error('학습 실패: ' + (e.response?.data?.error || e.message))
    } finally {
      isTraining.value = false
    }
  }

  function onMultiLaneFileChange(e) {
    multiLaneFile.value = e.target.files[0] || null
    multiLaneExtracted.value = []
    laneCtInputs.value = {}
    isDuplicate.value = false
  }

  function onMultiLaneDrop(e) {
    isDraggingMulti.value = false
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      multiLaneFile.value = file
      multiLaneExtracted.value = []
      laneCtInputs.value = {}
      isDuplicate.value = false
    }
  }

  async function overwriteDuplicate() {
    const fileName = multiLaneFile.value?.name
    const matching = records.value.filter(r => r.fileName === fileName)

    if (matching.length > 0) {
      isDeleting.value = true
      try {
        await Promise.all(matching.map(r => apiDeleteRecord(r.id)))
        const deletedIds = new Set(matching.map(r => r.id))
        records.value = records.value.filter(r => !deletedIds.has(r.id))
        selectedIds.value = selectedIds.value.filter(id => !deletedIds.has(id))
        if (records.value.length === 0) await apiResetModel()
        emit('model-updated')
      } catch (e) {
        error('기존 데이터 삭제 실패: ' + (e.response?.data || e.message))
        return
      } finally {
        isDeleting.value = false
      }
    }

    isDuplicate.value = false
    await uploadMultiLaneGel()
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
        warn('이미지에서 Ct값을 찾지 못했습니다. "Ct = 숫자" 형태의 텍스트가 있는지 확인하세요.')
      } else {
        Object.assign(laneCtInputs.value, data)
        success(`${count}개 레인의 Ct값이 자동으로 입력되었습니다.`)
      }
    } catch (e) {
      error('Ct값 자동 추출 실패: ' + (e.response?.data?.error || e.message))
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
      if (multiLaneExtracted.value.length === 0) {
        warn('레인을 감지하지 못했습니다. 이미지를 확인해주세요.')
      } else {
        info(`${multiLaneExtracted.value.length}개 레인이 감지되었습니다.`)
      }
    } catch (e) {
      error('레인 분석 실패: ' + (e.response?.data?.error || e.message))
    } finally {
      isExtractingLanes.value = false
    }
  }

  function resetUploadForm() {
    multiLaneFile.value = null
    multiLaneExtracted.value = []
    laneCtInputs.value = {}
    isDuplicate.value = false
    if (multiLaneFileInput.value) multiLaneFileInput.value.value = ''
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
        isDuplicate.value = true
        warn('이미 등록된 파일입니다.')
      } else {
        const count = Array.isArray(data) ? data.length : 0
        success(`${count}개 레인이 저장되었습니다.`)
        resetUploadForm()
        await loadRecords()
      }
    } catch (e) {
      if (e.response?.status === 409) {
        isDuplicate.value = true
        warn('이미 등록된 파일입니다.')
      } else {
        error('업로드 실패: ' + (e.response?.data?.error || e.message))
      }
    } finally {
      isUploadingMultiLane.value = false
    }
  }

  return {
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
  }
}
