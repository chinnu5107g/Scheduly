/** Trigger a browser download for in-memory text. */
export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function fileSafe(name) {
  return String(name || 'timetable').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'timetable'
}
