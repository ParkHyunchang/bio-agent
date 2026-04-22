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

export async function generateReview(paper, queryText) {
  const { data } = await api.post('/api/papers/review', {
    pmid: paper.pmid,
    queryText,
    paperTitle: paper.title,
    abstractText: paper.abstractText,
    authors: paper.authors,
    journal: paper.journal,
    pubDate: paper.pubDate
  })
  return data
}

export async function fetchReviewHistory() {
  const { data } = await api.get('/api/papers/history')
  return data
}

export async function deleteReviewHistory(id) {
  await api.delete(`/api/papers/history/${id}`)
}
