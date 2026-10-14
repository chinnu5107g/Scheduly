import { useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog.jsx'
import ResourcePicker, { NEW, resolvePick } from './ResourcePicker.jsx'
import { Notice } from './ui.jsx'
import { useApp } from '../AppContext.js'
import { actSpan, activityUsage, durationLabel, durationSpans, makeActivities } from '../utils/timetableModel.js'

function PerWeekSelect({ value, onChange, id, label }) {
  return (
    <select id={id} className="input input-sm" value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))}>
      <option value={0}>Auto per week</option>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
        <option key={w} value={w}>
          {w}× per week
        </option>
      ))}
    </select>
  )
}

function DurationSelect({ timetable, value, onChange, id, label }) {
  return (
    <select id={id} className="input input-sm" value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))}>
      {durationSpans(timetable).map((s) => (
        <option key={s} value={s}>
          {durationLabel(timetable, s)}
        </option>
      ))}
    </select>
  )
}

/**
 * Add, retime and remove the subjects of one timetable. Each subject has a usual duration (and, for
 * school / college timetables, a usual teacher) that pre-fills the slot editor.
 */
export default function SubjectsPanel({ timetable: tt }) {
  const app = useApp()
  const teachers = app.resources.teachers
  const usage = activityUsage(tt)
  const nameId = useId()
  const durId = useId()

  const [name, setName] = useState('')
  const [span, setSpan] = useState(1)
  const [perWeek, setPerWeek] = useState(0)
  const [teacherSel, setTeacherSel] = useState('')
  const [teacherNew, setTeacherNew] = useState('')
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(null)

  const patchActivity = (id, patch) =>
    app.updateTimetable(tt.id, (t) => ({
      ...t,
      activities: t.activities.map((a) => {
        if (a.id !== id) return a
        const next = { ...a, ...patch }
        if (!(next.span > 1)) delete next.span
        if (!(next.perWeek > 0)) delete next.perWeek
        if (!next.teacherId) delete next.teacherId
        return next
      }),
    }))

  const add = (e) => {
    e.preventDefault()
    const value = name.trim()
    if (!value) return setError('Enter a subject name.')
    if (value.length > 60) return setError('Keep the subject name under 60 characters.')
    if (tt.activities.some((a) => a.name.toLowerCase() === value.toLowerCase())) return setError(`“${value}” is already in this timetable.`)
    const pick = tt.trackResources ? resolvePick(teachers, teacherSel, teacherNew) : { id: null, create: null }
    if (teacherSel === NEW && pick.empty) return setError('Type the new teacher’s name, or choose one from the list.')
    const teacherId = pick.id || (pick.create ? app.addResource('teachers', pick.create) : null)
    app.updateTimetable(tt.id, (t) => {
      const list = makeActivities([value], t.activities)
      const added = list[list.length - 1]
      return {
        ...t,
        activities: list.map((a) => (a.id === added.id ? { ...a, ...(span > 1 ? { span } : {}), ...(perWeek > 0 ? { perWeek } : {}), ...(teacherId ? { teacherId } : {}) } : a)),
      }
    })
    app.notify(`Added “${value}” (${durationLabel(tt, span)}).`, { silent: true })
    setName('')
    setSpan(1)
    setPerWeek(0)
    setTeacherSel('')
    setTeacherNew('')
    setError('')
  }

  const remove = () => {
    const id = removing.id
    app.updateTimetable(tt.id, (t) => ({
      ...t,
      activities: t.activities.filter((a) => a.id !== id),
      slots: Object.fromEntries(Object.entries(t.slots).filter(([, v]) => v.activityId !== id)),
    }))
    app.notify(`Removed “${removing.name}” and its slots.`, { silent: true })
    setRemoving(null)
  }

  return (
    <section className="card subjects-panel" aria-label="Subjects in this timetable">
      <h2 className="card-title">Subjects in this timetable</h2>
      <p className="muted">
        Choose how long each subject lasts, how often it happens{tt.trackResources ? ' and who teaches it' : ''}. “Build timetable” uses these to
        fill the grid; you can still change any single slot.
      </p>

      <form className="subject-add" onSubmit={add} noValidate>
        <div className="field">
          <label htmlFor={nameId}>New subject</label>
          <input
            id={nameId}
            className="input"
            value={name}
            maxLength={70}
            placeholder="e.g. Physics Lab"
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
          />
        </div>
        <div className="field">
          <label htmlFor={durId}>Duration</label>
          <DurationSelect timetable={tt} id={durId} value={span} onChange={setSpan} label="Duration" />
        </div>
        <div className="field">
          <label htmlFor={`${durId}-w`}>Times per week</label>
          <PerWeekSelect id={`${durId}-w`} value={perWeek} onChange={setPerWeek} label="Times per week" />
        </div>
        {tt.trackResources ? (
          <ResourcePicker
            label="Teacher (optional)"
            noun="teacher"
            items={teachers}
            value={teacherSel}
            newName={teacherNew}
            onChange={setTeacherSel}
            onNewName={setTeacherNew}
          />
        ) : null}
        <button type="submit" className="btn btn-soft subject-add-btn">
          <Plus size={16} aria-hidden="true" /> Add subject
        </button>
      </form>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      {tt.activities.length === 0 ? (
        <p className="muted subject-empty">No subjects yet. Add one above, or type a new name when you click a cell in the grid.</p>
      ) : (
        <ul className="subject-list">
          {tt.activities.map((a) => (
            <li key={a.id}>
              <span className="legend-dot" style={{ background: a.color }} aria-hidden="true" />
              <div className="subject-name">
                <strong>{a.name}</strong>
                <small className="muted">{usage[a.id] || 0}× this week</small>
              </div>
              <div className="subject-controls">
                <label className="sr-only" htmlFor={`dur-${a.id}`}>
                  Duration of {a.name}
                </label>
                <DurationSelect
                  timetable={tt}
                  id={`dur-${a.id}`}
                  value={Math.min(actSpan(a), durationSpans(tt).length)}
                  onChange={(v) => patchActivity(a.id, { span: v })}
                  label={`Duration of ${a.name}`}
                />
                <label className="sr-only" htmlFor={`pw-${a.id}`}>
                  Times per week for {a.name}
                </label>
                <PerWeekSelect id={`pw-${a.id}`} value={a.perWeek || 0} onChange={(v) => patchActivity(a.id, { perWeek: v })} label={`Times per week for ${a.name}`} />
                {tt.trackResources ? (
                  <>
                    <label className="sr-only" htmlFor={`tch-${a.id}`}>
                      Usual teacher for {a.name}
                    </label>
                    <select
                      id={`tch-${a.id}`}
                      className="input input-sm"
                      value={a.teacherId || ''}
                      onChange={(e) => patchActivity(a.id, { teacherId: e.target.value })}
                    >
                      <option value="">No usual teacher</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
                <button type="button" className="icon-btn danger" aria-label={`Remove ${a.name}`} onClick={() => setRemoving(a)}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Notice tone="info">Changing a duration here only affects slots you add from now on. Slots already in the grid keep their length.</Notice>

      {removing ? (
        <ConfirmDialog
          title="Remove subject?"
          message={`“${removing.name}” will be removed from this timetable, and its ${usage[removing.id] || 0} scheduled slot(s) will be cleared.`}
          confirmLabel="Remove subject"
          danger
          onConfirm={remove}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </section>
  )
}
