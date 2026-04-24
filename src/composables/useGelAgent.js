import { ref, computed, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { fetchSessions, fetchHistory, deleteSession as apiDeleteSession, streamChat } from '@/services/agent.service'
import { renderMarkdown } from '@/utils/markdown'
import { formatRelativeTime } from '@/utils/format'

const ERROR_BANNER_TTL_MS = 5000
let messageIdSeq = 0
const nextMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  messageIdSeq += 1
  return `msg-${Date.now()}-${messageIdSeq}`
}

export function useGelAgent() {
  const agentMessages = ref([])
  const agentInput = ref('')
  const agentFile = ref(null)
  const agentFilePreviewUrl = ref(null)
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
  const errorBanner = ref('')
  const errorBannerTimer = ref(null)
  let sessionRequestSeq = 0
  // 재시도/재생성을 위해 마지막 사용자 요청의 원본을 보관 (File 참조 포함)
  const lastUserRequest = ref(null)
  // 사이드바 포커스 복원용
  let previousFocus = null

  function setErrorBanner(message) {
    if (!message) return
    errorBanner.value = message
    if (errorBannerTimer.value) clearTimeout(errorBannerTimer.value)
    errorBannerTimer.value = setTimeout(() => {
      errorBanner.value = ''
      errorBannerTimer.value = null
    }, ERROR_BANNER_TTL_MS)
  }

  function clearErrorBanner() {
    errorBanner.value = ''
    if (errorBannerTimer.value) {
      clearTimeout(errorBannerTimer.value)
      errorBannerTimer.value = null
    }
  }

  function normalizeMessage(m) {
    return {
      id: nextMessageId(),
      role: m.role,
      text: m.text,
      hadImage: !!m.hadImage,
      imageUrl: m.imageUrl || null,
      isError: !!m.isError,
    }
  }

  function setAgentFile(file) {
    if (agentFilePreviewUrl.value) URL.revokeObjectURL(agentFilePreviewUrl.value)
    agentFile.value = file || null
    agentFilePreviewUrl.value = file ? URL.createObjectURL(file) : null
  }

  function clearAgentFile() {
    setAgentFile(null)
  }

  function revokeMessageBlobUrls(messages) {
    if (!messages) return
    for (const m of messages) {
      if (m?.imageUrl && typeof m.imageUrl === 'string' && m.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(m.imageUrl)
      }
    }
  }

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
    } catch (e) {
      console.warn('세션 목록 로드 실패:', e)
      setErrorBanner('대화 목록을 불러오지 못했습니다.')
    }
  }

  async function selectSession(sessionId) {
    if (sessionId === agentSessionId.value) return
    const reqId = ++sessionRequestSeq
    agentSessionId.value = sessionId
    localStorage.setItem('agentSessionId', sessionId)
    revokeMessageBlobUrls(agentMessages.value)
    agentMessages.value = []
    try {
      const data = await fetchHistory(sessionId)
      if (reqId !== sessionRequestSeq) return
      if (Array.isArray(data)) {
        agentMessages.value = data.map(normalizeMessage)
      }
    } catch (e) {
      if (reqId !== sessionRequestSeq) return
      console.warn('세션 히스토리 로드 실패:', e)
      setErrorBanner('대화 내용을 불러오지 못했습니다.')
    }
    await nextTick()
    scrollChat()
  }

  async function loadAgentHistory() {
    try {
      const sid = localStorage.getItem('agentSessionId')
      if (!sid) return
      const reqId = ++sessionRequestSeq
      agentSessionId.value = sid
      const data = await fetchHistory(sid)
      if (reqId !== sessionRequestSeq) return
      if (Array.isArray(data) && data.length) {
        agentMessages.value = data.map(normalizeMessage)
        await nextTick()
        scrollChat()
      }
    } catch (e) {
      console.warn('최근 세션 복원 실패:', e)
      localStorage.removeItem('agentSessionId')
    }
  }

  function onChatDrop(e) {
    isDragOverChat.value = false
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      setAgentFile(file)
    }
  }

  function onAgentFileChange(e) {
    setAgentFile(e.target.files[0] || null)
    if (agentFileInput.value) agentFileInput.value.value = ''
  }

  function onInputKeydown(e) {
    if (e.key !== 'Enter') return
    if (e.shiftKey) return
    if (e.isComposing || e.keyCode === 229) return
    e.preventDefault()
    sendToAgent()
  }

  function onInputPaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          setAgentFile(file)
          e.preventDefault()
          return
        }
      }
    }
  }

  async function sendToAgent() {
    const text = agentInput.value.trim()
    if (!text && !agentFile.value) return
    if (isAgentLoading.value) return

    const file = agentFile.value
    const imageUrl = agentFilePreviewUrl.value

    agentMessages.value.push(normalizeMessage({
      role: 'user',
      text: text || '(이미지 분석 요청)',
      imageUrl,
    }))
    lastUserRequest.value = { text, file }
    agentInput.value = ''
    agentFile.value = null
    agentFilePreviewUrl.value = null
    await dispatchRequest(text, file)
  }

  async function dispatchRequest(text, file) {
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
    const sessionAtSend = agentSessionId.value

    try {
      await streamChat(form, {
        onProgress: async (msg) => {
          loadingStatusText.value = msg
          await nextTick()
          scrollChat()
        },
        onDone: (parsed) => {
          if (agentSessionId.value !== sessionAtSend && sessionAtSend !== null) return
          agentSessionId.value = parsed.sessionId
          agentMessages.value.push(normalizeMessage({ role: 'agent', text: parsed.message }))
        },
        onError: (msg) => {
          agentMessages.value.push(normalizeMessage({
            role: 'agent',
            text: '오류가 발생했습니다: ' + msg,
            isError: true,
          }))
        }
      }, controller.signal)
    } catch (e) {
      if (e.name !== 'AbortError') {
        agentMessages.value.push(normalizeMessage({
          role: 'agent',
          text: '오류가 발생했습니다: ' + e.message,
          isError: true,
        }))
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

  async function retryLastRequest() {
    if (isAgentLoading.value) return
    const req = lastUserRequest.value
    if (!req) return
    // 마지막 메시지가 에러(실패한 에이전트 응답)면 제거
    const last = agentMessages.value[agentMessages.value.length - 1]
    if (last && last.role === 'agent' && last.isError) {
      agentMessages.value.pop()
    }
    await dispatchRequest(req.text, req.file)
  }

  async function regenerateLastResponse() {
    if (isAgentLoading.value) return
    const req = lastUserRequest.value
    if (!req) return
    const last = agentMessages.value[agentMessages.value.length - 1]
    if (last && last.role === 'agent') {
      revokeMessageBlobUrls([last])
      agentMessages.value.pop()
    }
    await dispatchRequest(req.text, req.file)
  }

  function stopAgent() {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
  }

  function newChat() {
    stopAgent()
    revokeMessageBlobUrls(agentMessages.value)
    agentSessionId.value = null
    agentMessages.value = []
    agentInput.value = ''
    clearAgentFile()
    localStorage.removeItem('agentSessionId')
  }

  async function deleteSession(sessionId) {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm('이 대화를 삭제하시겠습니까? 복구할 수 없습니다.')) return
    }
    try {
      await apiDeleteSession(sessionId)
    } catch (e) {
      console.warn('세션 삭제 실패:', e)
      setErrorBanner('대화 삭제에 실패했습니다.')
      return
    }
    if (agentSessionId.value === sessionId) {
      stopAgent()
      revokeMessageBlobUrls(agentMessages.value)
      agentSessionId.value = null
      agentMessages.value = []
      localStorage.removeItem('agentSessionId')
    }
    loadSessionList()
  }

  async function copyMessage(text) {
    if (!text) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setErrorBanner('') // reuse area for transient success? skip — keep simple
    } catch (e) {
      console.warn('복사 실패:', e)
      setErrorBanner('클립보드 복사에 실패했습니다.')
    }
  }

  function onEscKey(e) {
    if (e.key === 'Escape' && isSidebarOpen.value) {
      closeSidebar()
    }
  }

  function openSidebar() {
    if (isSidebarOpen.value) return
    previousFocus = (typeof document !== 'undefined') ? document.activeElement : null
    isSidebarOpen.value = true
    nextTick(() => {
      const sidebar = document.querySelector('.session-sidebar')
      if (!sidebar) return
      const focusable = sidebar.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])')
      if (focusable && typeof focusable.focus === 'function') focusable.focus()
    })
  }

  function closeSidebar() {
    if (!isSidebarOpen.value) return
    isSidebarOpen.value = false
    nextTick(() => {
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus()
      }
      previousFocus = null
    })
  }

  function toggleSidebar() {
    isSidebarOpen.value ? closeSidebar() : openSidebar()
  }

  function onSidebarKeydown(e) {
    if (e.key !== 'Tab') return
    const sidebar = e.currentTarget
    if (!sidebar) return
    const focusables = sidebar.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onEscKey)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onEscKey)
    stopAgent()
    revokeMessageBlobUrls(agentMessages.value)
    if (agentFilePreviewUrl.value) URL.revokeObjectURL(agentFilePreviewUrl.value)
    if (loadingTimer.value) clearInterval(loadingTimer.value)
    if (errorBannerTimer.value) clearTimeout(errorBannerTimer.value)
  })

  function scrollChat() {
    if (chatHistory.value) chatHistory.value.scrollTop = chatHistory.value.scrollHeight
  }

  function autoResize(e) {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return {
    agentMessages, agentInput, agentFile, agentFilePreviewUrl, agentFileInput,
    isAgentLoading, agentSessionId, isDragOverChat,
    sessionList, isSidebarOpen, loadingElapsed, loadingStatusText,
    chatHistory, groupedSessions,
    errorBanner, clearErrorBanner, lastUserRequest,
    loadSessionList, loadAgentHistory, selectSession,
    onChatDrop, onAgentFileChange, sendToAgent, stopAgent,
    onInputKeydown, onInputPaste, clearAgentFile,
    newChat, deleteSession, copyMessage, scrollChat, autoResize,
    retryLastRequest, regenerateLastResponse,
    openSidebar, closeSidebar, toggleSidebar, onSidebarKeydown,
    renderMarkdown, formatRelativeTime
  }
}
