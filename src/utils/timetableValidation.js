// Timetable validation — pure functions, SEPARATE from the UI on purpose (no React here).
//
// WHAT IS CHECKED (real logic, runs across all non-archived timetables):
//   • teacher_clash  A teacher cannot be in two timetables at overlapping times on the same day.
//   • room_clash     A room cannot host two timetables at overlapping times on the same day.
//
// WHAT THE GRID ALREADY MAKES IMPOSSIBLE (see blocksFor / placementWindow in timetableModel.js):
//   • class_overlap     One timetable holds one subject per slot, and a subject that spans several
//                       slots can never overlap the next one.
//   • personal_overlap  Same reason. Allowing overlaps on purpose is not supported yet.
//   • unavailable       Nothing can be placed in a break, and a subject cannot run across a break.
//
// WHAT IS NOT ENFORCED:
//   • Teacher "availability" text on the Teachers page is a note only.
//   • Custom rules written on the Constraints page are notes only.
//
// A timetable is repeated every week, so overlap is compared by day-of-week and minutes.

import { blocksFor } from './timetableModel.js'
import { formatRange, toTime } from './time.js'
import { DAY_NAMES } from './timetableTypes.js'

export const VALIDATION_IMPLEMENTED = true

export const CHECKED_RULES = ['teacher_clash', 'room_clash']
export const BUILT_IN_RULES = ['class_overlap', 'personal_overlap', 'unavailable']

export const RULES = [
  { id: 'teacher_clash', label: 'A teacher cannot be in two classes at the same time' },
  { id: 'room_clash', label: 'A room cannot host two classes at the same time' },
  { id: 'class_overlap', label: 'A class cannot have overlapping subjects' },
  { id: 'personal_overlap', label: 'Personal activities cannot overlap unless explicitly allowed' },
  { id: 'unavailable', label: 'Nothing is scheduled during breaks or unavailable times' },
]

const ruleOn = (constraints, rule) => {
  const c = (constraints || []).find((x) => x.rule === rule)
  return c ? c.enabled !== false : true
}

const overlaps = (a, b) => a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin

/**
 * Flatten timetables into bookings:
 * { timetableId, timetableName, key, day, start, end, startMin, endMin, activityId, activityName, teacherId, roomId }
 * Archived timetables are ignored: they are not in use, so they cannot block anyone.
 */
export function collectBookings(timetables, { includeArchived = false } = {}) {
  const bookings = []
  for (const tt of timetables) {
    if (!includeArchived && tt.status === 'Archived') continue
    for (const b of blocksFor(tt)) {
      const act = tt.activities.find((a) => a.id === b.entry.activityId)
      bookings.push({
        timetableId: tt.id,
        timetableName: tt.name,
        key: b.key,
        day: b.day,
        start: b.start,
        end: b.end,
        startMin: b.startMin,
        endMin: b.endMin,
        activityId: b.entry.activityId,
        activityName: act ? act.name : 'Activity',
        teacherId: b.entry.teacherId || null,
        roomId: b.entry.roomId || null,
      })
    }
  }
  return bookings
}

/** Every teacher / room clash between bookings. */
export function findConflicts(timetables, constraints = []) {
  const teacherOn = ruleOn(constraints, 'teacher_clash')
  const roomOn = ruleOn(constraints, 'room_clash')
  const bookings = collectBookings(timetables)
  const conflicts = []
  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const a = bookings[i]
      const b = bookings[j]
      if (!overlaps(a, b)) continue
      if (teacherOn && a.teacherId && a.teacherId === b.teacherId) {
        conflicts.push({ id: `teacher|${a.timetableId}|${a.key}|${b.timetableId}|${b.key}`, rule: 'teacher_clash', resourceId: a.teacherId, day: a.day, a, b })
      }
      if (roomOn && a.roomId && a.roomId === b.roomId) {
        conflicts.push({ id: `room|${a.timetableId}|${a.key}|${b.timetableId}|${b.key}`, rule: 'room_clash', resourceId: a.roomId, day: a.day, a, b })
      }
    }
  }
  return conflicts
}

export const conflictsFor = (conflicts, timetableId) =>
  conflicts.filter((c) => c.a.timetableId === timetableId || c.b.timetableId === timetableId)

/** Slot keys (e.g. "Mon|09:00") of this timetable that are involved in a clash. */
export function clashKeysFor(conflicts, timetableId) {
  const keys = new Set()
  for (const c of conflicts) {
    if (c.a.timetableId === timetableId) keys.add(c.a.key)
    if (c.b.timetableId === timetableId) keys.add(c.b.key)
  }
  return keys
}

/**
 * Who is already busy during a proposed window? Used by the slot editor before saving.
 * window = { day, startMin, endMin }; `ignore` = { timetableId, key } of the entry being edited.
 * Returns { teachers: {id: booking}, rooms: {id: booking} } for the first booking that overlaps.
 */
export function busyDuring(timetables, constraints, window, ignore = null) {
  const teacherOn = ruleOn(constraints, 'teacher_clash')
  const roomOn = ruleOn(constraints, 'room_clash')
  const teachers = {}
  const rooms = {}
  for (const b of collectBookings(timetables)) {
    if (ignore && b.timetableId === ignore.timetableId && b.key === ignore.key) continue
    if (!overlaps(b, window)) continue
    if (teacherOn && b.teacherId && !teachers[b.teacherId]) teachers[b.teacherId] = b
    if (roomOn && b.roomId && !rooms[b.roomId]) rooms[b.roomId] = b
  }
  return { teachers, rooms }
}

export function describeBooking(b, timeFormat = '12h') {
  return `${b.activityName} in “${b.timetableName}”, ${DAY_NAMES[b.day]} ${formatRange(b.start, b.end, timeFormat)}`
}

/** Readable one-liner for a conflict, e.g. “Dr. S. Rao is double-booked on Monday 9:00 AM – 10:00 AM: …”. */
export function describeConflict(c, resources, timeFormat = '12h') {
  const list = c.rule === 'teacher_clash' ? resources?.teachers : resources?.rooms
  const name = list?.find((x) => x.id === c.resourceId)?.name || (c.rule === 'teacher_clash' ? 'A teacher' : 'A room')
  const s = Math.max(c.a.startMin, c.b.startMin)
  const e = Math.min(c.a.endMin, c.b.endMin)
  const what = c.rule === 'teacher_clash' ? 'is teaching' : 'is booked for'
  return `${name} ${what} two things at once on ${DAY_NAMES[c.day]} ${formatRange(toTime(s), toTime(e), timeFormat)}: ${c.a.activityName} in “${c.a.timetableName}” and ${c.b.activityName} in “${c.b.timetableName}”.`
}

/** Summary for the whole workspace. */
export function validateAll(timetables, constraints = []) {
  const conflicts = findConflicts(timetables, constraints)
  return {
    implemented: VALIDATION_IMPLEMENTED,
    checked: CHECKED_RULES.filter((r) => ruleOn(constraints, r)),
    conflicts,
  }
}

/** How many scheduled entries of a resource-tracking timetable have no teacher yet. */
export function missingTeachers(tt) {
  if (!tt.trackResources) return 0
  return blocksFor(tt).filter((b) => !b.entry.teacherId).length
}

/** One honest sentence about what has and has not been checked. */
export function getValidationNotice(tt) {
  const base = 'Teacher and room clashes are checked against all your active timetables. Teacher availability notes are not enforced.'
  if (tt.origin === 'demo') return `Sample schedule for demonstration; it was not generated for you. ${base}`
  if (tt.origin === 'assistant') {
    return `Created with the demo assistant. Its auto-filled slots are a simple rotation with no teachers, so assign teachers to get clash checking. ${base}`
  }
  return base
}

/** The only place the UI asks "how does this timetable look?". */
export function getValidationBadge(tt, conflicts = []) {
  const n = conflictsFor(conflicts, tt.id).length
  if (n) return { tone: 'danger', label: `${n} clash${n === 1 ? '' : 'es'}`, title: 'Teacher or room clashes with another timetable' }
  const missing = missingTeachers(tt)
  if (missing) return { tone: 'warn', label: 'Teachers missing', title: `${missing} scheduled entr${missing === 1 ? 'y has' : 'ies have'} no teacher, so they cannot be checked for clashes` }
  if (tt.status === 'Archived') return { tone: 'neutral', label: 'Not checked', title: 'Archived timetables are not checked' }
  if (tt.origin === 'demo') return { tone: 'demo', label: 'Demo data', title: 'Sample schedule. No teacher or room clashes found.' }
  return { tone: 'success', label: 'No clashes', title: 'No teacher or room clashes with your other active timetables' }
}
