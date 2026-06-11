import { useMemo, useState } from 'react'

/**
 * useSortable — shared client-side column sorting for any data table.
 *
 * @param {Array}    rows        - The data array to sort (current page results).
 * @param {Function} getVal      - (row, key) => comparable primitive value.
 * @param {string}   defaultKey  - Column key to sort by on first render.
 * @param {string}   defaultDir  - 'asc' | 'desc'  (default: 'asc')
 *
 * @returns {{ sorted, toggle, icon, sortCfg }}
 *   sorted   — sorted copy of rows
 *   toggle   — (key) => void — call on header click
 *   icon     — (key) => '▲' | '▼' | '↕'
 *   sortCfg  — { key, dir } current state
 */
export function useSortable(rows, getVal, defaultKey, defaultDir = 'asc') {
  const [sortCfg, setSortCfg] = useState({ key: defaultKey, dir: defaultDir })

  const sorted = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      const av = getVal(a, sortCfg.key)
      const bv = getVal(b, sortCfg.key)
      if (av === bv) return 0
      const cmp = av > bv ? 1 : -1
      return sortCfg.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [rows, sortCfg])   // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key) =>
    setSortCfg((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    )

  const icon = (key) =>
    sortCfg.key === key ? (sortCfg.dir === 'asc' ? '▲' : '▼') : '↕'

  return { sorted, toggle, icon, sortCfg }
}
