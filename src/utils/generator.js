// Automatic timetable builder — pure functions, no React.
//
// Given a timetable and its subjects, place every subject across the week:
//   • each subject has a duration (`span` slots) and a number of sessions per week (`perWeek`; 0/unset = auto)
//   • sessions are spread over different days, and over different periods from day to day
//   • on school / college timetables a teacher is picked per subject (the subject's own teacher, else a
//     teacher whose "subjects" list matches) and a slot is skipped when that teacher is already busy in
//     another active timetable, so the result has no teacher or room clashes with your other timetables
//   • breaks are never used, and a subject never runs across a break or into another subject
//
// It is a greedy placer, not an optimiser: it can leave sessions unplaced, and says so in `unplaced`.

import { actSpan, placementWindow, slotKey, slotRows } from './timetableModel.js'
import { collectBookings } from './timetableValidation.js'

const ruleOn = (constraints, rule) => {
  const c = (constraints || []).find((x) => x.rule === rule)
  return c ? c.enabled !== false : true
}

const words = (text) =>
  String(text || '')
    .toLowerCase()
    .split(/[,;&/]| and /)
    .map((s) => s.trim())
    .filter(Boolean)

/** Teacher ids that can take this subject. [null] means "no teacher" (not tracked or nobody matches). */
function teacherCandidates(act, tt, resources) {
  if (!tt.trackResources) return [null]
  const teachers = resources?.teachers || []
  if (act.teacherId) return [act.teacherId]
  const name = act.name.toLowerCase()
  const matches = teachers.filter((t) => words(t.subjects).some((s) => s === name || name.includes(s) || s.includes(name)))
  return matches.length ? matches.map((t) => t.id) : [null]
}

function sessionsPerSubject(tt, acts, freeSlots) {
  const fixed = acts.filter((a) => Number(a.perWeek) > 0)
  const auto = acts.filter((a) => !(Number(a.perWeek) > 0))
  const sessions = {}
  let used = 0
  for (const a of fixed) {
    sessions[a.id] = Math.round(Number(a.perWeek))
    used += sessions[a.id] * actSpan(a)
  }
  let remaining = Math.max(0, freeSlots - used)
  const spanSum = auto.reduce((n, a) => n + actSpan(a), 0)
  if (auto.length && spanSum > 0) {
    const base = Math.floor(remaining / spanSum)
    for (const a of auto) {
      sessions[a.id] = base
      remaining -= base * actSpan(a)
    }
    // Hand out what is left one session at a time, shortest subjects first.
    const byLength = [...auto].sort((a, b) => actSpan(a) - actSpan(b))
    let progressed = true
    while (remaining > 0 && progressed) {
      progressed = false
      for (const a of byLength) {
        if (actSpan(a) <= remaining) {
          sessions[a.id] += 1
          remaining -= actSpan(a)
          progressed = true
        }
      }
    }
  }
  return sessions
}

/**
 * @param tt          the timetable to fill
 * @param opts.timetables   all timetables (other active ones are used for clash checks)
 * @param opts.constraints  rules (teacher_clash / room_clash can be switched off)
 * @param opts.resources    { teachers, rooms }
 * @param opts.mode   'fill' keeps existing entries and fills the gaps; 'replace' starts from an empty grid
 */
export function generateSchedule(tt, { timetables = [], constraints = [], resources = null, mode = 'fill' } = {}) {
  const acts = tt.activities || []
  const rows = slotRows(tt)
  if (!acts.length || !rows.length || !tt.days.length) return { tt, filled: 0, placed: 0, unplaced: [], withoutTeacher: 0 }

  const work = { ...tt, slots: mode === 'replace' ? {} : { ...tt.slots } }
  const teacherOn = ruleOn(constraints, 'teacher_clash')
  const others = collectBookings(timetables.filter((t) => t.id !== tt.id))
  const busy = (teacherId, day, startMin, endMin) =>
    Boolean(teacherOn && teacherId && others.some((b) => b.teacherId === teacherId && b.day === day && b.startMin < endMin && startMin < b.endMin))

  // Free capacity, in slots, in the grid we are about to fill.
  let freeSlots = 0
  for (const day of work.days ?? tt.days) {
    for (const r of rows) if (!work.slots[slotKey(day, r.start)]) freeSlots++
  }
  // Slots covered by longer existing entries are not free.
  const probe = (day, i) => placementWindow(work, day, rows[i].start, 1).ok
  freeSlots = 0
  for (const day of tt.days) for (let i = 0; i < rows.length; i++) if (probe(day, i)) freeSlots++

  const sessions = sessionsPerSubject(tt, acts, freeSlots)
  const order = [...acts].sort((a, b) => actSpan(b) - actSpan(a))
  const queue = []
  const rounds = Math.max(0, ...Object.values(sessions))
  for (let r = 0; r < rounds; r++) for (const a of order) if ((sessions[a.id] || 0) > r) queue.push(a)

  const perDay = Object.fromEntries(tt.days.map((d) => [d, 0]))
  const onDay = {} // activityId -> { day: count }
  const placedCount = {}
  const blockedByTeacher = {}
  let withoutTeacher = 0
  let filledCells = 0
  let placed = 0

  const tryPlace = (act, strict) => {
    const span = actSpan(act)
    const cands = teacherCandidates(act, tt, resources)
    const seen = onDay[act.id] || {}
    const days = [...tt.days]
      .map((d, di) => ({ d, di }))
      .sort((x, y) => (seen[x.d] || 0) - (seen[y.d] || 0) || perDay[x.d] - perDay[y.d] || x.di - y.di)
    for (const { d, di } of days) {
      if (strict && seen[d]) continue
      // Start each day at a different period so one subject is not always first lesson.
      const offset = ((placedCount[act.id] || 0) * 2 + di) % rows.length
      for (let k = 0; k < rows.length; k++) {
        const i = (offset + k) % rows.length
        const win = placementWindow(work, d, rows[i].start, span)
        if (!win.ok) continue
        let teacherId = null
        if (cands[0] !== null) {
          teacherId = cands.find((id) => !busy(id, d, win.startMin, win.endMin)) ?? null
          if (!teacherId) {
            blockedByTeacher[act.id] = true
            continue
          }
        }
        const entry = { activityId: act.id }
        if (span > 1) entry.span = span
        if (teacherId) entry.teacherId = teacherId
        else if (tt.trackResources) withoutTeacher++
        work.slots[slotKey(d, rows[i].start)] = entry
        perDay[d] += span
        onDay[act.id] = { ...seen, [d]: (seen[d] || 0) + 1 }
        placedCount[act.id] = (placedCount[act.id] || 0) + 1
        filledCells += span
        placed++
        return true
      }
    }
    return false
  }

  const missing = {}
  for (const act of queue) {
    if (!tryPlace(act, true) && !tryPlace(act, false)) missing[act.id] = (missing[act.id] || 0) + 1
  }

  const unplaced = acts
    .filter((a) => missing[a.id])
    .map((a) => ({
      activityId: a.id,
      name: a.name,
      missing: missing[a.id],
      wanted: sessions[a.id] || 0,
      reason: blockedByTeacher[a.id] ? 'its teacher is busy in your other timetables at the free times' : 'there was no free time left',
    }))

  return { tt: work, filled: filledCells, placed, unplaced, withoutTeacher }
}

/** One readable summary for a toast or assistant message. */
export function summarizeGeneration(res) {
  if (!res.placed) return res.unplaced.length ? 'Nothing could be placed. ' + describeUnplaced(res.unplaced) : 'There was nothing to place: the grid is full or has no subjects.'
  let text = `Placed ${res.placed} session${res.placed === 1 ? '' : 's'} (${res.filled} slot${res.filled === 1 ? '' : 's'}).`
  if (res.unplaced.length) text += ' ' + describeUnplaced(res.unplaced)
  if (res.withoutTeacher) text += ` ${res.withoutTeacher} session${res.withoutTeacher === 1 ? ' has' : 's have'} no teacher yet, so ${res.withoutTeacher === 1 ? 'it isn’t' : 'they aren’t'} clash-checked.`
  return text
}

export function describeUnplaced(unplaced) {
  return (
    'Couldn’t place: ' +
    unplaced.map((u) => `${u.name} (${u.missing} of ${u.wanted}, ${u.reason})`).join('; ') +
    '.'
  )
}
