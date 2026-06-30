import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'

export type CellType = 'text' | 'number' | 'select' | 'date' | 'check'

export interface SheetColumn<T> {
  key: string
  label: string
  type: CellType
  width?: number
  options?: readonly string[]
  align?: 'left' | 'center' | 'right'
  get: (row: T) => string | number | boolean
  set: (value: string | number | boolean, row: T) => Partial<T>
  color?: (row: T) => string | undefined
  readOnly?: boolean
  visible?: boolean
  /** ヘッダーに表示するアイコン画像URL */
  headerIcon?: string
  /** ヘッダーの背景色（ライセンス列のカテゴリ色など） */
  headerBg?: string
  /** アイコン右下に表示する小バッジ文字列（例: "B", "Pro"） */
  headerBadge?: string
  /** バッジの背景色 */
  headerBadgeBg?: string
  /** ヘッダーのアーカイブボタンが押されたときのコールバック */
  onArchive?: () => void
}

export interface SheetOption {
  value: string
  label: string
}

export interface SheetFilter<T> {
  key: string
  label: string
  allLabel: string
  options: readonly SheetOption[]
  predicate: (row: T, value: string) => boolean
}

export interface SheetSorter<T> {
  key: string
  label: string
  compare: (a: T, b: T) => number
}

export interface SheetGroup<T> {
  key: string
  label: string
  getValues: (row: T) => string | string[]
}

export interface SheetConfig<T> {
  columns: SheetColumn<T>[]
  getId: (row: T) => number
  rowLabel: (row: T) => string
  blank?: () => Omit<T, 'id'>
  searchText?: (row: T) => string
  freeze?: number
  filters?: readonly SheetFilter<T>[]
  sorters?: readonly SheetSorter<T>[]
  groups?: readonly SheetGroup<T>[]
  defaultSort?: string
  toolbarActions?: ReactNode
  filterControls?: ReactNode
  rowPredicate?: (row: T) => boolean
}

const ROWNUM_W = 44
const ACTION_W = 52

export default function SheetEditor<T>({
  rows,
  config,
  onUpdate,
  onAdd,
  onRemove,
}: {
  rows: T[]
  config: SheetConfig<T>
  onUpdate: (id: number, patch: Partial<T>) => void
  onAdd?: (row: Omit<T, 'id'>) => void
  onRemove?: (id: number) => void
}) {
  const { columns, getId, rowLabel, blank, searchText } = config
  const freeze = config.freeze ?? 1
  const filterDefs = config.filters ?? []
  const sorterDefs = config.sorters ?? []
  const groupDefs = config.groups ?? []
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortKey, setSortKey] = useState(config.defaultSort ?? sorterDefs[0]?.key ?? '')
  const [groupKey, setGroupKey] = useState('')
  const visibleColumns = columns.filter((c) => c.visible !== false)

  const visible = useMemo(() => {
    const kw = q.trim().toLowerCase()
    const sorter = sorterDefs.find((s) => s.key === sortKey)
    const list = rows.filter((r) => {
      if (config.rowPredicate && !config.rowPredicate(r)) return false
      if (kw && searchText && !searchText(r).toLowerCase().includes(kw)) return false
      return filterDefs.every((f) => {
        const v = filters[f.key]
        return !v || f.predicate(r, v)
      })
    })
    if (!sorter) return list
    return [...list].sort(sorter.compare)
  }, [rows, q, searchText, filters, filterDefs, sortKey, sorterDefs, config])

  const grouped = useMemo(() => {
    const group = groupDefs.find((g) => g.key === groupKey)
    if (!group) return null
    const map = new Map<string, T[]>()
    for (const row of visible) {
      const values = group.getValues(row)
      const keys = Array.isArray(values) ? values : [values]
      for (const raw of keys.length ? keys : ['未分類']) {
        const key = raw || '未分類'
        const bucket = map.get(key) ?? []
        bucket.push(row)
        map.set(key, bucket)
      }
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'ja'))
  }, [visible, groupDefs, groupKey])

  const activeFilterCount = Object.values(filters).filter(Boolean).length
  const shownRowCount = grouped ? grouped.reduce((sum, [, rs]) => sum + rs.length, 0) : visible.length

  const leftOf = (idx: number) => {
    let x = ROWNUM_W
    for (let i = 0; i < idx; i++) x += visibleColumns[i].width ?? 140
    return x
  }

  const renderRow = (row: T, index: number, keySuffix = '') => {
    const id = getId(row)
    return (
      <tr key={`${id}${keySuffix}`}>
        <td className="sheet-rownum sheet-freeze" style={{ left: 0, width: ROWNUM_W }}>
          {index + 1}
        </td>
        {visibleColumns.map((c, i) => {
          const frozen = i < freeze
          return (
            <td
              key={c.key}
              className={'sheet-cell' + (frozen ? ' sheet-freeze' : '')}
              style={{
                width: c.width,
                minWidth: c.width,
                ...(frozen ? { left: leftOf(i) } : null),
              }}
            >
              <Cell row={row} col={c} onCommit={(patch) => onUpdate(id, patch)} />
            </td>
          )
        })}
        {onRemove && (
          <td className="sheet-cell sheet-actions">
            <button
              className="sheet-del"
              title="この行を削除"
              onClick={() => {
                if (confirm(`「${rowLabel(row)}」を削除しますか？`)) onRemove(id)
              }}
            >
              🗑
            </button>
          </td>
        )}
      </tr>
    )
  }

  return (
    <div>
      <div className="toolbar sheet-toolbar">
        <div className="sheet-filter-row">
          {searchText && (
            <div className="search sheet-search">
              <span>🔍</span>
              <input placeholder="検索" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          {filterDefs.map((f) => (
            <label key={f.key} className="sheet-control">
              <span>{f.label}</span>
              <select
                className="filter"
                value={filters[f.key] ?? ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
              >
                <option value="">{f.allLabel}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          ))}
          {config.filterControls}
          {sorterDefs.length > 0 && (
            <label className="sheet-control">
              <span>並び替え</span>
              <select className="filter" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                {sorterDefs.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </label>
          )}
          {groupDefs.length > 0 && (
            <label className="sheet-control">
              <span>表示単位</span>
              <select className="filter" value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
                <option value="">通常表示</option>
                {groupDefs.map((g) => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="sheet-toolbar-actions">
          <span className="sheet-hint">
            {shownRowCount} 行を表示中（全 {rows.length} 行）{activeFilterCount > 0 && ` / 絞り込み ${activeFilterCount} 件`}
          </span>
          {config.toolbarActions}
          {blank && onAdd && (
            <button className="btn primary" onClick={() => onAdd(blank())}>
              + 1行を追加
            </button>
          )}
        </div>
      </div>

      <div className="sheet-wrap">
        <table className="sheet">
          <thead>
            <tr>
              <th className="sheet-rownum sheet-freeze" style={{ left: 0, width: ROWNUM_W }}>
                #
              </th>
              {visibleColumns.map((c, i) => {
                const frozen = i < freeze
                const isTool = !!(c.headerIcon || c.headerBg || c.onArchive)
                return (
                  <th
                    key={c.key}
                    className={(frozen ? 'sheet-freeze' : '') + (isTool ? ' sheet-th-tool' : '')}
                    style={{
                      width: c.width,
                      minWidth: c.width,
                      textAlign: isTool ? 'center' : (c.align ?? 'left'),
                      ...(frozen ? { left: leftOf(i) } : null),
                      ...(c.headerBg ? { borderTop: `3px solid ${c.headerBg}` } : null),
                    }}
                    title={c.label}
                  >
                    {isTool ? (
                      <div className="sheet-th-inner">
                        <div className="sheet-th-icon-wrap">
                          {c.headerIcon
                            ? <img src={c.headerIcon} alt={c.label} className="sheet-th-icon" />
                            : <span className="sheet-th-fallback">{c.label.slice(0, 1)}</span>
                          }
                          {c.headerBadge && (
                            <span
                              className="sheet-th-badge"
                              style={{ background: c.headerBadgeBg ?? c.headerBg ?? '#64748b' }}
                            >
                              {c.headerBadge}
                            </span>
                          )}
                        </div>
                        {c.onArchive && (
                          <button
                            className="sheet-th-archive"
                            title="アーカイブして非表示にする"
                            onClick={(e) => { e.stopPropagation(); c.onArchive!() }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    ) : c.label}
                  </th>
                )
              })}
              {onRemove && <th className="sheet-actions-h" style={{ width: ACTION_W }} />}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + (onRemove ? 2 : 1)}>
                  <div className="empty">該当する行がありません</div>
                </td>
              </tr>
            )}
            {grouped ? (() => {
              let rowIndex = 0
              return grouped.map(([label, groupRows]) => (
                <Fragment key={`group:${label}`}>
                  <tr className="sheet-group-row">
                    <td colSpan={visibleColumns.length + (onRemove ? 2 : 1)}>
                      <span>{label}</span>
                      <b>{groupRows.length} 行</b>
                    </td>
                  </tr>
                  {groupRows.map((row) => renderRow(row, rowIndex++, `:${label}`))}
                </Fragment>
              ))
            })() : visible.map((row, ri) => renderRow(row, ri))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Cell<T>({
  row,
  col,
  onCommit,
}: {
  row: T
  col: SheetColumn<T>
  onCommit: (patch: Partial<T>) => void
}) {
  const raw = col.get(row)

  if (col.readOnly) {
    return <div className="sheet-ro">{String(raw ?? '')}</div>
  }

  if (col.type === 'check') {
    const on = Boolean(raw)
    const c = col.color?.(row)
    return (
      <div
        className={'sheet-check' + (on ? ' on' : '')}
        style={on && c ? { background: c + '20', borderColor: c, color: c } : undefined}
        onClick={() => onCommit(col.set(!on, row))}
        role="checkbox"
        aria-checked={on}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            onCommit(col.set(!on, row))
          }
        }}
      >
        {on ? '✓' : ''}
      </div>
    )
  }

  if (col.type === 'select') {
    return (
      <select
        className="sheet-input"
        value={String(raw ?? '')}
        style={{ textAlign: col.align ?? 'left' }}
        onChange={(e) => onCommit(col.set(e.target.value, row))}
      >
        {col.options?.map((o) => (
          <option key={o} value={o}>
            {o === '' ? '-' : o}
          </option>
        ))}
      </select>
    )
  }

  return (
    <BufferedInput
      type={col.type}
      value={raw}
      align={col.align}
      onCommit={(v) => onCommit(col.set(v, row))}
    />
  )
}

function BufferedInput({
  type,
  value,
  align,
  onCommit,
}: {
  type: 'text' | 'number' | 'date'
  value: string | number | boolean
  align?: 'left' | 'center' | 'right'
  onCommit: (v: string | number) => void
}) {
  const [buf, setBuf] = useState<string>(String(value ?? ''))
  const [focus, setFocus] = useState(false)

  useEffect(() => {
    if (!focus) setBuf(String(value ?? ''))
  }, [value, focus])

  const commit = () => {
    if (type === 'number') {
      const n = Number(buf)
      onCommit(Number.isFinite(n) ? n : 0)
    } else {
      onCommit(buf)
    }
  }

  return (
    <input
      className="sheet-input"
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      value={buf}
      style={{ textAlign: align ?? (type === 'number' ? 'right' : 'left') }}
      onChange={(e) => setBuf(e.target.value)}
      onFocus={() => setFocus(true)}
      onBlur={() => {
        setFocus(false)
        commit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setBuf(String(value ?? ''))
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}