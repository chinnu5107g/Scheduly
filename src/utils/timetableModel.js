// Timetable data model and pure helpers (no React, no browser APIs except crypto fallback).
//
// A timetable record looks like:
// {
//   id, name, type, category,
//   days: ['Mon', ...], startTime: '09:00', endTime: '16:00', slotMinutes: 60,
//   breaks: [{ id, label, start, end }],
//   activities: [{ id, name, color }],
//   slots: { 'Mon|09:00': { activityId, note, teacherId, roomId } },
//   trackResources: boolean,   // show teacher / room fields (institutional types)
//   allowOverlaps: boolean,    // personal schedules: user explicitly permits overlaps
//   notes: string,
//   status: 'Active' | 'Draft' | 'Archived',
//   origin: 'demo' | 'manual' | 'assistant',
//   createdAt, updatedAt
// }
//
// Every slot entry is addressed by (day, start time), which is exactly what a future
// collision validator needs: see timetableValidation.js.

import { formatRange, toMinutes, toTime } from './time.js'
import { DAYS, ACTIVITY_COLORS, getType } from './timetableTypes.js'

export const STATUSES = ['Active', 'Draft', 'Archived']

export function uid(prefix = 'id') {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`
  } catch {
    /* fall through */
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function slotKey(day, start) {
  return `${day}|${start}`
}

export function sortDays(days) {
  return DAYS.filter((d) => days.includes(d))
}

/** Rows of the weekly grid: slots and break rows, in time order. */
export function computeRows(tt) {
  const start = toMinutes(tt.startTime)
  const end = toMinutes(tt.endTime)
  const step = Number(tt.slotMinutes)
  if (!(end > start) || !(step > 0)) return []

  const breaks = (tt.breaks || [])
    .map((b) => ({ ...b, s: toMinutes(b.start), e: toMinutes(b.end) }))
    .filter((b) => b.s < b.e && b.e > start && b.s < end)
    .sort((a, b) => a.s - b.s)

  const rows = []
  let t = start
  let bi = 0
  let guard = 600
  while (t < end && guard-- > 0) {
    while (bi < breaks.length && breaks[bi].e <= t) bi++
    const b = breaks[bi]
    if (b && b.s <= t) {
      const e = Math.min(b.e, end)
      rows.push({ kind: 'break', start: toTime(t), end: toTime(e), label: b.label, breakId: b.id })
      t = e
      bi++
      continue
    }
    let e = Math.min(t + step, end)
    if (b && b.s < e) e = b.s
    rows.push({ kind: 'slot', start: toTime(t), end: toTime(e) })
    t = e
  }
  return rows
}

export function slotRows(tt) {
  return computeRows(tt).filter((r) => r.kind === 'slot')
}

export function periodsPerDay(tt) {
  return slotRows(tt).length
}

/** Remove entries that no longer fit the grid (after days, times or breaks changed). */
export function pruneSlots(tt) {
  const valid = new Set()
  const rows = slotRows(tt)
  for (const d of tt.days) for (const r of rows) valid.add(slotKey(d, r.start))
  const slots = {}
  for (const [k, v] of Object.entries(tt.slots || {})) if (valid.has(k)) slots[k] = v
  return { ...tt, slots }
}

export function makeActivities(names, existing = []) {
  const out = [...existing]
  for (const raw of names) {
    const name = String(raw).trim()
    if (!name) continue
    if (out.some((a) => a.name.toLowerCase() === name.toLowerCase())) continue
    out.push({ id: uid('act'), name, color: ACTIVITY_COLORS[out.length % ACTIVITY_COLORS.length] })
  }
  return out
}

export function findActivityByName(tt, name) {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return null
  return (
    tt.activities.find((a) => a.name.toLowerCase() === n) ||
    tt.activities.find((a) => a.name.toLowerCase().includes(n) || n.includes(a.name.toLowerCase())) ||
    null
  )
}

export function getActivity(tt, id) {
  return tt.activities.find((a) => a.id === id) || null
}

/** How many consecutive slots a subject normally takes (its duration). */
export const actSpan = (a) => Math.max(1, Math.min(12, Math.round(Number(a?.span) || 1)))

/**
 * A "block" is one scheduled entry plus the slots it covers. An entry stores only its first slot;
 * `span` says how many consecutive slots it takes. Spans are clamped so a block never runs across a
 * break, past the end of the day or into the next entry, so blocks in one timetable cannot overlap.
 */
export function blocksFor(tt) {
  const rows = slotRows(tt)
  const out = []
  for (const day of tt.days) {
    let coveredUntil = -1
    rows.forEach((row, i) => {
      if (i <= coveredUntil) return
      const entry = tt.slots?.[slotKey(day, row.start)]
      if (!entry || !entry.activityId) return
      const want = Math.max(1, Math.round(Number(entry.span) || 1))
      let span = 1
      while (span < want) {
        const next = rows[i + span]
        if (!next || next.start !== rows[i + span - 1].end) break
        if (tt.slots?.[slotKey(day, next.start)]?.activityId) break
        span++
      }
      coveredUntil = i + span - 1
      const last = rows[i + span - 1]
      out.push({
        day,
        key: slotKey(day, row.start),
        index: i,
        span,
        entry,
        start: row.start,
        end: last.end,
        startMin: toMinutes(row.start),
        endMin: toMinutes(last.end),
      })
    })
  }
  return out
}

/** Map of slot key -> head key for slots that are covered by an earlier, longer entry. */
export function coverageMap(tt) {
  const rows = slotRows(tt)
  const map = {}
  for (const b of blocksFor(tt)) {
    for (let k = 1; k < b.span; k++) map[slotKey(b.day, rows[b.index + k].start)] = b.key
  }
  return map
}

/**
 * Can an entry of `span` slots start at `startKey` (an "HH:MM" slot start) on `day`?
 * `ignoreKey` is the head key of the entry being edited, so it does not block itself.
 */
export function placementWindow(tt, day, startKey, span, ignoreKey = null) {
  const rows = slotRows(tt)
  const i = rows.findIndex((r) => r.start === startKey)
  if (i < 0) return { ok: false, reason: 'That time is not available.' }
  const occupied = new Set()
  for (const b of blocksFor(tt)) {
    if (b.day !== day || b.key === ignoreKey) continue
    for (let k = 0; k < b.span; k++) occupied.add(b.index + k)
  }
  for (let k = 0; k < span; k++) {
    const r = rows[i + k]
    if (!r) return { ok: false, reason: 'There is not enough time left in the day for that duration.' }
    if (k > 0 && r.start !== rows[i + k - 1].end) return { ok: false, reason: 'That duration would run into a break.' }
    if (occupied.has(i + k)) {
      return { ok: false, reason: k === 0 ? 'That time is already taken.' : 'That duration would overlap the next subject.' }
    }
  }
  const last = rows[i + span - 1]
  return { ok: true, start: rows[i].start, end: last.end, startMin: toMinutes(rows[i].start), endMin: toMinutes(last.end) }
}

export function durationLabel(tt, span) {
  const m = span * Number(tt.slotMinutes)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r} min`
  return r ? `${h} h ${r} min` : `${h} h`
}

/** Duration choices for the pickers: 1..N slots, never more than fit in a day. */
export function durationSpans(tt) {
  const n = Math.min(8, Math.max(1, slotRows(tt).length))
  return Array.from({ length: n }, (_, i) => i + 1)
}

/** Build a complete timetable record from a (partial) configuration. */
export function makeTimetable(cfg, now = Date.now()) {
  const type = getType(cfg.type)
  const days = sortDays(cfg.days && cfg.days.length ? cfg.days : type.days)
  const tt = {
    id: cfg.id || uid('tt'),
    name: String(cfg.name || 'Untitled timetable').trim(),
    type: type.id,
    category: String(cfg.category ?? type.defaultCategory ?? '').trim(),
    days,
    startTime: cfg.startTime || type.startTime,
    endTime: cfg.endTime || type.endTime,
    slotMinutes: Number(cfg.slotMinutes) || type.slotMinutes,
    breaks: (cfg.breaks ?? type.breaks).map((b) => ({
      id: b.id || uid('brk'),
      label: String(b.label || 'Break').trim(),
      start: b.start,
      end: b.end,
    })),
    activities: cfg.activities
      ? cfg.activities.map((a) => ({ ...a }))
      : makeActivities(cfg.activityNames || []),
    slots: cfg.slots || {},
    trackResources: cfg.trackResources ?? type.institutional,
    allowOverlaps: Boolean(cfg.allowOverlaps),
    notes: String(cfg.notes || ''),
    status: cfg.status || 'Active',
    origin: cfg.origin || 'manual',
    createdAt: cfg.createdAt || now,
    updatedAt: cfg.updatedAt || now,
  }
  return pruneSlots(tt)
}

export function duplicateTimetable(tt, now = Date.now()) {
  return {
    ...tt,
    id: uid('tt'),
    name: `${tt.name} (copy)`,
    breaks: tt.breaks.map((b) => ({ ...b, id: uid('brk') })),
    activities: tt.activities.map((a) => ({ ...a })),
    slots: Object.fromEntries(Object.entries(tt.slots).map(([k, v]) => [k, { ...v }])),
    createdAt: now,
    updatedAt: now,
  }
}

/** Convert a matrix of activity names (one row per day, one column per slot) to slots. */
export function slotsFromMatrix(tt, matrix, defaults = {}) {
  const rows = slotRows(tt)
  const slots = {}
  tt.days.forEach((day, di) => {
    const line = matrix[di] || []
    rows.forEach((row, ri) => {
      const name = line[ri]
      if (!name) return
      const act = findActivityByName(tt, name)
      if (!act) return
      const [teacherId, roomId] = defaults[act.name] || []
      const entry = { activityId: act.id }
      if (teacherId) entry.teacherId = teacherId
      if (roomId) entry.roomId = roomId
      slots[slotKey(day, row.start)] = entry
    })
  })
  return slots
}

export function activityUsage(tt) {
  const usage = {}
  for (const entry of Object.values(tt.slots || {})) {
    if (entry && entry.activityId) usage[entry.activityId] = (usage[entry.activityId] || 0) + 1
  }
  return usage
}

export function countFilled(tt) {
  return blocksFor(tt).reduce((n, b) => n + b.span, 0)
}

export function totalCells(tt) {
  return tt.days.length * periodsPerDay(tt)
}

/**
 * Simple round-robin draft. This is NOT an optimiser and does not check clashes;
 * it only gives the user a starting grid to edit.
 */
export function autoFill(tt, { weights = {}, overwrite = false } = {}) {
  const acts = tt.activities
  if (!acts.length) return { tt, filled: 0 }
  const seq = []
  for (const a of acts) {
    const w = Math.max(1, Math.round(weights[a.id] || 1))
    for (let i = 0; i < w; i++) seq.push(a.id)
  }
  const rows = slotRows(tt)
  const slots = { ...tt.slots }
  const covered = coverageMap(tt)
  let filled = 0
  tt.days.forEach((day, di) => {
    rows.forEach((row, ri) => {
      const key = slotKey(day, row.start)
      if (covered[key]) return
      if (slots[key]?.activityId && !overwrite) return
      slots[key] = { activityId: seq[(ri + di) % seq.length] }
      filled++
    })
  })
  return { tt: { ...tt, slots }, filled }
}

/** Give an activity more periods: empty cells first, then cells of the most-used other activity. */
export function addPeriods(tt, activityId, count) {
  const rows = slotRows(tt)
  const slots = { ...tt.slots }
  let added = 0
  let replaced = 0
  const cells = []
  for (const day of tt.days) for (const row of rows) cells.push(slotKey(day, row.start))

  const covered = coverageMap(tt)
  for (const key of cells) {
    if (added >= count) break
    if (!slots[key]?.activityId && !covered[key]) {
      slots[key] = { activityId }
      added++
    }
  }
  if (added < count) {
    const usage = activityUsage({ slots })
    const donors = Object.entries(usage)
      .filter(([id]) => id !== activityId)
      .sort((a, b) => b[1] - a[1])
    if (donors.length) {
      const donorId = donors[0][0]
      const donorCells = cells.filter((k) => slots[k]?.activityId === donorId).reverse()
      for (const key of donorCells) {
        if (added >= count) break
        slots[key] = { activityId }
        added++
        replaced++
      }
    }
  }
  return { tt: { ...tt, slots }, added, replaced }
}

export function workingDaysLabel(days) {
  const sorted = sortDays(days)
  if (!sorted.length) return 'No days'
  if (sorted.length === 7) return 'Every day'
  const idx = sorted.map((d) => DAYS.indexOf(d))
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  if (contiguous && sorted.length >= 3) return `${sorted[0]}–${sorted[sorted.length - 1]}`
  return sorted.join(', ')
}

function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(tt, lookups = {}) {
  const lines = [['Time', ...tt.days].map(csvCell).join(',')]
  for (const row of computeRows(tt)) {
    const time = formatRange(row.start, row.end, '12h')
    if (row.kind === 'break') {
      lines.push([time, ...tt.days.map(() => row.label)].map(csvCell).join(','))
      continue
    }
    const covered = coverageMap(tt)
    const cells = tt.days.map((d) => {
      const k = slotKey(d, row.start)
      const e = tt.slots[k] || tt.slots[covered[k]]
      if (!e) return ''
      const act = getActivity(tt, e.activityId)
      const parts = [act ? act.name : '']
      const teacher = lookups.teachers?.find((t) => t.id === e.teacherId)
      const room = lookups.rooms?.find((r) => r.id === e.roomId)
      if (teacher) parts.push(teacher.name)
      if (room) parts.push(room.name)
      return parts.filter(Boolean).join(' / ')
    })
    lines.push([time, ...cells].map(csvCell).join(','))
  }
  return lines.join('\n')
}
