import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { EmptyState, Notice, PageHeader } from '../components/ui.jsx'
import { useApp } from '../AppContext.js'
import { getActivity, slotRows, slotKey } from '../utils/timetableModel.js'
import { addDays, formatRange, formatWeekRange, isSameDay, startOfWeek } from '../utils/time.js'
import { DAYS, DAY_NAMES } from '../utils/timetableTypes.js'

/** Agenda-style week: merges the entries of the chosen timetables into one list per day. */
export default function CalendarView() {
  const app = useApp()
  const live = app.timetables.filter((t) => t.status !== 'Archived')
  const [offset, setOffset] = useState(0)
  const [picked, setPicked] = useState(null) // null = all non-archived
  const selected = picked ?? live.map((t) => t.id)
  const weekStart = startOfWeek(new Date(), offset)
  const today = new Date()

  const toggle = (id) => setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  const week = useMemo(() => {
    return DAYS.map((day, i) => {
      const items = []
      for (const tt of live) {
        if (!selected.includes(tt.id) || !tt.days.includes(day)) continue
        for (const row of slotRows(tt)) {
          const entry = tt.slots[slotKey(day, row.start)]
          const act = entry ? getActivity(tt, entry.activityId) : null
          if (act) items.push({ tt, act, entry, row })
        }
      }
      items.sort((a, b) => a.row.start.localeCompare(b.row.start))
      return { day, date: addDays(weekStart, i), items }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.timetables, picked, offset])

  return (
    <>
      <PageHeader title="Calendar View" subtitle="See the entries of several timetables together, day by day." />
      {live.length === 0 ? (
        <EmptyState icon={<CalendarDays size={26} aria-hidden="true" />} title="Nothing to show yet">
          Create a timetable and its entries will appear here.
        </EmptyState>
      ) : (
        <>
          <div className="card cal-controls">
            <fieldset className="check-group">
              <legend>Show timetables</legend>
              {live.map((t) => (
                <label key={t.id} className="check">
                  <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                  <span>{t.name}</span>
                </label>
              ))}
            </fieldset>
            <div className="week-nav" role="group" aria-label="Week navigation">
              <button type="button" className="icon-btn bordered" onClick={() => setOffset((o) => o - 1)} aria-label="Previous week">
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOffset(0)} disabled={offset === 0}>
                This week
              </button>
              <span className="week-label" aria-live="polite">
                {formatWeekRange(weekStart)}
              </span>
              <button type="button" className="icon-btn bordered" onClick={() => setOffset((o) => o + 1)} aria-label="Next week">
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="agenda">
            {week.map(({ day, date, items }) => (
              <section key={day} className={`agenda-day${isSameDay(date, today) ? ' is-today' : ''}`} aria-label={DAY_NAMES[day]}>
                <header>
                  <strong>{day}</strong>
                  <span>{date.getDate()}</span>
                </header>
                {items.length ? (
                  <ul>
                    {items.map(({ tt, act, row }) => (
                      <li key={`${tt.id}-${row.start}`} style={{ '--act': act.color }}>
                        <button type="button" onClick={() => app.openTimetable(tt.id)} title={`Open ${tt.name}`}>
                          <span className="agenda-time">{formatRange(row.start, row.end, app.settings.timeFormat)}</span>
                          <span className="agenda-name">{act.name}</span>
                          <span className="agenda-tt">{tt.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted agenda-empty">Free</p>
                )}
              </section>
            ))}
          </div>
          <Notice tone="warn">
            Entries from different timetables are shown together. Teacher and room clashes are flagged on each timetable’s own page and in the Constraints page.
          </Notice>
        </>
      )}
    </>
  )
}
