import { useEffect, useState } from 'react'
import { saveJSON } from '../utils/storage.js'

/**
 * useState that loads once (via `load`) and writes to localStorage on every change.
 * Returns [value, setValue, saveOk]. A failed write never throws; `saveOk` becomes false instead.
 */
export function useStoredState(key, load) {
  const [value, setValue] = useState(load)
  const [saveOk, setSaveOk] = useState(true)

  useEffect(() => {
    setSaveOk(saveJSON(key, value))
  }, [key, value])

  return [value, setValue, saveOk]
}
