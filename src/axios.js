import axios from 'axios'

const getBaseURL = () => {
  const hostname = window.location.hostname
  const port = 3211

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://localhost:${port}`
  }

  if (hostname === '125.141.20.218') {
    return `http://125.141.20.218:${port}`
  }

  if (hostname.includes('synology.me')) {
    return `http://${hostname}:${port}`
  }

  return `http://125.141.20.218:${port}`
}

const api = axios.create({
  baseURL: getBaseURL(),
  // 기본 타임아웃. OCR/리뷰 등 긴 작업은 호출부에서 override.
  timeout: 30_000,
})

// GlobalExceptionHandler가 반환하는 { error, status, requestId } 형식을 활용해
// err.message를 사용자 친화적 메시지로 정규화.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status
    const serverMsg = err.response?.data?.error
    if (serverMsg) {
      err.message = serverMsg
    } else if (status === 429) {
      err.message = '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
    } else if (status >= 500) {
      err.message = '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    }
    return Promise.reject(err)
  }
)

export default api
