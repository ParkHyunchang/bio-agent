const SAFE_URL_PATTERN = /^(https?:|mailto:)/i

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(text) {
  return escapeHtml(text)
}

/**
 * GFM 테이블 블록을 감지해 <table>로 치환.
 * 입력은 이미 escapeHtml이 적용된 문자열이므로 | 와 - 는 원문 그대로.
 * 패턴:
 *   | col1 | col2 |
 *   |------|------|
 *   | a    | b    |
 */
function replaceTables(html) {
  const tableRe = /(^|\n)(\|[^\n]+\|\n\|[\s:|-]+\|\n(?:\|[^\n]*\|\n?)+)/g
  return html.replace(tableRe, (_m, prefix, block) => {
    const lines = block.trim().split('\n')
    const parseRow = (line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim())
    const header = parseRow(lines[0])
    // lines[1] = 구분선 — 정렬 파싱
    const aligns = parseRow(lines[1]).map(cell => {
      const c = cell.replace(/\s/g, '')
      if (/^:-+:$/.test(c)) return 'center'
      if (/^-+:$/.test(c)) return 'right'
      return 'left'
    })
    const bodyRows = lines.slice(2).map(parseRow)

    const th = header.map((h, i) => `<th style="text-align:${aligns[i] || 'left'}">${h}</th>`).join('')
    const tr = bodyRows.map(row =>
      '<tr>' + row.map((cell, i) => `<td style="text-align:${aligns[i] || 'left'}">${cell}</td>`).join('') + '</tr>'
    ).join('')

    return `${prefix}<table class="md-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`
  })
}

export function renderMarkdown(text) {
  if (text == null) return ''
  // 1) 전체 이스케이프 (XSS 선제 차단)
  let html = escapeHtml(text)

  // 2) 코드 블록 먼저 (```...```), 내용은 이미 이스케이프됨
  html = html.replace(/```([\s\S]*?)```/g, (_m, code) => `<pre class="md-pre"><code>${code.trim()}</code></pre>`)

  // 3) 인라인 코드 `code`
  html = html.replace(/`([^`\n]+)`/g, (_m, code) => `<code class="md-code">${code}</code>`)

  // 4) GFM 테이블 (헤딩/개행 치환 전에 처리해야 구조 보존)
  html = replaceTables(html)

  // 5) 헤딩 ## / ###
  html = html.replace(/^### (.+)$/gm, '<strong class="md-heading md-heading--h3">$1</strong>')
  html = html.replace(/^## (.+)$/gm, '<strong class="md-heading">$1</strong>')

  // 6) 볼드/이탤릭
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/(?:^|[^*])\*([^*\n]+)\*(?!\*)/g, (m, inner) => m.replace(`*${inner}*`, `<em>${inner}</em>`))

  // 7) 링크 [text](url) — url 스킴 검증
  html = html.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    if (!SAFE_URL_PATTERN.test(url)) return escapeHtml(label)
    return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })

  // 8) 리스트 항목 - item → <li>...</li> (연속 라인 묶음)
  html = html.replace(/(^|\n)((?:- [^\n]+\n?)+)/g, (_m, prefix, block) => {
    const items = block.trim().split('\n').map(line => `<li>${line.replace(/^- /, '')}</li>`).join('')
    return `${prefix}<ul class="md-ul">${items}</ul>`
  })

  // 9) 개행 → <br> (단, 블록 태그 뒤 개행은 제거해 빈 줄 방지)
  html = html.replace(/\n+/g, (m) => m.length > 1 ? '<br><br>' : '<br>')
  html = html.replace(/(<\/(?:ul|pre|li|strong|table|thead|tbody|tr|td|th)>)<br>/g, '$1')

  return html
}

/**
 * 검색어 토큰을 본문에서 <mark>로 감싼 안전한 HTML을 반환.
 * - 입력 텍스트는 escapeHtml 적용 후 처리되어 XSS 안전.
 * - query에서 PubMed term 연산자([dp], AND, OR, NOT, " ", ()) 제거.
 * - 2글자 이상 토큰만 매칭, 대소문자 구분 안 함.
 */
export function highlightQuery(text, query) {
  const escaped = escapeHtml(text == null ? '' : String(text))
  if (!query) return escaped
  const tokens = String(query)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(AND|OR|NOT)\b/gi, ' ')
    .replace(/["()]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2)
  if (tokens.length === 0) return escaped
  const re = new RegExp(
    '(' + tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
    'gi'
  )
  return escaped.replace(re, '<mark>$1</mark>')
}

/**
 * AI 리뷰 본문 렌더러. renderMarkdown을 그대로 사용해 **bold**, *italic*,
 * 인라인 코드, 링크, 표, 코드블록을 모두 지원한다. 헤더(##, ###)는
 * renderMarkdown이 .md-heading / .md-heading--h3 클래스를 부여하므로,
 * paper-review.css에서 해당 클래스를 리뷰 섹션 헤더 스타일로 매핑한다.
 */
export function renderPaperReview(text) {
  if (text == null) return ''
  return renderMarkdown(text)
}
