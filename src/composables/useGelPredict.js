import { ref, computed } from 'vue'
import { predictGel, uploadGel } from '@/services/gel.service'
import { fmt } from '@/utils/format'

export function useGelPredict(emit) {
  const gelPredictItems = ref([])
  const isGelPredictDragging = ref(false)
  const gelPredictFileInput = ref(null)

  const hasPendingGelItems = computed(() =>
    gelPredictItems.value.some(i => i.status === 'pending')
  )
  const isAnyGelPredicting = computed(() =>
    gelPredictItems.value.some(i => i.status === 'predicting')
  )

  function onGelPredictFilesChange(e) {
    addGelPredictFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  function onGelPredictDrop(e) {
    isGelPredictDragging.value = false
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    addGelPredictFiles(files)
  }

  function addGelPredictFiles(files) {
    for (const file of files) {
      gelPredictItems.value.push({
        file,
        imageUrl: URL.createObjectURL(file),
        status: 'pending',
        laneResults: [],
        errorMsg: '',
        actualCtInputs: {},
        isRegistering: false,
        registerMsg: null
      })
    }
  }

  function removeGelPredictItem(idx) {
    URL.revokeObjectURL(gelPredictItems.value[idx].imageUrl)
    gelPredictItems.value.splice(idx, 1)
  }

  function clearGelPredict() {
    for (const item of gelPredictItems.value) URL.revokeObjectURL(item.imageUrl)
    gelPredictItems.value = []
    if (gelPredictFileInput.value) gelPredictFileInput.value.value = ''
  }

  async function predictSingleGelItem(item) {
    item.status = 'predicting'
    item.laneResults = []
    try {
      const form = new FormData()
      form.append('file', item.file)
      const data = await predictGel(form)
      item.laneResults = Array.isArray(data) ? data : []
      item.status = 'done'
    } catch (e) {
      item.status = 'error'
      item.errorMsg = e.response?.data?.error || e.message
    }
  }

  async function predictAllGelLanes() {
    const pending = gelPredictItems.value.filter(i => i.status === 'pending')
    for (const item of pending) {
      await predictSingleGelItem(item)
    }
  }

  function itemLod(item) {
    const detected = item.laneResults.filter(l =>
      l.concentrationLabel !== 'M' && l.concentrationLabel !== 'NTC' && !l.isNegative
    )
    if (detected.length === 0) return null
    return detected.reduce((min, l) => {
      const v = parseFloat(l.concentrationLabel?.replace('10^', '') ?? '999')
      const mv = parseFloat(min.concentrationLabel?.replace('10^', '') ?? '999')
      return v < mv ? l : min
    }).concentrationLabel
  }

  function laneRowClass(lane) {
    const low = ['10^1', '10^2', '10^3']
    if (lane.concentrationLabel === 'M' || lane.concentrationLabel === 'NTC') return 'row--muted'
    if (low.includes(lane.concentrationLabel)) return lane.isNegative ? 'row--low-conc-neg' : 'row--low-conc'
    return ''
  }

  function hasActualCt(item) {
    return Object.values(item.actualCtInputs).some(v => v !== null && v !== '' && !isNaN(Number(v)))
  }

  function countActualCt(item) {
    return Object.values(item.actualCtInputs).filter(v => v !== null && v !== '' && !isNaN(Number(v))).length
  }

  async function uploadPredictAsTraining(item) {
    item.isRegistering = true
    item.registerMsg = null
    try {
      const ctMap = Object.fromEntries(
        Object.entries(item.actualCtInputs)
          .filter(([, v]) => v !== null && v !== '' && !isNaN(Number(v)))
          .map(([k, v]) => [k, Number(v)])
      )
      const form = new FormData()
      form.append('file', item.file)
      form.append('ctValues', JSON.stringify(ctMap))
      const data = await uploadGel(form)
      if (data.duplicate) {
        item.registerMsg = { type: 'duplicate', text: '이미 등록된 데이터입니다.' }
      } else {
        const count = Array.isArray(data) ? data.length : 0
        item.registerMsg = { type: 'ok', text: `${count}개 레인이 학습 데이터로 등록되었습니다.` }
        emit('records-changed')
      }
    } catch (e) {
      if (e.response?.status === 409) {
        item.registerMsg = { type: 'duplicate', text: '이미 등록된 데이터입니다.' }
      } else {
        item.registerMsg = { type: 'error', text: '등록 실패: ' + (e.response?.data?.error || e.message) }
      }
    } finally {
      item.isRegistering = false
    }
  }

  function itemLowConcLanes(item) {
    const labels = ['10^1', '10^2', '10^3']
    return labels.map(label => {
      const lane = item.laneResults.find(l => l.concentrationLabel === label)
      return { label, lane, detected: lane && !lane.isNegative }
    })
  }

  return {
    gelPredictItems, isGelPredictDragging, gelPredictFileInput,
    hasPendingGelItems, isAnyGelPredicting,
    onGelPredictFilesChange, onGelPredictDrop, addGelPredictFiles,
    removeGelPredictItem, clearGelPredict,
    predictSingleGelItem, predictAllGelLanes,
    itemLod, laneRowClass, hasActualCt, countActualCt,
    uploadPredictAsTraining, itemLowConcLanes,
    fmt
  }
}
