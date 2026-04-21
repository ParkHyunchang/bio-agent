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

export async function streamChat(formData, { onProgress, onDone, onError }, signal) {
  const baseURL = api.defaults.baseURL || ''
  const response = await fetch(`${baseURL}/api/agent/chat/stream`, {
    method: 'POST',
    body: formData,
    signal,
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleBlock = (block) => {
    const eventMatch = block.match(/event:\s*(\S+)/)
    const dataMatch = block.match(/data:\s*([\s\S]+)/)
    if (!eventMatch || !dataMatch) return
    const evtName = eventMatch[1]
    const evtData = dataMatch[1].trim()

    if (evtName === 'progress') onProgress?.(evtData)
    else if (evtName === 'done') onDone?.(JSON.parse(evtData))
    else if (evtName === 'error') onError?.(evtData)
  }

  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
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
    throw e
  } finally {
    reader.releaseLock()
  }
}
