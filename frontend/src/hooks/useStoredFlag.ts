import { useCallback, useState } from 'react'

function read(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key)
    return stored === null ? fallback : stored === '1'
  } catch {
    return fallback
  }
}

/** A boolean preference that survives a reload. */
export function useStoredFlag(
  key: string,
  fallback: boolean,
): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => read(key, fallback))
  const update = useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        localStorage.setItem(key, next ? '1' : '0')
      } catch {
        // Private browsing can refuse storage. The toggle still works.
      }
    },
    [key],
  )
  return [value, update]
}
