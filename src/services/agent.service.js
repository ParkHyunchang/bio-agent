import api from '@/axios'

export async function fetchSessions() {
  const { data } = await api.get('/api/agent/sessions')
  return data
}

export async function fetchHistory(sessionId) {
  const { data } = await api.get(`/api/agent/session/${sessionId}/history`)
  return data
}

export async function deleteSession(sessionId) {
  await api.delete(`/api/agent/session/${sessionId}`)
}

const STREAM_IDLE_TIMEOUT_MS = 60_000

function collectAxiosHeaders() {
  const headers = {}
  const sources = [
    api.defaults.headers?.common,
    api.defaults.headers?.post,
  ]
  for (const src of sources) {
    if (!src) continue
    for (const [k, v] of Object.entries(src)) {
      if (v == null) continue
      if (k.toLowerCase() === 'content-type') continue
      headers[k] = String(v)
    }
  }
  return headers
}

export async function streamChat(formData, { onProgress, onDone, onError }, signal) {
  const baseURL = api.defaults.baseURL || ''

  let response
  try {
    response = await fetch(`${baseURL}/api/agent/chat/stream`, {
      method: 'POST',
      body: formData,
      signal,
      credentials: api.defaults.withCredentials ? 'include' : 'same-origin',
      headers: collectAxiosHeaders(),
    })
  } catch (e) {
    if (e.name === 'AbortError') return
    throw new Error(`네트워크 오류: ${e.message}`)
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const text = await response.text()
      if (text) detail += ` - ${text.slice(0, 200)}`
    } catch { /* ignore */ }
    throw new Error(detail)
  }
  if (!response.body) {
    throw new Error('스트리밍 응답이 비어있습니다.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let idleTimer = null

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      try { reader.cancel(new Error('idle-timeout')) } catch { /* ignore */ }
    }, STREAM_IDLE_TIMEOUT_MS)
  }

  const handleBlock = (block) => {
    const eventMatch = block.match(/event:\s*(\S+)/)
    const dataMatch = block.match(/data:\s*([\s\S]+)/)
    if (!eventMatch || !dataMatch) return
    const evtName = eventMatch[1]
    const evtData = dataMatch[1].trim()

    if (evtName === 'progress') {
      onProgress?.(evtData)
    } else if (evtName === 'done') {
      try { onDone?.(JSON.parse(evtData)) } catch (e) {
        onError?.(`응답 파싱 실패: ${e.message}`)
      }
    } else if (evtName === 'error') {
      onError?.(evtData)
    }
  }

  resetIdleTimer()
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      resetIdleTimer()
      buffer += decoder.decode(chunk.value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop()
      for (const block of parts) {
        if (block.trim()) handleBlock(block)
      }
    }
    if (buffer.trim()) handleBlock(buffer)
  } catch (e) {
    if (e.name === 'AbortError') return
    if (e.message === 'idle-timeout') {
      throw new Error(`${STREAM_IDLE_TIMEOUT_MS / 1000}초 동안 응답이 없어 중단되었습니다.`)
    }
    throw e
  } finally {
    if (idleTimer) clearTimeout(idleTimer)
    try { reader.releaseLock() } catch { /* ignore */ }
  }
}
