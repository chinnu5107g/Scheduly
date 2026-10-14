import { Plus } from 'lucide-react'
import { blocksFor, computeRows, durationLabel, getActivity, slotKey } from '../utils/timetableModel.js'
import { addDays, formatRange, isSameDay } from '../utils/time.js'
import { DAYS, DAY_NAMES } from '../utils/timetableTypes.js'

/**
 * Weekly grid: days as rows, time slots as columns, break columns spanning all day rows.
 * `days` can be a subset of timetable.days (day view). Pass `onCellClick` to make cells editable.
 */
export default function TimetableGrid({ timetable: tt, days, timeFormat, weekStart, resources, onCellClick, clashKeys }) {
  const rows = computeRows(tt) // time slots, in order (kind: 'slot' | 'break')
  const visibleDays = days || tt.days
  const today = new Date()
  const slotCount = rows.filter((r) => r.kind === 'slot').length
  const allBlocks = blocksFor(tt)

  if (!rows.length) {
    return <p className="muted grid-empty">This timetable has no time slots. Check its start time, end time and slot length.</p>
  }

  const teacherName = (id) => resources?.teachers?.find((t) => t.id === id)?.name
  const roomName = (id) => resources?.rooms?.find((r) => r.id === id)?.name

  return (
    <div className="grid-scroll" tabIndex={0} role="region" aria-label={`${tt.name} weekly timetable`}>
      <table className="tt-grid" style={{ '--cols': slotCount }}>
        <thead>
          <tr>
            <th scope="col" className="tt-corner">
              Day
            </th>
            {rows.map((row) => (
              <th
                scope="col"
                key={`h-${row.kind}-${row.start}`}
                className={`tt-time${row.kind === 'break' ? ' tt-break-head' : ''}`}
              >
                {formatRange(row.start, row.end, timeFormat)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleDays.map((d, di) => {
            const date = weekStart ? addDays(weekStart, DAYS.indexOf(d)) : null
            const isToday = date ? isSameDay(date, today) : false
            const blocks = new Map(allBlocks.filter((b) => b.day === d).map((b) => [b.key, b]))
            let skip = 0 // slot columns hidden because a longer entry spans over them
            return (
              <tr key={d}>
                <th scope="row" className={`tt-day${isToday ? ' is-today' : ''}`}>
                  <span className="day-name">{d}</span>
                  {date ? <span className="day-date">{date.getDate()}</span> : null}
                </th>
                {rows.map((row) => {
                  if (row.kind === 'slot' && skip > 0) {
                    skip--
                    return null
                  }
                  if (row.kind === 'break') {
                    // One tall cell per break column, drawn on the first day row only.
                    return di === 0 ? (
                      <td key={`b-${row.start}`} rowSpan={visibleDays.length} className="tt-break-col">
                        <span>{row.label}</span>
                      </td>
                    ) : null
                  }
                  const key = slotKey(d, row.start)
                  const block = blocks.get(key)
                  const entry = block ? block.entry : null
                  const act = entry ? getActivity(tt, entry.activityId) : null
                  const span = block ? block.span : 1
                  skip = span - 1
                  const endTime = block ? block.end : row.end
                  const clash = Boolean(block && clashKeys?.has(key))
                  const meta = act
                    ? [tt.trackResources ? teacherName(entry.teacherId) : null, tt.trackResources ? roomName(entry.roomId) : null]
                        .filter(Boolean)
                        .join(' · ')
                    : ''
                  const label = act
                    ? `${DAY_NAMES[d]} ${formatRange(row.start, endTime, timeFormat)}: ${act.name}${meta ? `, ${meta}` : ''}${clash ? '. Clashes with another timetable' : ''}. Edit.`
                    : `${DAY_NAMES[d]} ${formatRange(row.start, row.end, timeFormat)}: empty. Add activity.`
                  const content = act ? (
                    <>
                      <span className="cell-name">{act.name}</span>
                      {meta ? <span className="cell-meta">{meta}</span> : null}
                      {span > 1 ? <span className="cell-meta cell-dur">{durationLabel(tt, span)}</span> : null}
                      {clash ? <span className="cell-clash">Clash</span> : null}
                      {entry.note ? <span className="cell-meta cell-note">{entry.note}</span> : null}
                    </>
                  ) : (
                    <Plus size={14} className="cell-plus" aria-hidden="true" />
                  )
                  const style = act ? { '--act': act.color } : undefined
                  return (
                    <td key={row.start} colSpan={span > 1 ? span : undefined}>
                      {onCellClick ? (
                        <button
                          type="button"
                          className={`cell${act ? ' filled' : ' empty'}${clash ? ' has-clash' : ''}`}
                          style={style}
                          aria-label={label}
                          onClick={() => onCellClick(d, row)}
                        >
                          {content}
                        </button>
                      ) : (
                        <div className={`cell${act ? ' filled' : ' empty'}${clash ? ' has-clash' : ''}`} style={style}>
                          {content}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
