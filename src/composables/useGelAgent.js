import { ref, computed, nextTick } from 'vue'
import { fetchSessions, fetchHistory, deleteSession as apiDeleteSession, streamChat } from '@/services/agent.service'
import { renderMarkdown } from '@/utils/markdown'
import { formatRelativeTime } from '@/utils/format'

export function useGelAgent() {
  const agentMessages = ref([])
  const agentInput = ref('')
  const agentFile = ref(null)
  const agentFileInput = ref(null)
  const isAgentLoading = ref(false)
  const agentSessionId = ref(null)
  const isDragOverChat = ref(false)
  const sessionList = ref([])
  const isSidebarOpen = ref(false)
  const loadingElapsed = ref(0)
  const loadingStatusText = ref('요청 전송 중...')
  const loadingTimer = ref(null)
  const chatHistory = ref(null)
  const abortController = ref(null)

  const groupedSessions = computed(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfYesterday = new Date(startOfToday - 86400000)
    const startOf7Days = new Date(startOfToday - 6 * 86400000)
    const startOf30Days = new Date(startOfToday - 29 * 86400000)

    const groups = [
      { label: '오늘', items: [] },
      { label: '어제', items: [] },
      { label: '이전 7일', items: [] },
      { label: '이전 30일', items: [] },
      { label: '더 오래된 대화', items: [] },
    ]
    for (const s of sessionList.value) {
      const d = new Date(s.updatedAt)
      if (d >= startOfToday)         groups[0].items.push(s)
      else if (d >= startOfYesterday) groups[1].items.push(s)
      else if (d >= startOf7Days)     groups[2].items.push(s)
      else if (d >= startOf30Days)    groups[3].items.push(s)
      else                            groups[4].items.push(s)
    }
    return groups.filter(g => g.items.length > 0)
  })

  async function loadSessionList() {
    try {
      sessionList.value = await fetchSessions()
    } catch { /* 무시 */ }
  }

  async function selectSession(sessionId) {
    if (sessionId === agentSessionId.value) return
    agentSessionId.value = sessionId
    localStorage.setItem('agentSessionId', sessionId)
    agentMessages.value = []
    try {
      const data = await fetchHistory(sessionId)
      if (Array.isArray(data)) {
        agentMessages.value = data.map(m => ({
          role: m.role, text: m.text, hadImage: !!m.hadImage, imageUrl: m.imageUrl || null
        }))
      }
    } catch { /* 무시 */ }
    await nextTick()
    scrollChat()
  }

  async function loadAgentHistory() {
    try {
      const sid = localStorage.getItem('agentSessionId')
      if (!sid) return
      agentSessionId.value = sid
      const data = await fetchHistory(sid)
      if (Array.isArray(data) && data.length) {
        agentMessages.value = data.map(m => ({
          role: m.role, text: m.text, hadImage: !!m.hadImage, imageUrl: m.imageUrl || null
        }))
        await nextTick()
        scrollChat()
      }
    } catch { /* 무시 */ }
  }

  function onChatDrop(e) {
    isDragOverChat.value = false
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      agentFile.value = file
    }
  }

  function onAgentFileChange(e) {
    agentFile.value = e.target.files[0] || null
    if (agentFileInput.value) agentFileInput.value.value = ''
  }

  async function sendToAgent() {
    const text = agentInput.value.trim()
    if (!text && !agentFile.value) return
    if (isAgentLoading.value) return

    const file = agentFile.value
    const imageUrl = file ? URL.createObjectURL(file) : null

    agentMessages.value.push({ role: 'user', text: text || '(이미지 분석 요청)', imageUrl })
    agentInput.value = ''
    agentFile.value = null
    isAgentLoading.value = true
    loadingElapsed.value = 0
    loadingStatusText.value = '요청 전송 중...'
    loadingTimer.value = setInterval(() => { loadingElapsed.value++ }, 1000)
    await nextTick()
    scrollChat()

    const form = new FormData()
    form.append('message', text || '이 이미지를 분석해주세요.')
    if (file) form.append('file', file)
    if (agentSessionId.value) form.append('sessionId', agentSessionId.value)

    const controller = new AbortController()
    abortController.value = controller

    try {
      await streamChat(form, {
        onProgress: async (msg) => {
          loadingStatusText.value = msg
          await nextTick()
          scrollChat()
        },
        onDone: (parsed) => {
          agentSessionId.value = parsed.sessionId
          agentMessages.value.push({ role: 'agent', text: parsed.message })
        },
        onError: (msg) => {
          agentMessages.value.push({ role: 'agent', text: '오류가 발생했습니다: ' + msg })
        }
      }, controller.signal)
    } catch (e) {
      if (e.name !== 'AbortError') {
        agentMessages.value.push({ role: 'agent', text: '오류가 발생했습니다: ' + e.message })
      }
    } finally {
      abortController.value = null
      isAgentLoading.value = false
      clearInterval(loadingTimer.value)
      loadingTimer.value = null
      if (agentSessionId.value) localStorage.setItem('agentSessionId', agentSessionId.value)
      await nextTick()
      scrollChat()
      loadSessionList()
    }
  }

  function stopAgent() {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
  }

  function newChat() {
    agentSessionId.value = null
    agentMessages.value = []
    agentInput.value = ''
    agentFile.value = null
    localStorage.removeItem('agentSessionId')
  }

  async function deleteSession(sessionId) {
    await apiDeleteSession(sessionId).catch(() => {})
    if (agentSessionId.value === sessionId) {
      agentSessionId.value = null
      agentMessages.value = []
      localStorage.removeItem('agentSessionId')
    }
    loadSessionList()
  }

  function scrollChat() {
    if (chatHistory.value) chatHistory.value.scrollTop = chatHistory.value.scrollHeight
  }

  function autoResize(e) {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return {
    agentMessages, agentInput, agentFile, agentFileInput,
    isAgentLoading, agentSessionId, isDragOverChat,
    sessionList, isSidebarOpen, loadingElapsed, loadingStatusText,
    chatHistory, groupedSessions,
    loadSessionList, loadAgentHistory, selectSession,
    onChatDrop, onAgentFileChange, sendToAgent, stopAgent,
    newChat, deleteSession, scrollChat, autoResize,
    renderMarkdown, formatRelativeTime
  }
}
