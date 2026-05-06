import api from '@/axios'

export async function searchPapers(query, page, size, filters = {}) {
  const { sort, pubType, onlyPmc, yearFrom, yearTo } = filters
  const params = { query, page, size }
  if (sort && sort !== 'relevance') params.sort = sort
  if (pubType) params.pubType = pubType
  if (onlyPmc) params.onlyPmc = true
  if (yearFrom) params.yearFrom = yearFrom
  if (yearTo) params.yearTo = yearTo
  const { data } = await api.get('/api/papers/search', { params })
  return data
}

export async function fetchPaper(pmid) {
  const { data } = await api.get(`/api/papers/${pmid}`)
  return data
}

export async function generateReview(paper, queryText, options = {}) {
  const { length, perspective } = options
  const { data } = await api.post('/api/papers/review', {
    pmid: paper.pmid,
    pmcid: paper.pmcid,
    queryText,
    paperTitle: paper.title,
    abstractText: paper.abstractText,
    authors: paper.authors,
    journal: paper.journal,
    pubDate: paper.pubDate,
    length,
    perspective
  }, { timeout: 180_000 })
  return data
}

/**
 * SSE 스트리밍 리뷰. onChunk(text)로 점진 출력, onMeta({fullTextTruncated})로 메타 1회.
 * 반환되는 controller로 abort 가능. 종료 시 onDone(fullText) 호출.
 */
export function streamReview(paper, queryText, options = {}, handlers = {}) {
  const { onChunk, onMeta, onDone, onError } = handlers
  const { length, perspective } = options
  const controller = new AbortController()
  const baseURL = api.defaults.baseURL || ''

  const body = {
    pmid: paper.pmid,
    pmcid: paper.pmcid,
    queryText,
    paperTitle: paper.title,
    abstractText: paper.abstractText,
    authors: paper.authors,
    journal: paper.journal,
    pubDate: paper.pubDate,
    length,
    perspective
  }

  let accumulated = ''

  ;(async () => {
    try {
      const res = await fetch(`${baseURL}/api/papers/review/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      if (!res.ok) throw new Error(await normalizeErrorMessage(res))
      if (!res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let streamDone = false

      while (!streamDone) {
        const { done, value } = await reader.read()
        if (done) {
          streamDone = true
          break
        }
        buffer += decoder.decode(value, { stream: true })

        let idx
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          handleEvent(raw)
        }
      }
      onDone?.(accumulated)
    } catch (e) {
      if (e.name === 'AbortError') return
      onError?.(e)
    }
  })()

  function handleEvent(raw) {
    let event = 'message'
    const dataLines = []
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
    }
    const data = dataLines.join('\n')
    if (event === 'chunk') {
      accumulated += data
      onChunk?.(data, accumulated)
    } else if (event === 'meta') {
      try { onMeta?.(JSON.parse(data)) } catch { /* ignore */ }
    } else if (event === 'error') {
      let payload = { type: 'unknown', message: data }
      try { payload = JSON.parse(data) } catch { /* ignore */ }
      const err = new Error(payload.message || '리뷰 생성 중 오류')
      err.type = payload.type
      onError?.(err)
    } else if (event === 'done') {
      // onDone은 reader 종료 후 호출 (위)
    }
  }

  return { abort: () => controller.abort() }
}

/**
 * fetch 응답을 axios 인터셉터(axios.js)와 동일한 정책으로 정규화.
 * 429는 서버 응답의 error 필드가 있으면 그것을, 없으면 한국어 기본 메시지를 사용.
 */
async function normalizeErrorMessage(res) {
  if (res.status === 429) {
    try {
      const body = await res.json()
      if (body?.error) return body.error
    } catch { /* JSON 아닌 응답은 무시 */ }
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
  }
  return `HTTP ${res.status}`
}

export async function fetchReviewedPmids() {
  const { data } = await api.get('/api/papers/reviewed-pmids')
  return new Set(data)
}

export async function fetchReviewHistory(page = 0, size = 100) {
  const { data } = await api.get('/api/papers/history', { params: { page, size } })
  return data
}

export async function deleteReviewHistory(id) {
  await api.delete(`/api/papers/history/${id}`)
}
