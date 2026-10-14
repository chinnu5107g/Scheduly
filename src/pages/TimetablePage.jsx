import { useState } from 'react'
import { ArrowLeft, Copy, Download, Pencil, RefreshCw, Sparkles, Trash2, Wand2 } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import WeeklyPreview from '../components/WeeklyPreview.jsx'
import SubjectsPanel from '../components/SubjectsPanel.jsx'
import { EmptyState, Notice, PageHeader } from '../components/ui.jsx'
import { useApp } from '../AppContext.js'
import { STATUSES, countFilled, totalCells, toCsv } from '../utils/timetableModel.js'
import { describeUnplaced } from '../utils/generator.js'
import { formatRange } from '../utils/time.js'
import { getType } from '../utils/timetableTypes.js'
import { downloadText, fileSafe } from '../utils/download.js'

export default function TimetablePage({ id }) {
  const app = useApp()
  const tt = app.timetables.find((t) => t.id === id)
  const [gen, setGen] = useState(null)
  const [confirmRebuild, setConfirmRebuild] = useState(false)

  if (!tt) {
    return (
      <EmptyState
        title="Timetable not found"
        action={
          <button type="button" className="btn btn-primary" onClick={() => app.navigate('timetables')}>
            Back to My Timetables
          </button>
        }
      >
        It may have been deleted.
      </EmptyState>
    )
  }

  const type = getType(tt.type)
  const filled = countFilled(tt)
  const total = totalCells(tt)

  const build = (mode) => {
    setConfirmRebuild(false)
    setGen(app.generateFor(tt.id, mode))
  }

  const exportCsv = () => {
    downloadText(`${fileSafe(tt.name)}.csv`, toCsv(tt, app.resources), 'text/csv')
    app.notify(`Exported “${tt.name}” as CSV.`)
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={() => app.navigate('timetables')}>
        <ArrowLeft size={15} aria-hidden="true" /> All timetables
      </button>
      <PageHeader
        title={tt.name}
        subtitle={`${type.label}${tt.category ? ` · ${tt.category}` : ''}`}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => app.askRename(tt)}>
              <Pencil size={16} aria-hidden="true" /> Rename
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => app.duplicate(tt)}>
              <Copy size={16} aria-hidden="true" /> Duplicate
            </button>
            <button type="button" className="btn btn-ghost" onClick={exportCsv}>
              <Download size={16} aria-hidden="true" /> CSV
            </button>
            <button type="button" className="btn btn-danger-soft" onClick={() => app.askDelete(tt)}>
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          </>
        }
      />

      <WeeklyPreview
        timetables={app.timetables}
        resources={app.resources}
        timeFormat={app.settings.timeFormat}
        fixedId={tt.id}
        onUpdate={app.updateTimetable}
        notify={app.notify}
      />

      <SubjectsPanel timetable={tt} />

      <div className="detail-grid">
        <section className="card">
          <h2 className="card-title">Details</h2>
          <dl className="detail-list">
            <div>
              <dt>Status</dt>
              <dd>
                <label htmlFor="status-select" className="sr-only">
                  Status
                </label>
                <select
                  id="status-select"
                  className="input input-sm"
                  value={tt.status}
                  onChange={(e) => app.updateTimetable(tt.id, { status: e.target.value })}
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </dd>
            </div>
            <div>
              <dt>Hours</dt>
              <dd>{formatRange(tt.startTime, tt.endTime, app.settings.timeFormat)}</dd>
            </div>
            <div>
              <dt>Slot length</dt>
              <dd>{tt.slotMinutes} minutes</dd>
            </div>
            <div>
              <dt>Breaks</dt>
              <dd>
                {tt.breaks.length
                  ? tt.breaks.map((b) => `${b.label} ${formatRange(b.start, b.end, app.settings.timeFormat)}`).join(' · ')
                  : 'None'}
              </dd>
            </div>
            <div>
              <dt>Filled slots</dt>
              <dd>
                {filled} of {total}
              </dd>
            </div>
            <div>
              <dt>Clash checks</dt>
              <dd>{tt.trackResources ? 'Teachers and rooms, across all timetables' : 'No two subjects can overlap'}</dd>
            </div>
          </dl>
        </section>
        <section className="card">
          <h2 className="card-title">Quick actions</h2>
          <p className="muted">
            Building fills the empty slots using each subject’s duration, times per week and teacher{tt.trackResources ? ', and avoids teachers who are busy in your other timetables' : ''}. Click any cell to edit it by hand.
          </p>
          {gen && gen.unplaced.length ? <Notice tone="warn">{describeUnplaced(gen.unplaced)}</Notice> : null}
          <div className="stack">
            <button type="button" className="btn btn-primary" onClick={() => build('fill')} disabled={!tt.activities.length}>
              <Wand2 size={16} aria-hidden="true" /> Build timetable from my subjects
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmRebuild(true)} disabled={!tt.activities.length}>
              <RefreshCw size={16} aria-hidden="true" /> Rebuild from scratch…
            </button>
            <button type="button" className="btn btn-soft" onClick={() => app.askAssistant(tt.id)}>
              <Sparkles size={16} aria-hidden="true" /> Edit with Scheduly AI
            </button>
          </div>
        </section>
      </div>
      {confirmRebuild ? (
        <ConfirmDialog
          title="Rebuild from scratch?"
          message={`This clears every slot in “${tt.name}” and builds the schedule again from your subjects. Anything you placed by hand will be lost.`}
          confirmLabel="Rebuild"
          danger
          onConfirm={() => build('replace')}
          onCancel={() => setConfirmRebuild(false)}
        />
      ) : null}
    </>
  )
}
