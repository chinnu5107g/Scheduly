import { useId, useMemo, useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import Modal from './Modal.jsx'
import ResourcePicker, { resolvePick } from './ResourcePicker.jsx'
import TypeIcon from './TypeIcon.jsx'
import { computeRows, durationLabel, makeActivities, uid } from '../utils/timetableModel.js'
import { formatRange, toMinutes } from '../utils/time.js'
import { DAYS, DAY_NAMES, SLOT_OPTIONS, TIMETABLE_TYPES, TYPE_ORDER, getType } from '../utils/timetableTypes.js'

const STEPS = ['Type', 'Basics', 'Schedule', 'Activities', 'Review']

function defaultsFor(typeId) {
  const t = getType(typeId)
  return {
    name: '',
    category: t.defaultCategory || '',
    days: [...t.days],
    startTime: t.startTime,
    endTime: t.endTime,
    slotMinutes: t.slotMinutes,
    breaks: t.breaks.map((b) => ({ ...b, id: uid('brk') })),
    activityNames: [],
    trackResources: t.institutional,
    allowOverlaps: false,
    autoFill: true,
    subjectCfg: {},
  }
}

function validateBasics(form) {
  const errors = {}
  const name = form.name.trim()
  if (!name) errors.name = 'Give your timetable a name.'
  else if (name.length > 80) errors.name = 'Keep the name under 80 characters.'
  if (form.category.trim().length > 80) errors.category = 'Keep this under 80 characters.'
  return errors
}

function validateSchedule(form) {
  const errors = {}
  if (!form.days.length) errors.days = 'Choose at least one day.'
  const start = toMinutes(form.startTime)
  const end = toMinutes(form.endTime)
  if (Number.isNaN(start) || Number.isNaN(end)) errors.time = 'Enter a valid start and end time.'
  else if (end <= start) errors.time = 'The end time must be after the start time.'
  else if (end - start < 30) errors.time = 'The day should be at least 30 minutes long.'
  else if (Number(form.slotMinutes) > end - start) errors.slot = 'The slot length is longer than the whole day.'

  const breakErrors = {}
  const sorted = []
  form.breaks.forEach((b) => {
    const s = toMinutes(b.start)
    const e = toMinutes(b.end)
    if (Number.isNaN(s) || Number.isNaN(e)) breakErrors[b.id] = 'Enter a start and end time.'
    else if (e <= s) breakErrors[b.id] = 'The break must end after it starts.'
    else if (!errors.time && (s < start || e > end)) breakErrors[b.id] = 'Keep the break inside the day.'
    else sorted.push({ id: b.id, s, e })
  })
  sorted.sort((a, b) => a.s - b.s)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].s < sorted[i - 1].e) breakErrors[sorted[i].id] = 'This break overlaps another one.'
  }
  if (Object.keys(breakErrors).length) errors.breaks = breakErrors
  return errors
}

export default function CreateTimetableModal({ initialType, subjectLibrary = [], resources = null, onAddResource, onCreate, onClose }) {
  const [step, setStep] = useState(initialType ? 1 : 0)
  const [typeId, setTypeId] = useState(initialType || null)
  const [form, setForm] = useState(() => defaultsFor(initialType || 'school'))
  const [errors, setErrors] = useState({})
  const [activityInput, setActivityInput] = useState('')
  const ids = {
    name: useId(),
    category: useId(),
    start: useId(),
    end: useId(),
    slot: useId(),
    activity: useId(),
  }

  const type = typeId ? getType(typeId) : null
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const chooseType = (id) => {
    setTypeId(id)
    setForm(defaultsFor(id))
    setErrors({})
    setStep(1)
  }

  const rowsPreview = useMemo(() => {
    if (step < 2) return []
    return computeRows({ ...form, breaks: form.breaks.filter((b) => !Number.isNaN(toMinutes(b.start)) && !Number.isNaN(toMinutes(b.end))) })
  }, [form, step])
  const periodCount = rowsPreview.filter((r) => r.kind === 'slot').length

  const suggestions = useMemo(() => {
    if (!type) return []
    const have = new Set(form.activityNames.map((n) => n.toLowerCase()))
    const pool = [...type.suggestions, ...subjectLibrary]
    const seen = new Set()
    return pool.filter((n) => {
      const k = n.toLowerCase()
      if (have.has(k) || seen.has(k)) return false
      seen.add(k)
      return true
    }).slice(0, 14)
  }, [type, form.activityNames, subjectLibrary])

  const addActivities = (raw) => {
    const parts = raw
      .split(/[,;\n]/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (!parts.length) return
    const tooLong = parts.find((p) => p.length > 60)
    if (tooLong) {
      setErrors((e) => ({ ...e, activities: 'Keep each activity name under 60 characters.' }))
      return
    }
    setForm((f) => {
      const have = new Set(f.activityNames.map((n) => n.toLowerCase()))
      const next = [...f.activityNames]
      for (const p of parts) {
        if (!have.has(p.toLowerCase()) && next.length < 30) {
          next.push(p)
          have.add(p.toLowerCase())
        }
      }
      return { ...f, activityNames: next }
    })
    setErrors((e) => ({ ...e, activities: undefined }))
    setActivityInput('')
  }

  const cfgOf = (n) => ({ span: 1, perWeek: 0, teacherSel: '', teacherNew: '', ...(form.subjectCfg[n.toLowerCase()] || {}) })
  const setCfg = (n, patch) =>
    setForm((f) => ({ ...f, subjectCfg: { ...f.subjectCfg, [n.toLowerCase()]: { ...cfgOf(n), ...patch } } }))
  const spanChoices = Array.from({ length: Math.min(8, Math.max(1, periodCount)) }, (_, i) => i + 1)

  const toggleDay = (d) => {
    set({ days: form.days.includes(d) ? form.days.filter((x) => x !== d) : DAYS.filter((x) => form.days.includes(x) || x === d) })
    setErrors((e) => ({ ...e, days: undefined }))
  }

  const updateBreak = (id, patch) => set({ breaks: form.breaks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })

  const next = () => {
    if (step === 0) {
      if (!typeId) setErrors({ type: 'Pick the kind of timetable you want to create.' })
      return
    }
    if (step === 1) {
      const e = validateBasics(form)
      setErrors(e)
      if (Object.keys(e).length) return
    }
    if (step === 2) {
      const e = validateSchedule(form)
      setErrors(e)
      if (Object.keys(e).length) return
    }
    if (step === 3) {
      // Accept text that was typed but not yet added.
      if (activityInput.trim()) addActivities(activityInput)
      const pending = activityInput.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean)
      if (!form.activityNames.length && !pending.length) {
        setErrors({ activities: `Add at least one ${type.institutional ? 'subject' : 'activity'}.` })
        return
      }
      setErrors({})
    }
    if (step === 4) return submit()
    setStep((s) => s + 1)
  }

  const back = () => {
    setErrors({})
    setStep((s) => Math.max(initialType ? 1 : 0, s - 1))
  }

  const submit = () => {
    const teachers = resources?.teachers || []
    const activities = makeActivities(form.activityNames).map((a) => {
      const c = cfgOf(a.name)
      const extra = {}
      if (c.span > 1) extra.span = c.span
      if (c.perWeek > 0) extra.perWeek = c.perWeek
      if (form.trackResources) {
        const pick = resolvePick(teachers, c.teacherSel, c.teacherNew)
        const id = pick.id || (pick.create && onAddResource ? onAddResource('teachers', pick.create) : null)
        if (id) extra.teacherId = id
      }
      return { ...a, ...extra }
    })
    onCreate(
      {
        name: form.name.trim(),
        type: typeId,
        category: form.category.trim(),
        days: form.days,
        startTime: form.startTime,
        endTime: form.endTime,
        slotMinutes: Number(form.slotMinutes),
        breaks: form.breaks.map((b) => ({ id: b.id, label: b.label.trim() || 'Break', start: b.start, end: b.end })),
        activities,
        trackResources: form.trackResources,
        allowOverlaps: form.allowOverlaps,
        status: 'Draft',
        origin: 'manual',
      },
      { autoFill: form.autoFill },
    )
  }

  const slotChoices = SLOT_OPTIONS.includes(Number(form.slotMinutes))
    ? SLOT_OPTIONS
    : [...SLOT_OPTIONS, Number(form.slotMinutes)].sort((a, b) => a - b)

  return (
    <Modal
      title="Create new timetable"
      description={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          {step > (initialType ? 1 : 0) ? (
            <button type="button" className="btn btn-ghost push-left" onClick={back}>
              Back
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {step > 0 ? (
            <button type="button" className="btn btn-primary" onClick={next}>
              {step === STEPS.length - 1 ? 'Create timetable' : 'Continue'}
            </button>
          ) : null}
        </>
      }
    >
      <ol className="stepper" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="step-dot">{i < step ? <Check size={12} aria-hidden="true" /> : i + 1}</span>
            <span className="step-label">{label}</span>
          </li>
        ))}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          next()
        }}
        noValidate
      >
        {step === 0 ? (
          <div>
            <p className="muted step-intro">What are you planning? Each type starts with sensible defaults and its own fields.</p>
            <div className="type-grid" role="radiogroup" aria-label="Timetable type">
              {TYPE_ORDER.map((id) => {
                const t = TIMETABLE_TYPES[id]
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={typeId === id}
                    className={`type-card${typeId === id ? ' selected' : ''}`}
                    onClick={() => chooseType(id)}
                  >
                    <span className={`type-chip type-${id}`}>
                      <TypeIcon type={id} size={20} />
                    </span>
                    <strong>{t.label}</strong>
                    <span className="muted">{t.blurb}</span>
                  </button>
                )
              })}
            </div>
            {errors.type ? (
              <p className="field-error" role="alert">
                {errors.type}
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 1 && type ? (
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor={ids.name}>Timetable name</label>
              <input
                id={ids.name}
                className="input"
                value={form.name}
                maxLength={90}
                data-autofocus
                placeholder={type.institutional ? `e.g. ${type.categoryPlaceholder.replace('e.g. ', '')}` : 'e.g. My weekly plan'}
                aria-invalid={Boolean(errors.name)}
                onChange={(e) => {
                  set({ name: e.target.value })
                  setErrors((er) => ({ ...er, name: undefined }))
                }}
              />
              {errors.name ? <p className="field-error" role="alert">{errors.name}</p> : null}
            </div>
            <div className="field span-2">
              <label htmlFor={ids.category}>
                {type.categoryLabel} <span className="optional">(optional)</span>
              </label>
              <input
                id={ids.category}
                className="input"
                value={form.category}
                maxLength={90}
                placeholder={type.categoryPlaceholder}
                aria-invalid={Boolean(errors.category)}
                onChange={(e) => set({ category: e.target.value })}
              />
              {errors.category ? <p className="field-error" role="alert">{errors.category}</p> : null}
            </div>
            {type.institutional ? (
              <label className="check span-2">
                <input type="checkbox" checked={form.trackResources} onChange={(e) => set({ trackResources: e.target.checked })} />
                <span>
                  <strong>Track teachers and rooms</strong>
                  <small>Adds teacher and room fields to every period, and stops a teacher or room being booked twice at the same time.</small>
                </span>
              </label>
            ) : null}
            {type.allowsOverlapToggle ? (
              <label className="check span-2">
                <input type="checkbox" checked={form.allowOverlaps} onChange={(e) => set({ allowOverlaps: e.target.checked })} />
                <span>
                  <strong>I allow activities to overlap</strong>
                  <small>Recorded for the future validator. Off by default.</small>
                </span>
              </label>
            ) : null}
          </div>
        ) : null}

        {step === 2 && type ? (
          <div className="form-grid">
            <fieldset className="field span-2 fieldset-plain">
              <legend>{type.institutional ? 'Working days' : 'Days covered'}</legend>
              <div className="chip-row">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`chip-toggle${form.days.includes(d) ? ' on' : ''}`}
                    aria-pressed={form.days.includes(d)}
                    title={DAY_NAMES[d]}
                    onClick={() => toggleDay(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
              {errors.days ? <p className="field-error" role="alert">{errors.days}</p> : null}
            </fieldset>

            <div className="field">
              <label htmlFor={ids.start}>Start time</label>
              <input id={ids.start} type="time" className="input" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} aria-invalid={Boolean(errors.time)} />
            </div>
            <div className="field">
              <label htmlFor={ids.end}>End time</label>
              <input id={ids.end} type="time" className="input" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} aria-invalid={Boolean(errors.time)} />
            </div>
            {errors.time ? <p className="field-error span-2" role="alert">{errors.time}</p> : null}

            <div className="field span-2">
              <label htmlFor={ids.slot}>{type.institutional ? 'Period length' : 'Slot length'}</label>
              <select id={ids.slot} className="input" value={form.slotMinutes} onChange={(e) => set({ slotMinutes: Number(e.target.value) })}>
                {slotChoices.map((m) => (
                  <option key={m} value={m}>
                    {m >= 60 && m % 60 === 0 ? `${m / 60} hour${m === 60 ? '' : 's'}` : `${m} minutes`}
                  </option>
                ))}
              </select>
              {errors.slot ? <p className="field-error" role="alert">{errors.slot}</p> : null}
            </div>

            <fieldset className="field span-2 fieldset-plain">
              <legend>Breaks</legend>
              {form.breaks.length === 0 ? <p className="hint">No breaks. Add one for lunch or rest time.</p> : null}
              <ul className="break-list">
                {form.breaks.map((b, i) => (
                  <li key={b.id}>
                    <div className="break-row">
                      <input className="input" aria-label={`Break ${i + 1} name`} value={b.label} maxLength={40} onChange={(e) => updateBreak(b.id, { label: e.target.value })} />
                      <input type="time" className="input" aria-label={`Break ${i + 1} start`} value={b.start} onChange={(e) => updateBreak(b.id, { start: e.target.value })} />
                      <input type="time" className="input" aria-label={`Break ${i + 1} end`} value={b.end} onChange={(e) => updateBreak(b.id, { end: e.target.value })} />
                      <button type="button" className="icon-btn" aria-label={`Remove break ${i + 1}`} onClick={() => set({ breaks: form.breaks.filter((x) => x.id !== b.id) })}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                    {errors.breaks?.[b.id] ? <p className="field-error" role="alert">{errors.breaks[b.id]}</p> : null}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => set({ breaks: [...form.breaks, { id: uid('brk'), label: 'Break', start: form.startTime, end: form.startTime }] })}
              >
                <Plus size={15} aria-hidden="true" /> Add break
              </button>
            </fieldset>

            {!errors.time && !errors.days ? (
              <p className="hint span-2" aria-live="polite">
                This gives {periodCount} {periodCount === 1 ? 'slot' : 'slots'} per day across {form.days.length} {form.days.length === 1 ? 'day' : 'days'}.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 3 && type ? (
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor={ids.activity}>{type.institutional ? 'Subjects' : 'Activities'}</label>
              <div className="inline-add">
                <input
                  id={ids.activity}
                  className="input"
                  value={activityInput}
                  data-autofocus
                  placeholder={type.institutional ? 'Type a subject and press Enter' : 'Type an activity and press Enter'}
                  aria-invalid={Boolean(errors.activities)}
                  onChange={(e) => {
                    setActivityInput(e.target.value)
                    setErrors((er) => ({ ...er, activities: undefined }))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      addActivities(activityInput)
                    }
                  }}
                />
                <button type="button" className="btn btn-soft" onClick={() => addActivities(activityInput)}>
                  <Plus size={16} aria-hidden="true" /> Add
                </button>
              </div>
              <p className="hint">Separate several names with commas.</p>
              {errors.activities ? <p className="field-error" role="alert">{errors.activities}</p> : null}
            </div>

            {form.activityNames.length ? (
              <ul className="chip-list span-2" aria-label="Selected activities">
                {form.activityNames.map((n) => (
                  <li key={n} className="chip">
                    {n}
                    <button type="button" aria-label={`Remove ${n}`} onClick={() => set({ activityNames: form.activityNames.filter((x) => x !== n) })}>
                      <X size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {form.activityNames.length ? (
              <div className="span-2 subject-setup">
                <p className="hint">
                  For each {type.institutional ? 'subject' : 'activity'}, choose how long it lasts and how often it happens each week.
                  {form.trackResources ? ' Choose a teacher so Scheduly can avoid clashes with your other timetables.' : ''}
                </p>
                {form.activityNames.map((n) => {
                  const c = cfgOf(n)
                  return (
                    <fieldset key={n} className="subject-card">
                      <legend>{n}</legend>
                      <div className="field">
                        <label htmlFor={`${ids.activity}-d-${n}`}>Duration</label>
                        <select id={`${ids.activity}-d-${n}`} className="input" value={c.span} onChange={(e) => setCfg(n, { span: Number(e.target.value) })}>
                          {spanChoices.map((s) => (
                            <option key={s} value={s}>
                              {durationLabel({ slotMinutes: form.slotMinutes }, s)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`${ids.activity}-w-${n}`}>Times per week</label>
                        <select id={`${ids.activity}-w-${n}`} className="input" value={c.perWeek} onChange={(e) => setCfg(n, { perWeek: Number(e.target.value) })}>
                          <option value={0}>Automatic</option>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                            <option key={w} value={w}>
                              {w}×
                            </option>
                          ))}
                        </select>
                      </div>
                      {form.trackResources ? (
                        <ResourcePicker
                          label="Teacher"
                          noun="teacher"
                          items={resources?.teachers || []}
                          value={c.teacherSel}
                          newName={c.teacherNew}
                          onChange={(v) => setCfg(n, { teacherSel: v })}
                          onNewName={(v) => setCfg(n, { teacherNew: v })}
                        />
                      ) : null}
                    </fieldset>
                  )
                })}
              </div>
            ) : null}

            {suggestions.length ? (
              <div className="span-2">
                <p className="hint">Suggestions</p>
                <div className="chip-row">
                  {suggestions.map((n) => (
                    <button key={n} type="button" className="chip-suggest" onClick={() => addActivities(n)}>
                      <Plus size={13} aria-hidden="true" /> {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 4 && type ? (
          <div className="review">
            <dl className="review-list">
              <div><dt>Type</dt><dd>{type.label}</dd></div>
              <div><dt>Name</dt><dd>{form.name.trim()}</dd></div>
              {form.category.trim() ? <div><dt>{type.categoryLabel}</dt><dd>{form.category.trim()}</dd></div> : null}
              <div><dt>Days</dt><dd>{form.days.join(', ')}</dd></div>
              <div><dt>Time</dt><dd>{formatRange(form.startTime, form.endTime, '12h')}, {form.slotMinutes}-minute slots ({periodCount} per day)</dd></div>
              <div><dt>Breaks</dt><dd>{form.breaks.length ? form.breaks.map((b) => `${b.label || 'Break'} ${formatRange(b.start, b.end, '12h')}`).join(', ') : 'None'}</dd></div>
              <div><dt>{type.institutional ? 'Subjects' : 'Activities'}</dt><dd>{form.activityNames.map((n) => (cfgOf(n).span > 1 ? `${n} (${durationLabel({ slotMinutes: form.slotMinutes }, cfgOf(n).span)})` : n)).join(', ')}</dd></div>
              {type.institutional ? <div><dt>Teachers & rooms</dt><dd>{form.trackResources ? 'Tracked' : 'Not tracked'}</dd></div> : null}
              {type.allowsOverlapToggle ? <div><dt>Overlaps</dt><dd>{form.allowOverlaps ? 'Allowed' : 'Not allowed (recorded only)'}</dd></div> : null}
            </dl>
            <label className="check">
              <input type="checkbox" checked={form.autoFill} onChange={(e) => set({ autoFill: e.target.checked })} />
              <span>
                <strong>Build the timetable automatically</strong>
                <small>
                  Places every {type.institutional ? 'subject' : 'activity'} across the week using its duration and how often it happens
                  {form.trackResources ? ', and avoids teacher clashes with your other timetables' : ''}. You can edit anything afterwards.
                </small>
              </span>
            </label>
          </div>
        ) : null}

        <button type="submit" className="sr-only" tabIndex={-1}>
          Continue
        </button>
      </form>
    </Modal>
  )
}
