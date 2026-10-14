import { useId } from 'react'

export const NEW = '__new__'

/** Turn the picker state into a resource id (existing, or matched by name) or a new name to create. */
export function resolvePick(items, value, newName) {
  if (value && value !== NEW) return { id: value, create: null }
  if (value === NEW) {
    const name = String(newName || '').trim()
    if (!name) return { id: null, create: null, empty: true }
    const match = items.find((x) => x.name.toLowerCase() === name.toLowerCase())
    return match ? { id: match.id, create: null } : { id: null, create: name }
  }
  return { id: null, create: null }
}

/**
 * Select an existing teacher/room, or add a new one by typing its name.
 * `busy` maps resource id -> short reason; busy items are disabled so they cannot be chosen.
 */
export default function ResourcePicker({ label, noun, items, value, newName, onChange, onNewName, busy = {}, hint, invalid }) {
  const selId = useId()
  const newId = useId()
  return (
    <div className="field">
      <label htmlFor={selId}>{label}</label>
      <select
        id={selId}
        className="input"
        value={value}
        aria-invalid={invalid ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{items.length ? `Choose ${noun}…` : `No ${noun}s yet`}</option>
        {items.map((it) => (
          <option key={it.id} value={it.id} disabled={Boolean(busy[it.id]) && it.id !== value}>
            {it.name}
            {busy[it.id] ? ` — busy: ${busy[it.id]}` : ''}
          </option>
        ))}
        <option value={NEW}>＋ Add new {noun}…</option>
      </select>
      {value === NEW ? (
        <>
          <label htmlFor={newId} className="sr-only">
            New {noun} name
          </label>
          <input
            id={newId}
            className="input"
            value={newName}
            maxLength={80}
            placeholder={`New ${noun} name`}
            onChange={(e) => onNewName(e.target.value)}
          />
        </>
      ) : null}
      {value && value !== NEW && busy[value] ? <p className="field-error">Busy: {busy[value]}</p> : null}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  )
}
