import api from '@/axios'

export async function searchPapers(query, page, size) {
  const { data } = await api.get('/api/papers/search', {
    params: { query, page, size }
  })
  return data
}

export async function fetchPaper(pmid) {
  const { data } = await api.get(`/api/papers/${pmid}`)
  return data
}

export async function generateReview(pmid) {
  const { data } = await api.post('/api/papers/review', { pmid })
  return data
}
