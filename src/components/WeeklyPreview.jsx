import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import TimetableGrid from './TimetableGrid.jsx'
import EditCellModal from './EditCellModal.jsx'
import TypeIcon from './TypeIcon.jsx'
import { EmptyState, Notice, Segmented, StatusBadge, ValidationBadge } from './ui.jsx'
import { activityUsage, sortDays } from '../utils/timetableModel.js'
import { formatWeekRange, startOfWeek } from '../utils/time.js'
import { DAY_NAMES, getType } from '../utils/timetableTypes.js'
import { clashKeysFor, conflictsFor, describeConflict, getValidationNotice } from '../utils/timetableValidation.js'
import { useApp } from '../AppContext.js'

function Legend({ timetable }) {
  const usage = activityUsage(timetable)
  if (!timetable.activities.length) {
    return <p className="muted legend-empty">No activities yet. Click an empty cell to add one.</p>
  }
  return (
    <ul className="legend" aria-label="Colour legend">
      {timetable.activities.map((a) => (
        <li key={a.id}>
          <span className="legend-dot" style={{ background: a.color }} aria-hidden="true" />
          <span>{a.name}</span>
          <small>{usage[a.id] || 0}×/week</small>
        </li>
      ))}
      <li>
        <span className="legend-dot legend-break" aria-hidden="true" />
        <span>Break</span>
      </li>
    </ul>
  )
}

/**
 * Weekly preview with a timetable selector, week controls, week/day toggle, legend and cell editing.
 * `fixedId` hides the selector (used on a timetable's own page).
 */
export default function WeeklyPreview({
  timetables,
  resources,
  timeFormat,
  selectedId,
  onSelect,
  fixedId,
  onUpdate,
  onOpenFull,
  notify,
}) {
  const { conflicts } = useApp()
  const timetable = useMemo(() => {
    const id = fixedId || selectedId
    return timetables.find((t) => t.id === id) || timetables[0] || null
  }, [timetables, selectedId, fixedId])

  const [weekOffset, setWeekOffset] = useState(0)
  const [mode, setMode] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 720px)').matches ? 'day' : 'week',
  )
  const [dayIndex, setDayIndex] = useState(0)
  const [editing, setEditing] = useState(null)

  const days = timetable ? sortDays(timetable.days) : []
  useEffect(() => {
    if (dayIndex >= days.length) setDayIndex(0)
  }, [days.length, dayIndex])

  if (!timetable) {
    return (
      <EmptyState icon={<CalendarDays size={26} aria-hidden="true" />} title="No timetable to preview">
        Create a timetable and its weekly schedule will appear here.
      </EmptyState>
    )
  }

  const weekStart = startOfWeek(new Date(), weekOffset)
  const visibleDays = mode === 'day' ? [days[dayIndex] || days[0]] : days
  const type = getType(timetable.type)

  const saveCell = (next) => {
    onUpdate(timetable.id, () => next)
    setEditing(null)
    notify?.(`Updated “${timetable.name}”.`, { silent: true })
  }

  return (
    <section className="card weekly" aria-label="Weekly timetable preview">
      <div className="weekly-head">
        <div className="weekly-title">
          <span className={`type-chip small type-${timetable.type}`}>
            <TypeIcon type={timetable.type} size={16} />
          </span>
          {fixedId ? (
            <h2>{timetable.name}</h2>
          ) : (
            <>
              <label htmlFor="weekly-select" className="sr-only">
                Timetable to preview
              </label>
              <select
                id="weekly-select"
                className="input select-title"
                value={timetable.id}
                onChange={(e) => onSelect(e.target.value)}
              >
                {timetables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <div className="weekly-badges">
            <StatusBadge status={timetable.status} />
            <ValidationBadge timetable={timetable} />
          </div>
        </div>

        <div className="weekly-controls">
          <div className="week-nav" role="group" aria-label="Week navigation">
            <button type="button" className="icon-btn bordered" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
              This week
            </button>
            <span className="week-label" aria-live="polite">
              {formatWeekRange(weekStart)}
            </span>
            <button type="button" className="icon-btn bordered" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week">
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <Segmented
            label="Grid layout"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'week', label: 'Week' },
              { value: 'day', label: 'Day' },
            ]}
          />
          {onOpenFull ? (
            <button type="button" className="btn btn-soft btn-sm" onClick={() => onOpenFull(timetable.id)}>
              <Maximize2 size={15} aria-hidden="true" /> Full timetable
            </button>
          ) : null}
        </div>
      </div>

      {mode === 'day' && days.length > 1 ? (
        <div className="day-tabs" role="tablist" aria-label="Choose day">
          {days.map((d, i) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={i === dayIndex}
              className={i === dayIndex ? 'active' : ''}
              onClick={() => setDayIndex(i)}
              title={DAY_NAMES[d]}
            >
              {d}
            </button>
          ))}
        </div>
      ) : null}

      <TimetableGrid
        timetable={timetable}
        days={visibleDays}
        timeFormat={timeFormat}
        weekStart={weekStart}
        resources={resources}
        clashKeys={clashKeysFor(conflicts, timetable.id)}
        onCellClick={(day, row) => setEditing({ day, row })}
      />

      <Legend timetable={timetable} />

      {conflictsFor(conflicts, timetable.id).length ? (
        <Notice tone="warn">
          <strong>Clashes with other timetables</strong>
          <ul className="clash-list">
            {conflictsFor(conflicts, timetable.id).map((c) => (
              <li key={c.id}>{describeConflict(c, resources, timeFormat)}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      <Notice tone="info">
        <strong>{timetable.origin === 'demo' ? 'Demonstration schedule. ' : ''}</strong>
        {getValidationNotice(timetable)} {type.short} timetables repeat every week.
      </Notice>

      {editing ? (
        <EditCellModal
          key={`${editing.day}|${editing.row.start}`}
          timetable={timetable}
          day={editing.day}
          row={editing.row}
          resources={resources}
          timeFormat={timeFormat}
          onSave={saveCell}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  )
}
