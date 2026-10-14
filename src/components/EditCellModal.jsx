import { useId, useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import ResourcePicker, { NEW, resolvePick } from './ResourcePicker.jsx'
import { useApp } from '../AppContext.js'
import {
  actSpan,
  durationLabel,
  durationSpans,
  getActivity,
  makeActivities,
  placementWindow,
  slotKey,
  slotRows,
} from '../utils/timetableModel.js'
import { describeBooking, busyDuring } from '../utils/timetableValidation.js'
import { formatRange } from '../utils/time.js'
import { DAY_NAMES } from '../utils/timetableTypes.js'

/**
 * Edit or add one entry: subject, how long it lasts, teacher, room, note, and its day/time.
 * Teacher and room clashes with every other active timetable are checked live and block saving.
 */
export default function EditCellModal({ timetable: tt, day, row, resources, timeFormat, onSave, onClose }) {
  const app = useApp()
  const key = slotKey(day, row.start)
  const entry = tt.slots[key]
  const current = entry ? getActivity(tt, entry.activityId) : null
  const teachers = resources?.teachers || []
  const rooms = resources?.rooms || []

  const [name, setName] = useState(current ? current.name : '')
  const [span, setSpan] = useState(entry ? Math.max(1, Number(entry.span) || 1) : 1)
  const [teacherSel, setTeacherSel] = useState(entry?.teacherId || '')
  const [teacherNew, setTeacherNew] = useState('')
  const [roomSel, setRoomSel] = useState(entry?.roomId || '')
  const [roomNew, setRoomNew] = useState('')
  const [note, setNote] = useState(entry?.note || '')
  const [moveDay, setMoveDay] = useState(day)
  const [moveStart, setMoveStart] = useState(row.start)
  const [error, setError] = useState('')

  const ids = { name: useId(), note: useId(), span: useId(), day: useId(), time: useId(), list: useId() }
  const rows = slotRows(tt)
  const ownKey = entry ? key : null

  const teacher = resolvePick(teachers, teacherSel, teacherNew)
  const room = resolvePick(rooms, roomSel, roomNew)

  const win = useMemo(() => placementWindow(tt, moveDay, moveStart, span, ownKey), [tt, moveDay, moveStart, span, ownKey])

  // Who is already busy at the chosen day and time (in any other active timetable)?
  const busy = useMemo(() => {
    if (!win.ok || !tt.trackResources) return { teachers: {}, rooms: {} }
    return busyDuring(app.timetables, app.constraints, { day: moveDay, startMin: win.startMin, endMin: win.endMin }, { timetableId: tt.id, key })
  }, [win, tt.trackResources, tt.id, key, moveDay, app.timetables, app.constraints])

  const busyText = (b) => describeBooking(b, timeFormat)
  const busyTeachers = Object.fromEntries(Object.entries(busy.teachers).map(([id, b]) => [id, busyText(b)]))
  const busyRooms = Object.fromEntries(Object.entries(busy.rooms).map(([id, b]) => [id, busyText(b)]))

  const teacherClash = teacher.id && busy.teachers[teacher.id]
  const roomClash = room.id && busy.rooms[room.id]

  const onName = (value) => {
    setName(value)
    setError('')
    // Picking an existing subject brings its usual duration and teacher with it.
    const match = tt.activities.find((a) => a.name.toLowerCase() === value.trim().toLowerCase())
    if (match && !current) {
      setSpan(actSpan(match))
      if (match.teacherId && teachers.some((t) => t.id === match.teacherId)) setTeacherSel(match.teacherId)
    }
  }

  const save = (e) => {
    e.preventDefault()
    const activityName = name.trim()
    if (!activityName) return setError(entry ? 'Enter a subject, or use “Clear slot”.' : 'Enter a subject to add.')
    if (activityName.length > 60) return setError('Keep the subject name under 60 characters.')
    if (!win.ok) return setError(win.reason)
    if (tt.trackResources) {
      if (teacherSel === NEW && teacher.empty) return setError('Type the new teacher’s name, or choose one from the list.')
      if (!teacher.id && !teacher.create) return setError('Choose a teacher (or add one) so Scheduly can check for clashes.')
      if (roomSel === NEW && room.empty) return setError('Type the new room’s name, or choose one from the list.')
      if (teacherClash) return setError(`${teachers.find((t) => t.id === teacher.id)?.name || 'This teacher'} is already busy then: ${busyText(busy.teachers[teacher.id])}.`)
      if (roomClash) return setError(`${rooms.find((r) => r.id === room.id)?.name || 'This room'} is already booked then: ${busyText(busy.rooms[room.id])}.`)
    }

    const teacherId = tt.trackResources ? teacher.id || (teacher.create ? app.addResource('teachers', teacher.create) : null) : null
    const roomId = tt.trackResources ? room.id || (room.create ? app.addResource('rooms', room.create) : null) : null

    let activities = tt.activities
    let act = activities.find((a) => a.name.toLowerCase() === activityName.toLowerCase())
    if (!act) {
      activities = makeActivities([activityName], activities)
      act = activities[activities.length - 1]
      const extra = { ...(span > 1 ? { span } : {}), ...(teacherId ? { teacherId } : {}) }
      activities = activities.map((a) => (a.id === act.id ? { ...a, ...extra } : a))
      act = activities.find((a) => a.id === act.id)
    } else if (teacherId && !act.teacherId) {
      activities = activities.map((a) => (a.id === act.id ? { ...a, teacherId } : a))
    }

    const next = { activityId: act.id }
    if (span > 1) next.span = span
    if (note.trim()) next.note = note.trim().slice(0, 200)
    if (teacherId) next.teacherId = teacherId
    if (roomId) next.roomId = roomId

    const slots = { ...tt.slots }
    delete slots[key]
    slots[slotKey(moveDay, moveStart)] = next
    onSave({ ...tt, activities, slots })
  }

  const clear = () => {
    const slots = { ...tt.slots }
    delete slots[key]
    onSave({ ...tt, slots })
  }

  return (
    <Modal
      title={entry ? 'Edit slot' : 'Add to slot'}
      description={`${DAY_NAMES[day]} · ${formatRange(row.start, row.end, timeFormat)}`}
      onClose={onClose}
      footer={
        <>
          {entry ? (
            <button type="button" className="btn btn-ghost-danger push-left" onClick={clear}>
              Clear slot
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-cell-form" className="btn btn-primary">
            Save
          </button>
        </>
      }
    >
      <form id="edit-cell-form" onSubmit={save} noValidate className="form-grid">
        <div className="field span-2">
          <label htmlFor={ids.name}>1. Subject / activity</label>
          <input
            id={ids.name}
            className="input"
            list={ids.list}
            value={name}
            maxLength={70}
            data-autofocus
            placeholder="e.g. Mathematics"
            aria-invalid={Boolean(error) && !name.trim()}
            onChange={(e) => onName(e.target.value)}
          />
          <datalist id={ids.list}>
            {tt.activities.map((a) => (
              <option key={a.id} value={a.name} />
            ))}
          </datalist>
          <p className="hint">Pick one of this timetable’s subjects, or type a new name to add it.</p>
        </div>

        <div className="field span-2">
          <label htmlFor={ids.span}>2. How long does it last?</label>
          <select
            id={ids.span}
            className="input"
            value={span}
            onChange={(e) => {
              setSpan(Number(e.target.value))
              setError('')
            }}
          >
            {durationSpans(tt).map((s) => {
              const ok = placementWindow(tt, moveDay, moveStart, s, ownKey).ok
              return (
                <option key={s} value={s} disabled={!ok && s !== span}>
                  {durationLabel(tt, s)}
                  {s > 1 ? ` (${s} slots)` : ''}
                  {!ok ? ' — no room here' : ''}
                </option>
              )
            })}
          </select>
          <p className="hint">
            {win.ok ? `Runs ${formatRange(win.start, win.end, timeFormat)}.` : win.reason}
          </p>
        </div>

        {tt.trackResources ? (
          <>
            <div className="span-2 field-pair">
              <ResourcePicker
                label="3. Teacher"
                noun="teacher"
                items={teachers}
                value={teacherSel}
                newName={teacherNew}
                busy={busyTeachers}
                invalid={Boolean(error) && !teacher.id && !teacher.create}
                onChange={(v) => {
                  setTeacherSel(v)
                  setError('')
                }}
                onNewName={setTeacherNew}
              />
              <ResourcePicker
                label="Room (optional)"
                noun="room"
                items={rooms}
                value={roomSel}
                newName={roomNew}
                busy={busyRooms}
                onChange={(v) => {
                  setRoomSel(v)
                  setError('')
                }}
                onNewName={setRoomNew}
              />
            </div>
            <p className="hint span-2">
              Teachers and rooms already busy at this time in another timetable are greyed out, so a clash can’t be saved.
            </p>
          </>
        ) : null}

        <div className="field span-2">
          <label htmlFor={ids.note}>Note (optional)</label>
          <input id={ids.note} className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </div>

        <fieldset className="field span-2 fieldset-inline">
          <legend>Day and start time</legend>
          <div className="form-grid">
            <div className="field">
              <label htmlFor={ids.day}>Day</label>
              <select id={ids.day} className="input" value={moveDay} onChange={(e) => { setMoveDay(e.target.value); setError('') }}>
                {tt.days.map((d) => (
                  <option key={d} value={d}>
                    {DAY_NAMES[d]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={ids.time}>Starts at</label>
              <select id={ids.time} className="input" value={moveStart} onChange={(e) => { setMoveStart(e.target.value); setError('') }}>
                {rows.map((r) => (
                  <option key={r.start} value={r.start}>
                    {formatRange(r.start, r.end, timeFormat)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="hint">Change these to move the entry. Breaks are not available.</p>
        </fieldset>

        {error ? (
          <p className="field-error span-2" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}
