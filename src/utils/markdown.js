export function renderMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  html = html.replace(/^## (.+)$/gm, '<strong class="md-heading">$1</strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\n/g, '<br>')
  return html
}

export function renderPaperReview(text) {
  return text
    .split('\n')
    .map(line => {
      if (line.startsWith('## ')) return `<h3 class="rv-h3">${line.slice(3)}</h3>`
      if (line.startsWith('### ')) return `<h4 class="rv-h4">${line.slice(4)}</h4>`
      if (line.startsWith('- ') || line.startsWith('* ')) return `<li class="rv-li">${line.slice(2)}</li>`
      if (line.trim() === '') return '<div class="rv-gap"></div>'
      return `<p class="rv-p">${line}</p>`
    })
    .join('')
}
