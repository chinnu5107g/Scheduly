import { useId, useRef, useState } from 'react'
import { Download, FileJson, FileSpreadsheet, FolderOpen, Upload } from 'lucide-react'
import { Notice, PageHeader } from '../components/ui.jsx'
import { useApp } from '../AppContext.js'
import { buildBackup, parseBackup } from '../utils/storage.js'
import { toCsv } from '../utils/timetableModel.js'
import { downloadText, fileSafe } from '../utils/download.js'

const MAX_BYTES = 5 * 1024 * 1024

export default function ImportExport() {
  const app = useApp()
  const fileRef = useRef(null)
  const selId = useId()
  const [csvId, setCsvId] = useState(app.timetables[0]?.id || '')
  const [mode, setMode] = useState('merge')
  const [message, setMessage] = useState(null) // { tone, text }

  const exportJson = () => {
    const backup = buildBackup({ timetables: app.timetables, resources: app.resources, constraints: app.constraints })
    downloadText(`scheduly-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json')
    setMessage({ tone: 'success', text: `Exported ${app.timetables.length} timetable(s).` })
  }

  const csvTarget = app.timetables.find((t) => t.id === csvId) || app.timetables[0]
  const exportCsv = () => {
    if (!csvTarget) return
    downloadText(`${fileSafe(csvTarget.name)}.csv`, toCsv(csvTarget, app.resources), 'text/csv')
    setMessage({ tone: 'success', text: `Exported “${csvTarget.name}” as CSV.` })
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) return setMessage({ tone: 'warn', text: 'That file is larger than 5 MB, so it was not imported.' })
    try {
      const parsed = parseBackup(JSON.parse(await file.text()))
      if (!parsed.ok) return setMessage({ tone: 'warn', text: parsed.error })
      const { timetables, resources, constraints } = parsed.data
      app.importBackup({ timetables, resources, constraints }, mode)
      setMessage({ tone: 'success', text: `Imported ${timetables.length} timetable(s) (${mode === 'replace' ? 'replaced existing data' : 'added to existing'}).` })
    } catch {
      setMessage({ tone: 'warn', text: 'That file could not be read as a Scheduly backup (invalid JSON).' })
    }
  }

  return (
    <>
      <PageHeader title="Import / Export" subtitle="Back up your timetables, move them to another browser, or take a copy to share." />
      {message ? (
        <Notice tone={message.tone === 'success' ? 'info' : 'warn'}>
          <span role="status">{message.text}</span>
        </Notice>
      ) : null}
      <div className="settings-grid">
        <section className="card">
          <h2 className="card-title">
            <FileJson size={18} aria-hidden="true" /> Full backup (JSON)
          </h2>
          <p className="muted">Every timetable, subject, teacher, room and rule in one file.</p>
          <button type="button" className="btn btn-primary" onClick={exportJson} disabled={!app.timetables.length}>
            <Download size={16} aria-hidden="true" /> Download backup
          </button>
        </section>

        <section className="card">
          <h2 className="card-title">
            <Upload size={18} aria-hidden="true" /> Restore from backup
          </h2>
          <fieldset className="check-group">
            <legend>When importing</legend>
            <label className="check">
              <input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
              <span>Add to what I have</span>
            </label>
            <label className="check">
              <input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              <span>Replace everything</span>
            </label>
          </fieldset>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={onFile} aria-label="Choose a Scheduly backup file" tabIndex={-1} />
          <button type="button" className="btn btn-soft" onClick={() => fileRef.current?.click()}>
            <Upload size={16} aria-hidden="true" /> Choose backup file
          </button>
        </section>

        <section className="card">
          <h2 className="card-title">
            <FileSpreadsheet size={18} aria-hidden="true" /> Export one timetable (CSV)
          </h2>
          {app.timetables.length ? (
            <>
              <div className="field">
                <label htmlFor={selId}>Timetable</label>
                <select id={selId} className="input" value={csvTarget?.id || ''} onChange={(e) => setCsvId(e.target.value)}>
                  {app.timetables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="stack row">
                <button type="button" className="btn btn-soft" onClick={exportCsv}>
                  <Download size={16} aria-hidden="true" /> Download CSV
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => app.openTimetable(csvTarget.id)}>
                  <FolderOpen size={16} aria-hidden="true" /> Open timetable
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Create a timetable to export it.</p>
          )}
        </section>
      </div>
    </>
  )
}
