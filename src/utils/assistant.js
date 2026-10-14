// Scheduly AI — DEMO assistant engine.
//
// This is NOT an AI model. It is a rule-based guided setup plus a small command parser.
// Everything here is pure: `respond(session, text, ctx)` returns the next session and a list of
// "effects" for the UI to apply (add/replace a timetable, enable a constraint). That keeps this
// file free of React and storage, so a real backend can replace `assistantClient.send` later:
//
//   async send(session, text, ctx) {
//     const res = await fetch('/api/assistant', { method: 'POST', body: JSON.stringify({ ... }) })
//     return res.json()   // same shape: { session, effects }
//   }
//
// API keys must live on that server, never in this frontend bundle.

import { DAYS, DAY_NAMES, TIMETABLE_TYPES, TYPE_ORDER, getType } from './timetableTypes.js'
import { formatTime, toMinutes, toTime } from './time.js'
import { generateSchedule, summarizeGeneration } from './generator.js'

// Times are stored as 24h "HH:MM"; the assistant always speaks in AM/PM.
const t12 = (t) => formatTime(t, '12h')
import {
  addPeriods,
  countFilled,
  findActivityByName,
  makeActivities,
  makeTimetable,
  pruneSlots,
  slotKey,
  slotRows,
  sortDays,
  uid,
  workingDaysLabel,
} from './timetableModel.js'

export const QUICK_PROMPTS = [
  'Add a lunch break.',
  'Keep Sunday free.',
  'Give Mathematics more periods.',
  'Avoid teacher clashes.',
  'Change my evening routine.',
]

// ---------------------------------------------------------------- parsing helpers

const DAY_WORD = '(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)'
const DAY_TOKEN = new RegExp(`\\b${DAY_WORD}\\b`, 'gi')
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const clean = (s) => s.trim().replace(/[.!?]+$/g, '').trim()

export function parseDays(text) {
  const t = text.toLowerCase()
  if (/\b(all week|every ?day|daily|7 days|seven days|whole week)\b/.test(t)) return [...DAYS]
  if (/\bweekdays?\b|\bworking days\b/.test(t)) return DAYS.slice(0, 5)
  if (/\bweekends?\b/.test(t)) return DAYS.slice(5)

  const short = (w) => capitalise(w.slice(0, 3))
  const range = new RegExp(`\\b${DAY_WORD}\\s*(?:-|–|to|through|till|until)\\s*${DAY_WORD}\\b`).exec(t)
  if (range) {
    const a = DAYS.indexOf(short(range[1]))
    const b = DAYS.indexOf(short(range[2]))
    const out = []
    for (let i = a; ; i = (i + 1) % 7) {
      out.push(DAYS[i])
      if (i === b) break
      if (out.length > 7) break
    }
    return sortDays(out)
  }
  const found = [...t.matchAll(DAY_TOKEN)].map((m) => short(m[1]))
  return found.length ? sortDays([...new Set(found)]) : null
}

function resolveRange(a, b) {
  const mk = (tok, mer) => {
    let h = tok.h
    if (h > 12) mer = null
    if (mer === 'pm' && h < 12) h += 12
    if (mer === 'am' && h === 12) h = 0
    return h * 60 + tok.m
  }
  let s
  let e
  if (a.mer && b.mer) {
    s = mk(a, a.mer)
    e = mk(b, b.mer)
  } else if (!a.mer && b.mer) {
    e = mk(b, b.mer)
    s = mk(a, b.mer)
    if (s >= e) s = mk(a, b.mer === 'pm' ? 'am' : 'pm')
  } else if (a.mer && !b.mer) {
    s = mk(a, a.mer)
    e = mk(b, a.mer)
    if (e <= s) e = mk(b, 'pm')
  } else {
    s = mk(a, null)
    e = mk(b, null)
    // "1 to 2" (no colons, no am/pm) almost always means the afternoon.
    if (!a.colon && !b.colon && a.h >= 1 && a.h <= 5 && b.h <= 12 && e > s) {
      s += 12 * 60
      e += 12 * 60
    } else if (e <= s && b.h < 12) e += 12 * 60
  }
  return { s, e }
}

/** "9 to 5", "09:00-17:00", "8:30am to 2pm" -> { startTime, endTime, span: [from, to] } or null */
export function parseTimeRange(text) {
  const re = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?![\d:])/gi
  const toks = []
  let m
  while ((m = re.exec(text)) !== null) {
    const h = Number(m[1])
    const mi = m[2] ? Number(m[2]) : 0
    if (h > 24 || mi > 59) continue
    toks.push({
      h,
      m: mi,
      mer: m[3] ? m[3].toLowerCase() : null,
      colon: Boolean(m[2]),
      index: m.index,
      end: m.index + m[0].length,
    })
  }
  if (toks.length < 2) return null
  const { s, e } = resolveRange(toks[0], toks[1])
  if (!(e > s) || e > 24 * 60) return null
  return { startTime: toTime(s), endTime: toTime(e), span: [toks[0].index, toks[1].end] }
}

function parseSlotMinutes(text, fallback) {
  const t = text.toLowerCase()
  if (/\b(default|suggest|recommended|usual)\b/.test(t)) return fallback
  const m = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)?\b/.exec(t)
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2] || ''
  const minutes = /^h/.test(unit) ? Math.round(n * 60) : Math.round(n)
  return minutes >= 15 && minutes <= 240 ? minutes : null
}

function parseType(text) {
  const t = text.toLowerCase()
  if (/\bschool\b/.test(t)) return 'school'
  if (/\b(college|university|semester|lecture)\b/.test(t)) return 'college'
  if (/\b(study|exam|revision|prepar)/.test(t)) return 'study'
  if (/\b(personal|daily|routine|habit|life)\b/.test(t)) return 'personal'
  if (/\b(work|job|office|shift|team)\b/.test(t)) return 'work'
  if (/\b(custom|other|blank|something else)\b/.test(t)) return 'custom'
  const byNumber = /^\s*([1-6])\s*[.)]?\s*$/.exec(t)
  if (byNumber) return TYPE_ORDER[Number(byNumber[1]) - 1]
  return null
}

function parseNames(text) {
  const delimiter = /[,;\n]/.test(text) ? /[,;\n]/ : /\s+and\s+/i
  const parts = text
    .split(delimiter)
    .map((p) => clean(p))
    .filter(Boolean)
    .map((p) => p.slice(0, 60))
  return [...new Set(parts.map((p) => capitalise(p)))].slice(0, 30)
}

function parseBreaks(text, start, end) {
  const out = []
  for (const part of text.split(/[;\n]|,(?=\s*[a-z])/i)) {
    const piece = part.trim()
    if (!piece) continue
    const range = parseTimeRange(piece)
    if (!range) return { error: `I couldn't find a time range in “${piece}”. Try “Lunch 12:00-13:00”.` }
    const label = clean(piece.slice(0, range.span[0]) + ' ' + piece.slice(range.span[1])).replace(/\b(at|from|between)\b/gi, '').trim()
    let s = toMinutes(range.startTime)
    let e = toMinutes(range.endTime)
    // "Tea 4:30-4:45" without am/pm: if it only fits in the afternoon, read it that way.
    if ((s < start || e > end) && !/[ap]m/i.test(piece) && s + 720 >= start && e + 720 <= end) {
      s += 720
      e += 720
      range.startTime = toTime(s)
      range.endTime = toTime(e)
    }
    if (s < start || e > end) {
      return { error: `“${piece}” falls outside ${t12(toTime(start))}–${t12(toTime(end))}. Pick a break inside your day.` }
    }
    out.push({ id: uid('brk'), label: capitalise(label || 'Break').slice(0, 40), start: range.startTime, end: range.endTime })
  }
  const sorted = [...out].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].end)) {
      return { error: 'Two of those breaks overlap. Please adjust the times.' }
    }
  }
  return { value: sorted }
}

// ---------------------------------------------------------------- messages

function msg(role, text, options) {
  const m = { id: uid('m'), role, text }
  if (options && options.length) m.options = options
  return m
}
const say = (text, options) => msg('assistant', text, options)
const opt = (label, value) => ({ label, value: value ?? label })

const HELP_TEXT =
  'I’m a demo assistant — no AI model is connected yet. I follow a guided setup and understand a few commands:\n\n' +
  '• “Create a new timetable” – guided setup, one question at a time\n' +
  '• “Add a lunch break” (or “add a break 15:00-15:15”)\n' +
  '• “Keep Sunday free” / “Add Saturday”\n' +
  '• “Give Mathematics more periods”\n' +
  '• “Change my evening routine”\n' +
  '• “Fill the empty slots” – simple draft, not an optimised schedule\n' +
  '• “Avoid teacher clashes” – makes sure teacher-clash checking is switched on\n' +
  '• “Rename to <name>” · “Clear the timetable”'

export function createSession(targetId = null) {
  return {
    messages: [
      say(
        'Hi, I’m Scheduly AI. This is a demo assistant: I can walk you through creating a timetable and handle a few edit commands, but there’s no AI model behind me yet.',
        [opt('Create a new timetable', 'create a new timetable'), opt('What can you do?', 'help')],
      ),
    ],
    flow: null,
    pending: null,
    targetId,
  }
}

// ---------------------------------------------------------------- guided flow

function flowSteps(type) {
  const steps = ['type', 'name', 'days', 'times', 'activities', 'slot', 'breaks']
  if (getType(type).institutional) steps.push('resources')
  steps.push('constraints', 'confirm')
  return steps
}

function nextStep(flow) {
  const steps = flowSteps(flow.draft.type)
  const i = steps.indexOf(flow.step)
  return steps[Math.min(i + 1, steps.length - 1)]
}

function askStep(step, draft) {
  const preset = getType(draft.type || 'custom')
  switch (step) {
    case 'type':
      return say(
        'What type of timetable do you want?',
        TYPE_ORDER.map((id) => opt(TIMETABLE_TYPES[id].label, TIMETABLE_TYPES[id].label)),
      )
    case 'name':
      return say(
        `What is your timetable name?${preset.categoryPlaceholder ? ` (${preset.categoryPlaceholder})` : ''}`,
      )
    case 'days':
      return say(
        'Which days should it cover? You can say “weekdays”, “Mon to Sat”, “Mon, Wed, Fri” or “every day”.',
        [opt('Weekdays', 'weekdays'), opt('Mon to Sat', 'mon to sat'), opt('Every day', 'every day')],
      )
    case 'times':
      return say(
        `What are your start and end times? For example “${t12(preset.startTime)} to ${t12(preset.endTime)}” or “9am to 5pm”.`,
        [opt(`${t12(preset.startTime)} to ${t12(preset.endTime)}`)],
      )
    case 'activities': {
      const sug = preset.suggestions
      const base = preset.institutional
        ? 'Which subjects should be included? Separate them with commas.'
        : 'Which activities should be included? Separate them with commas.'
      return say(
        base + (sug.length ? `\nSuggestions: ${sug.join(', ')}.` : ''),
        sug.length ? [opt('Use suggestions', 'use suggestions')] : [],
      )
    }
    case 'slot':
      return say(
        `How long should each time slot be? (default for this type: ${preset.slotMinutes} minutes)`,
        [opt('Default', 'default'), opt('30 minutes'), opt('45 minutes'), opt('1 hour'), opt('90 minutes')],
      )
    case 'breaks': {
      const d = preset.breaks.map((b) => `${b.label} ${t12(b.start)}-${t12(b.end)}`).join(', ')
      return say(
        `When should breaks occur? Give a label and a time, e.g. “Lunch 12:00-13:00, Tea 15:30-15:45”, or say “none”.${
          d ? `\nDefault for this type: ${d}.` : ''
        }`,
        [...(d ? [opt('Use default breaks', 'default')] : []), opt('No breaks', 'none')],
      )
    }
    case 'resources':
      return say('Do you want to track teachers and rooms for each period?', [opt('Yes'), opt('No')])
    case 'constraints':
      return say(
        'Are there any additional constraints? For example “no Maths in the last period”. Say “none” to skip. I will save these as notes — I can’t enforce them yet.',
        [opt('None', 'none')],
      )
    case 'confirm':
      return say(summaryText(draft), [
        opt('Create & auto-fill a draft', 'create and fill'),
        opt('Create blank grid', 'create blank'),
        opt('Start over', 'start over'),
      ])
    default:
      return say('Okay.')
  }
}

function summaryText(d) {
  const t = getType(d.type)
  const lines = [
    'Here’s what I have:',
    `• Type: ${t.label}`,
    `• Name: ${d.name}`,
    `• Days: ${workingDaysLabel(d.days)}`,
    `• Time: ${t12(d.startTime)}–${t12(d.endTime)}, ${d.slotMinutes}-minute slots`,
    `• Breaks: ${d.breaks.length ? d.breaks.map((b) => `${b.label} ${t12(b.start)}–${t12(b.end)}`).join(', ') : 'none'}`,
    `• Includes: ${d.activityNames.join(', ')}`,
  ]
  if (t.institutional) lines.push(`• Teachers & rooms: ${d.trackResources ? 'tracked' : 'not tracked'}`)
  if (d.notes) lines.push(`• Notes: ${d.notes}`)
  lines.push(
    '',
    'Auto-fill uses a simple rotation of your activities. It’s a starting draft with no teachers assigned, so add teachers to get clash checking.',
  )
  return lines.join('\n')
}

function applyAnswer(flow, input) {
  const draft = { ...flow.draft }
  const text = input.trim()
  switch (flow.step) {
    case 'type': {
      const type = parseType(text)
      if (!type) return { error: 'I didn’t catch the type. Pick one of the options, or type school, college, personal, study, work or custom.' }
      const p = getType(type)
      return {
        draft: {
          ...draft,
          type,
          days: p.days,
          startTime: p.startTime,
          endTime: p.endTime,
          slotMinutes: p.slotMinutes,
          breaks: p.breaks.map((b) => ({ ...b, id: uid('brk') })),
          trackResources: p.institutional,
          allowOverlaps: false,
        },
      }
    }
    case 'name': {
      if (text.length < 2) return { error: 'Please give the timetable a name (at least 2 characters).' }
      return { draft: { ...draft, name: text.slice(0, 80) } }
    }
    case 'days': {
      const days = parseDays(text)
      if (!days || !days.length) return { error: 'I couldn’t read those days. Try “weekdays”, “Mon to Sat” or “Mon, Wed, Fri”.' }
      return { draft: { ...draft, days } }
    }
    case 'times': {
      const r = parseTimeRange(text)
      if (!r) return { error: 'I couldn’t read that time range. Try “09:00 to 17:00” or “9am to 5pm”.' }
      if (toMinutes(r.endTime) - toMinutes(r.startTime) < 30) return { error: 'The day needs to be at least 30 minutes long.' }
      return { draft: { ...draft, startTime: r.startTime, endTime: r.endTime } }
    }
    case 'activities': {
      const p = getType(draft.type)
      if (/^(skip|suggest|use suggestions?|suggestions?|default|yes)$/i.test(clean(text))) {
        if (!p.suggestions.length) return { error: 'This type has no suggestions — please list at least one activity.' }
        return { draft: { ...draft, activityNames: [...p.suggestions] } }
      }
      const names = parseNames(text)
      if (!names.length) return { error: 'Please list at least one subject or activity, separated by commas.' }
      return { draft: { ...draft, activityNames: names } }
    }
    case 'slot': {
      const p = getType(draft.type)
      const mins = parseSlotMinutes(text, p.slotMinutes)
      if (!mins) return { error: 'Slots can be 15 to 240 minutes. Try “45 minutes” or “1 hour”.' }
      if (mins > toMinutes(draft.endTime) - toMinutes(draft.startTime)) return { error: 'That slot is longer than the whole day. Try something shorter.' }
      return { draft: { ...draft, slotMinutes: mins } }
    }
    case 'breaks': {
      const p = getType(draft.type)
      const t = clean(text).toLowerCase()
      if (/^(none|no|no breaks?|skip|nothing)$/.test(t)) return { draft: { ...draft, breaks: [] } }
      if (/^(default|use default( breaks)?)$/.test(t)) {
        const start = toMinutes(draft.startTime)
        const end = toMinutes(draft.endTime)
        const fit = p.breaks.filter((b) => toMinutes(b.start) >= start && toMinutes(b.end) <= end)
        return { draft: { ...draft, breaks: fit.map((b) => ({ ...b, id: uid('brk') })) } }
      }
      const r = parseBreaks(text, toMinutes(draft.startTime), toMinutes(draft.endTime))
      if (r.error) return { error: r.error }
      return { draft: { ...draft, breaks: r.value } }
    }
    case 'resources': {
      if (/^(y|yes|yeah|yep|sure|ok|okay|track)/i.test(text)) return { draft: { ...draft, trackResources: true } }
      if (/^(n|no|nope|skip|don'?t)/i.test(text)) return { draft: { ...draft, trackResources: false } }
      return { error: 'Please answer yes or no.' }
    }
    case 'constraints': {
      const t = clean(text).toLowerCase()
      if (/^(none|no|nothing|skip|n\/a)$/.test(t)) return { draft: { ...draft, notes: '' } }
      return { draft: { ...draft, notes: text.slice(0, 500) } }
    }
    default:
      return { draft }
  }
}

function buildFromDraft(draft, fill, now, ctx) {
  let tt = makeTimetable(
    {
      id: uid('tt'),
      name: draft.name,
      type: draft.type,
      category: getType(draft.type).defaultCategory,
      days: draft.days,
      startTime: draft.startTime,
      endTime: draft.endTime,
      slotMinutes: draft.slotMinutes,
      breaks: draft.breaks,
      activities: makeActivities(draft.activityNames),
      trackResources: draft.trackResources,
      allowOverlaps: draft.allowOverlaps,
      notes: draft.notes,
      status: 'Draft',
      origin: 'assistant',
      createdAt: now,
      updatedAt: now,
    },
    now,
  )
  let filled = 0
  let summary = ''
  if (fill) {
    const res = generateSchedule(tt, { timetables: ctx?.timetables || [], constraints: ctx?.constraints || [], resources: ctx?.resources, mode: 'replace' })
    tt = res.tt
    filled = res.filled
    summary = summarizeGeneration(res)
  }
  return { tt, filled, summary }
}

function stepFlow(session, text, ctx) {
  const flow = session.flow
  const lower = clean(text).toLowerCase()

  if (flow.step === 'confirm') {
    if (/(start over|restart|cancel|no\b)/.test(lower)) return restart(session)
    if (/\b(create|yes|confirm|go|do it|ok|okay|fill|blank|empty)\b/.test(lower)) {
      const fill = /\bfill|draft|auto/.test(lower) && !/\b(blank|empty)\b/.test(lower)
      const { tt, filled, summary } = buildFromDraft(flow.draft, fill, ctx.now, ctx)
      const reply = say(
        fill
          ? `Created “${tt.name}” and built the schedule automatically. ${summary || `${filled} slots filled.`} It’s saved as a draft: open it to adjust durations, teachers or any single slot.`
          : `Created “${tt.name}” as an empty grid. Open it and click any cell to add activities, or tell me “fill the empty slots”.`,
        [{ label: 'Open timetable', action: { type: 'open', id: tt.id } }],
      )
      return {
        session: { ...session, flow: null, targetId: tt.id, messages: [...session.messages, reply] },
        effects: [{ type: 'add', timetable: tt }],
      }
    }
    return {
      session: { ...session, messages: [...session.messages, say('Please choose: create & auto-fill, create a blank grid, or start over.')] },
      effects: [],
    }
  }

  const res = applyAnswer(flow, text)
  if (res.error) {
    return { session: { ...session, messages: [...session.messages, say(res.error)] }, effects: [] }
  }
  const draft = res.draft
  const step = nextStep({ ...flow, draft })
  const newFlow = { step, draft }
  return {
    session: { ...session, flow: newFlow, messages: [...session.messages, askStep(step, draft)] },
    effects: [],
  }
}

function startFlow(session) {
  const flow = { step: 'type', draft: {} }
  return {
    session: {
      ...session,
      flow,
      pending: null,
      messages: [
        ...session.messages,
        say('Great, let’s set it up — one question at a time. You can type “cancel” whenever you want to stop.'),
        askStep('type', {}),
      ],
    },
    effects: [],
  }
}

function restart(session) {
  return {
    session: {
      ...session,
      flow: null,
      pending: null,
      messages: [...session.messages, say('No problem, I’ve stopped that setup. Nothing was created.', [opt('Create a new timetable', 'create a new timetable')])],
    },
    effects: [],
  }
}

// ---------------------------------------------------------------- commands

function getTarget(session, ctx) {
  return ctx.timetables.find((t) => t.id === session.targetId) || null
}

const reply = (session, text, options, extra = {}) => ({
  session: { ...session, ...extra, messages: [...session.messages, say(text, options)] },
  effects: extra.effects || [],
})

function withEffects(r, effects) {
  return { ...r, effects }
}

function touch(tt, now) {
  return { ...tt, updatedAt: now }
}

function findFreeBreakWindow(tt, preferred) {
  const start = toMinutes(tt.startTime)
  const end = toMinutes(tt.endTime)
  const taken = tt.breaks.map((b) => [toMinutes(b.start), toMinutes(b.end)])
  const free = (s, e) => s >= start && e <= end && taken.every(([a, b]) => e <= a || s >= b)
  for (const [s, e] of preferred) if (free(s, e)) return [s, e]
  return null
}

function cmdAddBreak(session, ctx, text) {
  const tt = getTarget(session, ctx)
  if (!tt) return null
  const lower = text.toLowerCase()
  const isLunch = /\blunch\b/.test(lower)
  let label = 'Break'
  if (isLunch) label = 'Lunch'
  else {
    const m = /\b([a-z]+)\s+break\b/.exec(lower)
    if (m && !['a', 'an', 'the', 'short', 'new', 'another', 'quick', 'small'].includes(m[1])) label = `${capitalise(m[1])} break`
  }
  const existingLunch = isLunch ? tt.breaks.find((b) => /lunch/i.test(b.label)) : null
  if (existingLunch) {
    return reply(session, `“${tt.name}” already has a lunch break (${t12(existingLunch.start)}–${t12(existingLunch.end)}).`)
  }

  let window = null
  const explicit = parseTimeRange(text)
  if (explicit) {
    window = findFreeBreakWindow(tt, [[toMinutes(explicit.startTime), toMinutes(explicit.endTime)]])
    if (!window) return reply(session, `I can’t fit a break at ${t12(explicit.startTime)}–${t12(explicit.endTime)} in “${tt.name}” (${t12(tt.startTime)}–${t12(tt.endTime)}, and it can’t overlap another break).`)
  } else {
    const rows = slotRows(tt)
    const prefs = isLunch
      ? [[780, 840], [720, 780], [750, 810], [690, 750]]
      : []
    if (!isLunch && rows.length > 2) {
      const r = rows[Math.max(0, Math.floor(rows.length / 3) - 1)]
      const s = toMinutes(r.end)
      prefs.push([s, s + 15], [s, s + 10])
    }
    window = findFreeBreakWindow(tt, prefs)
    if (!window && isLunch && rows.length > 2) {
      const mid = rows[Math.floor(rows.length / 2)]
      window = findFreeBreakWindow(tt, [[toMinutes(mid.start), toMinutes(mid.end)]])
    }
    if (!window) return reply(session, 'I couldn’t find a free spot for that break. Tell me a time, e.g. “add a break 15:00-15:15”.')
  }
  const before = countFilled(tt)
  const next = pruneSlots({
    ...tt,
    breaks: [...tt.breaks, { id: uid('brk'), label, start: toTime(window[0]), end: toTime(window[1]) }],
  })
  const removed = before - countFilled(next)
  return withEffects(
    reply(
      session,
      `Added ${label} ${t12(toTime(window[0]))}–${t12(toTime(window[1]))} to “${tt.name}”.${removed ? ` ${removed} scheduled slot${removed === 1 ? '' : 's'} in that window were removed.` : ''}`,
    ),
    [{ type: 'replace', timetable: touch(next, ctx.now) }],
  )
}

function cmdRemoveBreak(session, ctx, text) {
  const tt = getTarget(session, ctx)
  if (!tt) return null
  const lower = text.toLowerCase()
  const keyword = (b) => b.label.toLowerCase().replace(/\bbreak\b/, '').trim()
  let matches = tt.breaks.filter((b) => keyword(b) && lower.includes(keyword(b)))
  if (!matches.length) {
    const plain = tt.breaks.filter((b) => !keyword(b))
    if (plain.length === 1 && /\b(the|a|my)\s+break\b/.test(lower)) matches = plain
  }
  if (!tt.breaks.length) return reply(session, `“${tt.name}” has no breaks.`)
  if (!matches.length) return reply(session, `Which break? “${tt.name}” has: ${tt.breaks.map((b) => b.label).join(', ')}.`)
  const next = { ...tt, breaks: tt.breaks.filter((b) => !matches.includes(b)) }
  return withEffects(reply(session, `Removed ${matches.map((b) => b.label).join(', ')} from “${tt.name}”.`), [
    { type: 'replace', timetable: touch(next, ctx.now) },
  ])
}

function cmdDays(session, ctx, text, mode) {
  const tt = getTarget(session, ctx)
  if (!tt) return null
  const days = parseDays(text)
  if (!days) return null
  if (mode === 'free') {
    const toRemove = days.filter((d) => tt.days.includes(d))
    if (!toRemove.length) return reply(session, `${days.map((d) => DAY_NAMES[d]).join(' and ')} ${days.length > 1 ? 'are' : 'is'} already free in “${tt.name}”.`)
    const remaining = tt.days.filter((d) => !toRemove.includes(d))
    if (!remaining.length) return reply(session, 'That would leave the timetable with no days. Keep at least one day.')
    const before = countFilled(tt)
    const next = pruneSlots({ ...tt, days: remaining })
    const removed = before - countFilled(next)
    return withEffects(
      reply(
        session,
        `Done — ${toRemove.map((d) => DAY_NAMES[d]).join(' and ')} ${toRemove.length > 1 ? 'are' : 'is'} now free in “${tt.name}”. It runs ${workingDaysLabel(remaining)}.${removed ? ` ${removed} scheduled slot${removed === 1 ? '' : 's'} were removed.` : ''}`,
      ),
      [{ type: 'replace', timetable: touch(next, ctx.now) }],
    )
  }
  const toAdd = days.filter((d) => !tt.days.includes(d))
  if (!toAdd.length) return reply(session, `${days.map((d) => DAY_NAMES[d]).join(' and ')} already ${days.length > 1 ? 'appear' : 'appears'} in “${tt.name}”.`)
  const next = { ...tt, days: sortDays([...tt.days, ...toAdd]) }
  return withEffects(
    reply(session, `Added ${toAdd.map((d) => DAY_NAMES[d]).join(' and ')} to “${tt.name}”. The new day${toAdd.length > 1 ? 's are' : ' is'} empty.`),
    [{ type: 'replace', timetable: touch(next, ctx.now) }],
  )
}

function cmdMorePeriods(session, ctx, text) {
  const tt = getTarget(session, ctx)
  if (!tt) return null
  const lower = text.toLowerCase()
  const candidates = [...tt.activities].sort((a, b) => b.name.length - a.name.length)
  let act = candidates.find((a) => lower.includes(a.name.toLowerCase()))
  if (!act) {
    const m = /(?:give|add|more|extra|increase)\s+(?:the\s+)?([a-z][a-z &]*?)\s+(?:more|extra|additional|periods|sessions|time|slots|hours)/.exec(lower)
    if (m) act = findActivityByName(tt, m[1]) || undefined
  }
  if (!act) {
    return reply(
      session,
      `I couldn’t match that to an activity in “${tt.name}”. It has: ${tt.activities.map((a) => a.name).join(', ') || 'no activities yet'}.`,
    )
  }
  const n = /(\d+)/.exec(lower)
  const count = Math.min(10, Math.max(1, n ? Number(n[1]) : 2))
  if (!countFilled(tt)) return reply(session, `“${tt.name}” has no scheduled slots yet. Say “fill the empty slots” first, then I can add more ${act.name}.`)
  const res = addPeriods(tt, act.id, count)
  if (!res.added) return reply(session, `I couldn’t find room for more ${act.name} in “${tt.name}”.`)
  return withEffects(
    reply(
      session,
      `Added ${res.added} more ${act.name} period${res.added === 1 ? '' : 's'} to “${tt.name}”${res.replaced ? ` (${res.replaced} replaced slots from your busiest other activity)` : ' using empty slots'}.  The new slots have no teacher yet, so they aren’t clash-checked until you add one.`,
    ),
    [{ type: 'replace', timetable: touch(res.tt, ctx.now) }],
  )
}

function cmdClashRule(session, ctx, text) {
  const lower = text.toLowerCase()
  let rule = 'teacher_clash'
  let label = 'A teacher cannot be in two classes at the same time'
  if (/room|classroom/.test(lower) && !/teacher/.test(lower)) {
    rule = 'room_clash'
    label = 'A room cannot host two classes at the same time'
  } else if (!/teacher/.test(lower)) {
    const tt = getTarget(session, ctx)
    const personal = tt && !getType(tt.type).institutional
    rule = personal ? 'personal_overlap' : 'class_overlap'
    label = personal
      ? 'Personal activities cannot overlap unless explicitly allowed'
      : 'A class cannot have overlapping subjects'
  }
  const existing = ctx.constraints.find((c) => c.rule === rule)
  const builtIn = rule === 'class_overlap' || rule === 'personal_overlap'
  if (builtIn) {
    return reply(session, 'That one is built into the timetable grid: two subjects can never overlap in the same timetable, and nothing can be placed in a break. You don’t need to switch anything on.')
  }
  const what = rule === 'room_clash' ? 'a room' : 'a teacher'
  if (existing && existing.enabled !== false) {
    return reply(session, `Already on. Scheduly won’t let ${what} be booked twice at the same time across your active timetables. Slots only count once they have ${rule === 'room_clash' ? 'a room' : 'a teacher'} assigned.`)
  }
  return withEffects(
    reply(session, `Done. I’ve switched that rule on: Scheduly now blocks ${what} being booked twice at the same time across your active timetables.`),
    [{ type: 'constraint', rule, label }],
  )
}

const PERIODS = {
  morning: [0, 12 * 60, 'morning'],
  afternoon: [12 * 60, 17 * 60, 'afternoon'],
  evening: [17 * 60, 24 * 60, 'evening'],
}

function cmdChangePeriod(session, ctx, text) {
  const tt = getTarget(session, ctx)
  if (!tt) return null
  const key = /evening|night/i.test(text) ? 'evening' : /afternoon/i.test(text) ? 'afternoon' : 'morning'
  const [from, to, name] = PERIODS[key]
  const rows = slotRows(tt).filter((r) => toMinutes(r.start) >= from && toMinutes(r.start) < to)
  if (!rows.length) return reply(session, `“${tt.name}” (${t12(tt.startTime)}–${t12(tt.endTime)}) has no ${name} slots to change.`)
  return reply(
    { ...session },
    `What should your ${name} look like in “${tt.name}”? List the activities separated by commas (they’ll rotate across ${name} slots), or say “clear” to empty them.`,
    undefined,
    { pending: { kind: 'period', key } },
  )
}

function handlePending(session, ctx, text) {
  const p = session.pending
  const lower = clean(text).toLowerCase()
  const tt = getTarget(session, ctx)
  if (/^(cancel|never ?mind|stop|no)$/.test(lower) || !tt) {
    return reply(session, 'Okay, I’ve left it as it is.', undefined, { pending: null })
  }
  if (p.kind === 'clear') {
    if (/^(y|yes|confirm|ok|okay|do it|sure)/.test(lower)) {
      return withEffects(
        reply(session, `Cleared every slot in “${tt.name}”. Your days, times and breaks are unchanged.`, undefined, { pending: null }),
        [{ type: 'replace', timetable: touch({ ...tt, slots: {} }, ctx.now) }],
      )
    }
    return reply(session, 'Okay, nothing was cleared.', undefined, { pending: null })
  }
  if (p.kind === 'period') {
    const [from, to, name] = PERIODS[p.key]
    const rows = slotRows(tt).filter((r) => toMinutes(r.start) >= from && toMinutes(r.start) < to)
    const slots = { ...tt.slots }
    if (/^clear\b/.test(lower)) {
      for (const d of tt.days) for (const r of rows) delete slots[slotKey(d, r.start)]
      return withEffects(
        reply(session, `Cleared the ${name} slots in “${tt.name}”.`, undefined, { pending: null }),
        [{ type: 'replace', timetable: touch({ ...tt, slots }, ctx.now) }],
      )
    }
    const names = parseNames(text)
    if (!names.length) return reply(session, 'Please list at least one activity, or say “clear”.')
    const activities = makeActivities(names, tt.activities)
    const ids = names.map((n) => activities.find((a) => a.name.toLowerCase() === n.toLowerCase()).id)
    tt.days.forEach((d, di) => {
      rows.forEach((r, ri) => {
        slots[slotKey(d, r.start)] = { activityId: ids[(ri + di) % ids.length] }
      })
    })
    return withEffects(
      reply(session, `Updated the ${name} in “${tt.name}” with ${names.join(', ')}. These slots have no teachers yet, so they aren’t clash-checked until you add one.`, undefined, { pending: null }),
      [{ type: 'replace', timetable: touch({ ...tt, activities, slots }, ctx.now) }],
    )
  }
  return reply(session, 'Okay.', undefined, { pending: null })
}

const NO_TARGET =
  'I need a timetable to work on first. Choose one from the “Working on” menu above, or say “create a new timetable”.'

/** Returns a result or null when the text is not a recognised command. */
function runCommand(session, ctx, rawText) {
  const text = clean(rawText)
  const lower = text.toLowerCase()
  const needTarget = (fn) => {
    if (!getTarget(session, ctx)) return reply(session, NO_TARGET)
    return fn() || reply(session, NO_TARGET)
  }

  if (/^(help|\?|what can you do|commands)$/.test(lower) || /what can (you|i) (do|say)/.test(lower)) {
    return reply(session, HELP_TEXT)
  }
  if (/\b(new|create|build|make|start|set up|setup)\b.*\b(timetable|schedule|routine|plan)\b/.test(lower) || /^(guided setup|start over)$/.test(lower)) {
    return startFlow(session)
  }
  if (/\b(remove|delete|drop)\b.*\bbreak\b/.test(lower)) return needTarget(() => cmdRemoveBreak(session, ctx, text))
  if (/\b(add|insert|put|include|schedule|need|want)\b.*\b(lunch|break)\b/.test(lower)) return needTarget(() => cmdAddBreak(session, ctx, text))
  if (/\b(avoid|prevent|stop|no|without)\b.*\b(teacher|room|classroom|class|clash|clashes|conflicts?|double.?book)/.test(lower) && /(clash|conflict|double|overlap)/.test(lower)) {
    return cmdClashRule(session, ctx, text)
  }
  if (/\b(change|update|redo|plan|set|adjust)\b.*\b(morning|afternoon|evening|night)\b/.test(lower)) return needTarget(() => cmdChangePeriod(session, ctx, text))
  if (/\b(free|off|empty|rest)\b/.test(lower) && parseDays(text) && /\b(keep|make|leave|set|have|want)\b|\bfree\b|\bday off\b/.test(lower)) {
    return needTarget(() => cmdDays(session, ctx, text, 'free'))
  }
  if (/\b(add|include|enable|open|also)\b/.test(lower) && parseDays(text) && !/\bbreak\b/.test(lower)) {
    return needTarget(() => cmdDays(session, ctx, text, 'add'))
  }
  if (/\b(more|extra|additional|increase)\b/.test(lower) && /\b(periods?|sessions?|slots?|hours?|time|classes)\b|\bgive\b/.test(lower)) {
    return needTarget(() => cmdMorePeriods(session, ctx, text))
  }
  if (/\b(fill|auto.?fill|generate|populate|draft)\b/.test(lower)) {
    const tt = getTarget(session, ctx)
    if (!tt) return reply(session, NO_TARGET)
    if (!tt.activities.length) return reply(session, `“${tt.name}” has no activities yet, so there’s nothing to fill with. Click a cell to add some first.`)
    const res = generateSchedule(tt, { timetables: ctx.timetables, constraints: ctx.constraints, resources: ctx.resources, mode: 'fill' })
    if (!res.filled) return reply(session, `“${tt.name}” has no empty slots to fill.${res.unplaced.length ? ' ' + summarizeGeneration(res) : ''}`)
    return withEffects(
      reply(session, `Built the empty part of “${tt.name}”. ${summarizeGeneration(res)}`),
      [{ type: 'replace', timetable: touch(res.tt, ctx.now) }],
    )
  }
  if (/^clear\b|\b(clear|empty|wipe|reset)\b.*\b(timetable|schedule|everything|all|grid)\b/.test(lower)) {
    const tt = getTarget(session, ctx)
    if (!tt) return reply(session, NO_TARGET)
    return reply(session, `This removes every scheduled slot from “${tt.name}”. Type “yes” to confirm.`, [opt('Yes, clear it', 'yes'), opt('Cancel', 'cancel')], {
      pending: { kind: 'clear' },
    })
  }
  const rename = /^rename\b.*?\b(?:to|as)\s+(.+)$/i.exec(text)
  if (rename) {
    const tt = getTarget(session, ctx)
    if (!tt) return reply(session, NO_TARGET)
    const name = rename[1].trim().replace(/^["“”']|["“”']$/g, '').slice(0, 80)
    if (name.length < 2) return reply(session, 'Please give a name of at least 2 characters.')
    return withEffects(reply(session, `Renamed “${tt.name}” to “${name}”.`), [{ type: 'replace', timetable: touch({ ...tt, name }, ctx.now) }])
  }
  return null
}

const FLOW_TEXT_STEPS = ['name', 'activities', 'breaks', 'constraints']

/**
 * Main entry point. `ctx` = { timetables, constraints, now }.
 * Returns { session, effects }.
 */
export function respond(session, text, ctx) {
  const input = String(text || '').trim()
  if (!input) return { session, effects: [] }
  const withUser = { ...session, messages: [...session.messages, msg('user', input)] }
  const lower = clean(input).toLowerCase()

  if (/^(cancel|stop|never ?mind|quit|exit)$/.test(lower)) {
    if (withUser.flow) return restart({ ...withUser, flow: null })
    if (withUser.pending) return reply(withUser, 'Okay, I’ve left it as it is.', undefined, { pending: null })
  }
  if (/^start over$/.test(lower) && withUser.flow) return startFlow({ ...withUser, flow: null })

  if (withUser.pending) return handlePending(withUser, ctx, input)

  if (withUser.flow) {
    const step = withUser.flow.step
    const isHelp = /^(help|\?)$/.test(lower)
    // Commands still work mid-setup, except where the answer is free text (or a confirmation).
    const answersConfirm = /\b(create|confirm|blank|yes|ok|okay|go ahead|restart|start over|cancel|no)\b/.test(lower)
    const canIntercept =
      isHelp ||
      (!FLOW_TEXT_STEPS.includes(step) &&
        (step !== 'confirm' || !answersConfirm) &&
        (step !== 'type' || !parseType(input)))
    if (canIntercept) {
      const cmd = runCommand({ ...withUser, flow: null }, ctx, input)
      if (cmd) {
        // "create a new timetable" restarts the setup; any other command runs and we re-ask the question.
        if (cmd.session.flow) return cmd
        return {
          session: {
            ...cmd.session,
            flow: withUser.flow,
            messages: [...cmd.session.messages, say('Back to your setup:'), askStep(step, withUser.flow.draft)],
          },
          effects: cmd.effects,
        }
      }
    }
    return stepFlow(withUser, input, ctx)
  }

  const cmd = runCommand(withUser, ctx, input)
  if (cmd) return cmd

  return reply(
    withUser,
    'I’m a demo assistant, so I only understand a small set of commands and I didn’t recognise that one. Here are some things I can do:',
    [
      opt('Create a new timetable', 'create a new timetable'),
      opt('Add a lunch break', 'Add a lunch break.'),
      opt('Keep Sunday free', 'Keep Sunday free.'),
      opt('Fill empty slots', 'Fill the empty slots'),
      opt('Help', 'help'),
    ],
  )
}

/** Swap this object for a real network client later; the shape of the result stays the same. */
export const assistantClient = {
  async send(session, text, ctx) {
    return respond(session, text, ctx)
  },
}
