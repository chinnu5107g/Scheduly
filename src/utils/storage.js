// Safe localStorage access + sanitising loaders.
// Nothing here throws: private mode, quota errors and corrupted JSON all fall back gracefully.

import { DAYS, TIMETABLE_TYPES, getType } from './timetableTypes.js'
import { STATUSES, makeTimetable, uid } from './timetableModel.js'
import { toMinutes } from './time.js'
import {
  buildSeedConstraints,
  buildSeedResources,
  buildSeedTimetables,
} from './seedData.js'

// Each signed-in account gets its own set of keys (scheduly:v1:u:<id>:...). Guests use the original
// un-prefixed keys. setStorageScope() must be called before the app reads any of them.
let SCOPE = ''
export function setStorageScope(userId) {
  SCOPE = userId ? `u:${userId}:` : ''
}
const scoped = (name) => `scheduly:v1:${SCOPE}${name}`
export const KEYS = {
  get timetables() { return scoped('timetables') },
  get resources() { return scoped('resources') },
  get constraints() { return scoped('constraints') },
  get settings() { return scoped('settings') },
  get ui() { return scoped('ui') },
}
export const DATA_NAMES = ['timetables', 'resources', 'constraints', 'settings', 'ui']

export function readRaw(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Returns { status: 'missing' | 'ok' | 'corrupt', value } */
export function loadJSON(key) {
  const raw = readRaw(key)
  if (raw === null) return { status: 'missing', value: null }
  try {
    return { status: 'ok', value: JSON.parse(raw) }
  } catch {
    try {
      window.localStorage.setItem(`${key}:corrupt-backup`, raw)
    } catch {
      /* ignore */
    }
    return { status: 'corrupt', value: null }
  }
}

/** Returns true when the write succeeded. */
export function saveJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const isTime = (v) => typeof v === 'string' && !Number.isNaN(toMinutes(v))
const SLOT_KEY = /^[A-Z][a-z]{2}\|\d{2}:\d{2}$/

export function sanitizeTimetable(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const type = TIMETABLE_TYPES[raw.type] ? raw.type : 'custom'
  const preset = getType(type)

  const days = Array.isArray(raw.days) ? DAYS.filter((d) => raw.days.includes(d)) : []
  let startTime = isTime(raw.startTime) ? raw.startTime : preset.startTime
  let endTime = isTime(raw.endTime) ? raw.endTime : preset.endTime
  if (toMinutes(endTime) <= toMinutes(startTime)) {
    startTime = preset.startTime
    endTime = preset.endTime
  }
  const slotMinutes =
    Number.isFinite(Number(raw.slotMinutes)) && Number(raw.slotMinutes) >= 5 && Number(raw.slotMinutes) <= 480
      ? Math.round(Number(raw.slotMinutes))
      : preset.slotMinutes

  const breaks = (Array.isArray(raw.breaks) ? raw.breaks : [])
    .filter((b) => b && isTime(b.start) && isTime(b.end) && toMinutes(b.start) < toMinutes(b.end))
    .map((b) => ({ id: str(b.id, 60) || uid('brk'), label: str(b.label, 40) || 'Break', start: b.start, end: b.end }))

  const activities = (Array.isArray(raw.activities) ? raw.activities : [])
    .filter((a) => a && typeof a.name === 'string' && a.name.trim())
    .map((a, i) => ({
      id: str(a.id, 60) || uid('act'),
      name: str(a.name, 60),
      color: /^#[0-9a-fA-F]{6}$/.test(a.color) ? a.color : '#2563EB',
      ...(Number(a.span) > 1 ? { span: Math.min(12, Math.round(Number(a.span))) } : {}),
      ...(typeof a.teacherId === 'string' && a.teacherId ? { teacherId: a.teacherId.slice(0, 80) } : {}),
      ...(Number(a.perWeek) > 0 ? { perWeek: Math.min(20, Math.round(Number(a.perWeek))) } : {}),
      _i: i,
    }))
    .map(({ _i, ...a }) => a)

  const slots = {}
  if (raw.slots && typeof raw.slots === 'object') {
    for (const [k, v] of Object.entries(raw.slots)) {
      if (!SLOT_KEY.test(k) || !v || typeof v !== 'object') continue
      if (typeof v.activityId !== 'string') continue
      const entry = { activityId: v.activityId }
      if (typeof v.note === 'string' && v.note) entry.note = v.note.slice(0, 200)
      if (typeof v.teacherId === 'string' && v.teacherId) entry.teacherId = v.teacherId
      if (typeof v.roomId === 'string' && v.roomId) entry.roomId = v.roomId
      if (Number(v.span) > 1) entry.span = Math.min(12, Math.round(Number(v.span)))
      slots[k] = entry
    }
  }

  const now = Date.now()
  return makeTimetable(
    {
      id: str(raw.id, 80) || uid('tt'),
      name: str(raw.name, 80) || 'Untitled timetable',
      type,
      category: str(raw.category, 80),
      days: days.length ? days : preset.days,
      startTime,
      endTime,
      slotMinutes,
      breaks,
      activities,
      slots,
      trackResources: typeof raw.trackResources === 'boolean' ? raw.trackResources : preset.institutional,
      allowOverlaps: Boolean(raw.allowOverlaps),
      notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 1000) : '',
      status: STATUSES.includes(raw.status) ? raw.status : 'Active',
      origin: ['demo', 'manual', 'assistant'].includes(raw.origin) ? raw.origin : 'manual',
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
      updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
    },
    now,
  )
}

export function sanitizeTimetableList(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const item of list) {
    const tt = sanitizeTimetable(item)
    if (!tt) continue
    if (seen.has(tt.id)) tt.id = uid('tt')
    seen.add(tt.id)
    out.push(tt)
  }
  return out
}

/** First launch -> demo data. Stored but empty list -> stays empty (user deleted everything). */
export function loadTimetables() {
  const res = loadJSON(KEYS.timetables)
  if (res.status === 'ok' && Array.isArray(res.value)) return sanitizeTimetableList(res.value)
  return buildSeedTimetables()
}

function sanitizeNamedList(list, fields) {
  if (!Array.isArray(list)) return []
  return list
    .filter((x) => x && typeof x === 'object' && typeof x.name === 'string' && x.name.trim())
    .map((x) => {
      const out = { id: str(x.id, 80) || uid('res'), name: str(x.name, 80) }
      for (const f of fields) {
        if (f.type === 'number') {
          const n = Number(x[f.key])
          out[f.key] = Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
        } else if (f.type === 'color') {
          out[f.key] = /^#[0-9a-fA-F]{6}$/.test(x[f.key]) ? x[f.key] : '#2563EB'
        } else {
          out[f.key] = str(x[f.key], 160)
        }
      }
      return out
    })
}

export const RESOURCE_FIELDS = {
  subjects: [
    { key: 'category', type: 'text' },
    { key: 'color', type: 'color' },
  ],
  teachers: [
    { key: 'subjects', type: 'text' },
    { key: 'availability', type: 'text' },
  ],
  rooms: [
    { key: 'type', type: 'text' },
    { key: 'capacity', type: 'number' },
  ],
}

export function sanitizeResources(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    subjects: sanitizeNamedList(r.subjects, RESOURCE_FIELDS.subjects),
    teachers: sanitizeNamedList(r.teachers, RESOURCE_FIELDS.teachers),
    rooms: sanitizeNamedList(r.rooms, RESOURCE_FIELDS.rooms),
  }
}

export function loadResources() {
  const res = loadJSON(KEYS.resources)
  if (res.status === 'ok' && res.value && typeof res.value === 'object') return sanitizeResources(res.value)
  return buildSeedResources()
}

const RULE_IDS = ['teacher_clash', 'room_clash', 'class_overlap', 'personal_overlap', 'unavailable', 'custom']

export function sanitizeConstraints(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter((c) => c && typeof c.label === 'string' && c.label.trim())
    .map((c) => ({
      id: str(c.id, 80) || uid('con'),
      rule: RULE_IDS.includes(c.rule) ? c.rule : 'custom',
      label: str(c.label, 200),
      enabled: c.enabled !== false,
    }))
}

export function loadConstraints() {
  const res = loadJSON(KEYS.constraints)
  if (res.status === 'ok' && Array.isArray(res.value)) return sanitizeConstraints(res.value)
  return buildSeedConstraints()
}

export const DEFAULT_SETTINGS = {
  displayName: 'Guest',
  theme: 'light', // 'light' | 'dark' | 'system'
  timeFormat: '12h', // '12h' (AM/PM) | '24h'
  defaultView: 'grid', // 'grid' | 'list'
}

export function loadSettings() {
  const res = loadJSON(KEYS.settings)
  const v = res.status === 'ok' && res.value && typeof res.value === 'object' ? res.value : {}
  return {
    displayName: str(v.displayName, 40) || DEFAULT_SETTINGS.displayName,
    theme: ['light', 'dark', 'system'].includes(v.theme) ? v.theme : DEFAULT_SETTINGS.theme,
    // Settings saved before AM/PM became the default have no `tf2` flag: move them to 12-hour once.
    tf2: true,
    timeFormat: v.tf2 && ['24h', '12h'].includes(v.timeFormat) ? v.timeFormat : DEFAULT_SETTINGS.timeFormat,
    defaultView: ['grid', 'list'].includes(v.defaultView) ? v.defaultView : DEFAULT_SETTINGS.defaultView,
  }
}

export function loadUi() {
  const res = loadJSON(KEYS.ui)
  const v = res.status === 'ok' && res.value && typeof res.value === 'object' ? res.value : {}
  return { sidebarCollapsed: Boolean(v.sidebarCollapsed) }
}

/** Build a full backup object (used by Import / Export). */
export function buildBackup({ timetables, resources, constraints }) {
  return {
    app: 'scheduly',
    version: 1,
    exportedAt: new Date().toISOString(),
    timetables,
    resources,
    constraints,
  }
}

/** Validate and normalise a parsed backup file. Returns { ok, error?, data? }. */
export function parseBackup(value) {
  if (!value || typeof value !== 'object' || value.app !== 'scheduly') {
    return { ok: false, error: 'This file is not a Scheduly backup.' }
  }
  const timetables = sanitizeTimetableList(value.timetables)
  if (!Array.isArray(value.timetables)) return { ok: false, error: 'The backup has no timetables list.' }
  return {
    ok: true,
    data: {
      timetables,
      resources: value.resources ? sanitizeResources(value.resources) : null,
      constraints: Array.isArray(value.constraints) ? sanitizeConstraints(value.constraints) : null,
    },
  }
}
