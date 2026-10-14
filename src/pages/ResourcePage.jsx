import { useId, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { EmptyState, Notice, PageHeader } from '../components/ui.jsx'
import { useApp } from '../AppContext.js'
import { ACTIVITY_COLORS } from '../utils/timetableTypes.js'
import { uid } from '../utils/timetableModel.js'

const KINDS = {
  subjects: {
    title: 'Subjects / Activities',
    subtitle: 'Your reusable subjects and activities. They are suggested when you create a timetable.',
    noun: 'subject',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'category', label: 'Category' },
      { key: 'color', label: 'Colour', type: 'color' },
    ],
    fields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Mathematics' },
      { key: 'category', label: 'Category', placeholder: 'e.g. Core, Language, Personal' },
      { key: 'color', label: 'Colour', type: 'color' },
    ],
    empty: { category: '', color: ACTIVITY_COLORS[0] },
  },
  teachers: {
    title: 'Teachers',
    subtitle: 'People who can be assigned to school and college timetable slots.',
    noun: 'teacher',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'subjects', label: 'Subjects' },
      { key: 'availability', label: 'Availability' },
    ],
    fields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Ms. A. Khan' },
      { key: 'subjects', label: 'Subjects taught', placeholder: 'e.g. Physics, Chemistry' },
      { key: 'availability', label: 'Availability', placeholder: 'e.g. Mon–Fri, mornings' },
    ],
    empty: { subjects: '', availability: '' },
    note: 'Availability is saved as a note. It is not enforced yet.',
  },
  rooms: {
    title: 'Rooms / Resources',
    subtitle: 'Classrooms, labs and other resources that slots can use.',
    noun: 'room',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'capacity', label: 'Capacity' },
    ],
    fields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Lab 2' },
      { key: 'type', label: 'Type', placeholder: 'e.g. Classroom, Lab' },
      { key: 'capacity', label: 'Capacity', type: 'number' },
    ],
    empty: { type: '', capacity: 30 },
    note: 'A room that is already booked at a time is greyed out when you assign rooms in another timetable.',
  },
}

function ItemForm({ kind, item, onSave, onClose }) {
  const cfg = KINDS[kind]
  const [form, setForm] = useState(() => ({ ...cfg.empty, name: '', ...(item || {}) }))
  const [error, setError] = useState('')
  const baseId = useId()

  const submit = (e) => {
    e.preventDefault()
    const name = String(form.name || '').trim()
    if (!name) return setError('Please enter a name.')
    if (name.length > 80) return setError('Keep the name under 80 characters.')
    const out = { ...form, name }
    if ('capacity' in out) out.capacity = Math.max(0, Math.round(Number(out.capacity) || 0))
    onSave(out)
  }

  return (
    <Modal
      title={`${item ? 'Edit' : 'Add'} ${cfg.noun}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={`${baseId}-form`} className="btn btn-primary">
            Save
          </button>
        </>
      }
    >
      <form id={`${baseId}-form`} onSubmit={submit} noValidate>
        {cfg.fields.map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={`${baseId}-${f.key}`}>{f.label}</label>
            {f.type === 'color' ? (
              <input
                id={`${baseId}-${f.key}`}
                type="color"
                className="input color-input"
                value={form[f.key] || '#2563EB'}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            ) : (
              <input
                id={`${baseId}-${f.key}`}
                className="input"
                type={f.type === 'number' ? 'number' : 'text'}
                min={f.type === 'number' ? 0 : undefined}
                value={form[f.key] ?? ''}
                placeholder={f.placeholder}
                data-autofocus={f.key === 'name' ? true : undefined}
                aria-invalid={f.key === 'name' && Boolean(error)}
                onChange={(e) => {
                  setForm({ ...form, [f.key]: e.target.value })
                  if (f.key === 'name') setError('')
                }}
              />
            )}
          </div>
        ))}
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}

export default function ResourcePage({ kind }) {
  const app = useApp()
  const cfg = KINDS[kind]
  const items = app.resources[kind]
  const [editing, setEditing] = useState(null) // { item } | { item: null }
  const [deleting, setDeleting] = useState(null)

  const save = (values) => {
    const existing = editing.item
    app.setResources((r) => ({
      ...r,
      [kind]: existing
        ? r[kind].map((x) => (x.id === existing.id ? { ...x, ...values, id: existing.id } : x))
        : [...r[kind], { ...values, id: uid(kind.slice(0, 3)) }],
    }))
    app.notify(`${existing ? 'Updated' : 'Added'} “${values.name}”.`, { silent: true })
    setEditing(null)
  }

  const remove = () => {
    app.setResources((r) => ({ ...r, [kind]: r[kind].filter((x) => x.id !== deleting.id) }))
    app.notify(`Removed “${deleting.name}”.`, { silent: true })
    setDeleting(null)
  }

  return (
    <>
      <PageHeader
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ item: null })}>
            <Plus size={17} aria-hidden="true" /> Add {cfg.noun}
          </button>
        }
      />
      {items.length === 0 ? (
        <EmptyState title={`No ${cfg.title.toLowerCase()} yet`} action={<button type="button" className="btn btn-primary" onClick={() => setEditing({ item: null })}>Add {cfg.noun}</button>}>
          Add your first {cfg.noun} to use it in your timetables.
        </EmptyState>
      ) : (
        <div className="card table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {cfg.columns.map((c) => (
                    <th key={c.key} scope="col">
                      {c.label}
                    </th>
                  ))}
                  <th scope="col" className="col-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    {cfg.columns.map((c) => (
                      <td key={c.key} data-label={c.label}>
                        {c.type === 'color' ? (
                          <span className="swatch" style={{ background: it[c.key] }} title={it[c.key]} />
                        ) : (
                          it[c.key] || <span className="muted">—</span>
                        )}
                      </td>
                    ))}
                    <td className="col-actions">
                      <button type="button" className="icon-btn" aria-label={`Edit ${it.name}`} onClick={() => setEditing({ item: it })}>
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="icon-btn danger" aria-label={`Delete ${it.name}`} onClick={() => setDeleting(it)}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {cfg.note ? <Notice tone="info">{cfg.note}</Notice> : null}
      {editing ? <ItemForm kind={kind} item={editing.item} onSave={save} onClose={() => setEditing(null)} /> : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${cfg.noun}?`}
          message={`“${deleting.name}” will be removed from your list. Slots that already use it keep their entry but lose the link.`}
          confirmLabel="Delete"
          danger
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  )
}
