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

// 429 응답을 일관된 에러 메시지로 정규화 (서버 응답에 error 문자열이 있을 때)
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 429) {
      err.message = err.response.data?.error || '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
    }
    return Promise.reject(err)
  }
)

export default api
