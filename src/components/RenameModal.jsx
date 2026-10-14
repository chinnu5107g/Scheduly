import { useId, useState } from 'react'
import Modal from './Modal.jsx'

export default function RenameModal({ timetable, onSave, onClose }) {
  const [name, setName] = useState(timetable.name)
  const [error, setError] = useState('')
  const inputId = useId()
  const errorId = useId()

  const submit = (e) => {
    e.preventDefault()
    const value = name.trim()
    if (!value) return setError('Please enter a name.')
    if (value.length > 80) return setError('Keep the name under 80 characters.')
    onSave(value)
  }

  return (
    <Modal
      title="Rename timetable"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="rename-form" className="btn btn-primary">
            Save name
          </button>
        </>
      }
    >
      <form id="rename-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={inputId}>Timetable name</label>
          <input
            id={inputId}
            className="input"
            value={name}
            maxLength={90}
            data-autofocus
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
          />
          {error ? (
            <p className="field-error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </form>
    </Modal>
  )
}
