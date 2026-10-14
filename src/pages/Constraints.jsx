import { useId, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Badge, Notice, PageHeader, Switch } from '../components/ui.jsx'
import { useApp } from '../AppContext.js'
import { uid } from '../utils/timetableModel.js'
import { BUILT_IN_RULES, CHECKED_RULES, collectBookings, describeConflict } from '../utils/timetableValidation.js'

export default function Constraints() {
  const app = useApp()
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const inputId = useId()
  const bookings = useMemo(() => collectBookings(app.timetables).length, [app.timetables])
  const names = Object.fromEntries(app.timetables.map((t) => [t.id, t.name]))

  const add = (e) => {
    e.preventDefault()
    const text = label.trim()
    if (!text) return setError('Describe the rule you want to record.')
    if (text.length > 200) return setError('Keep it under 200 characters.')
    app.setConstraints((c) => [...c, { id: uid('con'), rule: 'custom', label: text, enabled: true }])
    setLabel('')
    setError('')
  }

  const statusOf = (c) => {
    if (CHECKED_RULES.includes(c.rule)) return 'checked'
    if (BUILT_IN_RULES.includes(c.rule)) return 'built-in'
    return 'note'
  }

  return (
    <>
      <PageHeader title="Constraints" subtitle="The rules your timetables are checked against." />
      <Notice tone="info">
        <strong>Teacher and room clashes are checked.</strong> When you assign a teacher or room to a slot, anyone already busy at that time in
        another active timetable is greyed out, and clashes found later are listed below. Slots without a teacher or room can’t be checked.
      </Notice>

      <div className="detail-grid">
        <section className="card">
          <h2 className="card-title">Rules</h2>
          <ul className="rule-list">
            {app.constraints.map((c) => {
              const kind = statusOf(c)
              return (
                <li key={c.id}>
                  <div>
                    <span>{c.label}</span>
                    {kind === 'built-in' ? <small className="muted">Built into the grid, always on</small> : null}
                    {kind === 'note' ? <small className="muted">Your own note, not checked automatically</small> : null}
                  </div>
                  <div className="rule-actions">
                    {kind === 'checked' ? (
                      <Switch
                        checked={c.enabled}
                        label={`${c.enabled ? 'Turn off' : 'Turn on'} checking: ${c.label}`}
                        onChange={(v) => app.setConstraints((list) => list.map((x) => (x.id === c.id ? { ...x, enabled: v } : x)))}
                      />
                    ) : null}
                    {kind === 'built-in' ? <Badge tone="success">Enforced</Badge> : null}
                    {kind === 'note' ? (
                      <button
                        type="button"
                        className="icon-btn danger"
                        aria-label={`Delete rule: ${c.label}`}
                        onClick={() => app.setConstraints((list) => list.filter((x) => x.id !== c.id))}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
          <form className="inline-form" onSubmit={add} noValidate>
            <div className="field grow">
              <label htmlFor={inputId}>Add your own note</label>
              <input
                id={inputId}
                className="input"
                value={label}
                placeholder="e.g. No maths in the last period"
                aria-invalid={Boolean(error)}
                onChange={(e) => {
                  setLabel(e.target.value)
                  setError('')
                }}
              />
              {error ? (
                <p className="field-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <button type="submit" className="btn btn-soft">
              <Plus size={16} aria-hidden="true" /> Add note
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="card-title">Clashes right now</h2>
          <dl className="detail-list">
            <div>
              <dt>Scheduled entries checked</dt>
              <dd>{bookings}</dd>
            </div>
            <div>
              <dt>Clashes found</dt>
              <dd>{app.conflicts.length}</dd>
            </div>
          </dl>
          {app.conflicts.length ? (
            <ul className="clash-list">
              {app.conflicts.map((c) => (
                <li key={c.id}>
                  {describeConflict(c, app.resources, app.settings.timeFormat)}
                  <div className="clash-links">
                    {[c.a.timetableId, c.b.timetableId].map((id) => (
                      <button key={id} type="button" className="link-btn" onClick={() => app.openTimetable(id)}>
                        Open {names[id]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No teacher or room clashes between your active timetables. Archived timetables are not checked.</p>
          )}
        </section>
      </div>
    </>
  )
}
