// Small time helpers. Times are stored as "HH:MM" (24h) strings.

export function toMinutes(t) {
  if (typeof t !== 'string') return NaN
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return NaN
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 24 || min > 59 || (h === 24 && min !== 0)) return NaN
  return h * 60 + min
}

export function toTime(minutes) {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatTime(t, format = '24h') {
  const mins = toMinutes(t)
  if (Number.isNaN(mins)) return t
  if (format === '24h') return toTime(mins)
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function formatRange(start, end, format = '24h') {
  return `${formatTime(start, format)} – ${formatTime(end, format)}`
}

export function formatRelative(timestamp, now = Date.now()) {
  const diff = Math.max(0, now - Number(timestamp))
  if (!Number.isFinite(diff)) return 'Unknown'
  const sec = Math.floor(diff / 1000)
  if (sec < 45) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`
  return new Date(Number(timestamp)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Monday of the week containing `date`, shifted by `offsetWeeks`.
export function startOfWeek(date = new Date(), offsetWeeks = 0) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - dow + offsetWeeks * 7)
  return d
}

export function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

export function formatWeekRange(monday) {
  const sunday = addDays(monday, 6)
  const opts = { day: 'numeric', month: 'short' }
  const a = monday.toLocaleDateString(undefined, opts)
  const b = sunday.toLocaleDateString(undefined, { ...opts, year: 'numeric' })
  return `${a} – ${b}`
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}
