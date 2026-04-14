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
  baseURL: getBaseURL()
})

export default api
