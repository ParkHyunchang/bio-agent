import api from '@/axios'

export async function fetchRecords() {
  const { data } = await api.get('/api/gel/records')
  return data
}

export async function deleteRecord(id) {
  await api.delete(`/api/gel/records/${id}`)
}

export async function extractGel(formData) {
  const { data } = await api.post('/api/gel/extract-gel', formData)
  return data
}

export async function uploadGel(formData) {
  const { data } = await api.post('/api/gel/upload-gel', formData)
  return data
}

export async function autoExtractCt(formData) {
  const { data } = await api.post('/api/gel/auto-ct', formData)
  return data
}

export async function trainModel() {
  const { data } = await api.post('/api/gel/train')
  return data
}

export async function fetchModelStatus() {
  const { data } = await api.get('/api/gel/model/status')
  return data
}

export async function resetModel() {
  await api.delete('/api/gel/model')
}

export async function predictGel(formData) {
  const { data } = await api.post('/api/gel/predict-gel', formData)
  return data
}

export function getBaseURL() {
  return api.defaults.baseURL || ''
}
