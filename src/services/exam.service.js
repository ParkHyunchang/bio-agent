import api from '@/axios'

export async function uploadFiles(formData) {
  const { data } = await api.post('/api/exam/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data
}

export async function fetchRecords() {
  const { data } = await api.get('/api/exam/records')
  return data
}

export async function deleteRecord(id) {
  await api.delete(`/api/exam/records/${id}`)
}
