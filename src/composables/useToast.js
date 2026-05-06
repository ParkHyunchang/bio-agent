import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

// 같은 (type, message) 토스트가 짧은 시간 내에 들어오면 새 토스트를 만들지 않고
// 기존 토스트의 count만 증가시킨다. 사용자가 빠르게 트리거하는 동일 에러로
// 토스트 더미가 쌓이는 현상을 방지.
const DEDUPE_WINDOW_MS = 1500

export function useToast() {
  function add(message, type, duration = 3500) {
    const now = Date.now()
    const recent = [...toasts.value].reverse().find(
      t => t.message === message && t.type === type && (now - t.createdAt) <= DEDUPE_WINDOW_MS
    )
    if (recent) {
      recent.count = (recent.count || 1) + 1
      recent.createdAt = now
      // 기존 자동 제거 타이머는 살아있으므로 여기선 별도 처리 안 함
      return
    }

    const id = ++nextId
    const toast = { id, message, type, count: 1, createdAt: now }
    toasts.value.push(toast)
    if (duration > 0) setTimeout(() => remove(id), duration)
  }

  function remove(id) {
    const i = toasts.value.findIndex(t => t.id === id)
    if (i !== -1) toasts.value.splice(i, 1)
  }

  return {
    toasts,
    success: (msg, dur) => add(msg, 'success', dur),
    error:   (msg, dur) => add(msg, 'error',   dur ?? 5000),
    info:    (msg, dur) => add(msg, 'info',    dur),
    warn:    (msg, dur) => add(msg, 'warn',    dur),
    remove,
  }
}
