import { useCallback, useEffect, useRef } from 'react'
import { useStoredState } from './useStoredState.js'
import { KEYS, loadTimetables } from '../utils/storage.js'
import { duplicateTimetable, makeTimetable, uid } from '../utils/timetableModel.js'

/**
 * All timetable records. Each record is independent: its configuration and its schedule
 * live together and are only ever changed through these functions.
 */
export function useTimetables() {
  const [timetables, setTimetables, saveOk] = useStoredState(KEYS.timetables, loadTimetables)
  const latest = useRef(timetables)
  useEffect(() => {
    latest.current = timetables
  }, [timetables])

  const add = useCallback(
    (timetable) => {
      setTimetables((list) => [timetable, ...list.filter((t) => t.id !== timetable.id)])
      return timetable
    },
    [setTimetables],
  )

  const create = useCallback((config) => add(makeTimetable({ ...config, id: uid('tt') })), [add])

  /** Apply a patch object or an (old) => new function. Always bumps updatedAt. */
  const update = useCallback(
    (id, patch) => {
      setTimetables((list) =>
        list.map((t) => {
          if (t.id !== id) return t
          const next = typeof patch === 'function' ? patch(t) : { ...t, ...patch }
          return { ...next, id: t.id, updatedAt: Date.now() }
        }),
      )
    },
    [setTimetables],
  )

  /** Replace a whole record as-is (used for assistant edits that already set updatedAt). */
  const replace = useCallback(
    (timetable) => {
      setTimetables((list) => list.map((t) => (t.id === timetable.id ? timetable : t)))
    },
    [setTimetables],
  )

  const remove = useCallback(
    (id) => {
      setTimetables((list) => list.filter((t) => t.id !== id))
    },
    [setTimetables],
  )

  const duplicate = useCallback(
    (id) => {
      const source = latest.current.find((t) => t.id === id)
      if (!source) return null
      const copy = duplicateTimetable(source)
      setTimetables((list) => [copy, ...list])
      return copy
    },
    [setTimetables],
  )

  const replaceAll = useCallback((list) => setTimetables(list), [setTimetables])

  return { timetables, saveOk, add, create, update, replace, remove, duplicate, replaceAll }
}
