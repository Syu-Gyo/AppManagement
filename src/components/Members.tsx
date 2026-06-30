import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { CATEGORY_COLORS, metaOf } from '../data/software'
import { avatarColor, initials } from '../utils'
import type { Member } from '../data/types'

export default function Members({ onOpen, selectedMemberId }: { onOpen: (m: Member) => void; selectedMemberId?: number | null }) {
  const { members, software } = useStore()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [sw, setSw] = useState('')
  const [grouped, setGrouped] = useState(true)

  const depts = useMemo(
    () => [...new Set(members.map((m) => m.department).filter(Boolean))].sort(),
    [members],
  )

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return members.filter((m) => {
      if (dept && m.department !== dept) return false
      if (sw && !m.licenses.includes(sw)) return false
      if (kw) {
        const hay = [m.name, m.department, m.section].join(' ').toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [members, q, dept, sw])

  const groups = useMemo(() => {
    const map = new Map<string, Member[]>()
    for (const m of filtered) {
      const k = m.department || '未所属'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(m)
    }
    return [...map.entries()].map(([name, ms]) => ({
      name,
      members: ms,
      licenses: ms.reduce((s, m) => s + m.licenses.length, 0),
    }))
  }, [filtered])

  const displayOrder = useMemo(
    () => (grouped ? groups.flatMap((g) => g.members) : filtered),
    [grouped, groups, filtered],
  )

  const scrollModeRef = useRef<'nearest' | 'top'>('nearest')

  useEffect(() => {
    if (!selectedMemberId || displayOrder.length === 0) return

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tagName = target?.tagName
      if (tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA' || target?.isContentEditable) return
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const currentIndex = displayOrder.findIndex((m) => m.id === selectedMemberId)
        if (currentIndex < 0) return
        const next = displayOrder[currentIndex + (e.key === 'ArrowUp' ? -1 : 1)]
        if (!next) return
        e.preventDefault()
        scrollModeRef.current = 'nearest'
        onOpen(next)
        return
      }

      // ← → : 部署ジャンプ（グループ表示時のみ）
      if (!grouped || groups.length === 0) return
      const groupIdx = groups.findIndex((g) => g.members.some((m) => m.id === selectedMemberId))
      if (groupIdx < 0) return
      const nextGroupIdx = groupIdx + (e.key === 'ArrowLeft' ? -1 : 1)
      const nextGroup = groups[nextGroupIdx]
      if (!nextGroup) return
      e.preventDefault()
      scrollModeRef.current = 'top'
      onOpen(nextGroup.members[0])
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [displayOrder, groups, grouped, onOpen, selectedMemberId])

  useEffect(() => {
    if (!selectedMemberId) return
    const row = document.querySelector<HTMLTableRowElement>(`tr[data-member-id="${selectedMemberId}"]`)
    if (!row) return

    if (scrollModeRef.current === 'top') {
      scrollModeRef.current = 'nearest'
      const scroller = document.querySelector<HTMLElement>('.main')
      if (scroller) {
        const scrollerRect = scroller.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()
        const PADDING = 80
        const target = scroller.scrollTop + (rowRect.top - scrollerRect.top) - PADDING
        scroller.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
      }
    } else {
      row.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedMemberId])

  function row(m: Member) {
    const selected = m.id === selectedMemberId
    return (
      <tr
        key={m.id}
        data-member-id={m.id}
        className={selected ? 'member-row selected' : 'member-row'}
        aria-selected={selected}
        onClick={() => onOpen(m)}
      >
        <td>
          <div className="person-cell">
            <div className="avatar" style={{ background: avatarColor(m.name) }}>{initials(m.name)}</div>
            <div>
              <div className="person-name">{m.name}</div>
              <div className="person-mail">{m.section || m.department || '—'}</div>
            </div>
          </div>
        </td>
        <td>{m.department || <span className="muted">—</span>}</td>
        <td><span className="muted">{m.section || '—'}</span></td>
        <td>
          <div className="lic-chips">
            {m.licenses.length === 0 && <span className="muted">なし</span>}
            {m.licenses.map((l) => (
              <span key={l} className="lic-chip" style={{ background: CATEGORY_COLORS[metaOf(l).category] }}>{l}</span>
            ))}
          </div>
        </td>
        <td style={{ textAlign: 'center' }}>
          <span className="count-pill">{m.licenses.length}</span>
        </td>
      </tr>
    )
  }

  return (
    <div>
      <div className="toolbar">
        <div className="search">
          <span>🔍</span>
          <input
            placeholder="名前・部署で検索…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="filter" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">すべての部署</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="filter" value={sw} onChange={(e) => setSw(e.target.value)}>
          <option value="">すべてのソフト</option>
          {software.map((s) => <option key={s} value={s}>{s} 利用者</option>)}
        </select>
        <button className={'btn' + (grouped ? ' primary' : '')} onClick={() => setGrouped((g) => !g)}>
          {grouped ? '✓ 部署で区切る' : '部署で区切る'}
        </button>
        <button className="btn" onClick={() => { setQ(''); setDept(''); setSw('') }}>クリア</button>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>
        {filtered.length} 名を表示中（全 {members.length} 名）{grouped && ' · ' + groups.length + ' 部署'}
      </div>

      <div className="table-wrap">
        <table className="members-table">
          <thead>
            <tr>
              <th style={{ width: '26%' }}>メンバー</th>
              <th style={{ width: '16%' }}>部署</th>
              <th style={{ width: '12%' }}>課</th>
              <th>ライセンス</th>
              <th style={{ width: 70, textAlign: 'center' }}>件数</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5}><div className="empty">該当するメンバーがいません</div></td></tr>
            )}
            {grouped
              ? groups.map((g) => (
                  <Fragment key={g.name}>
                    <tr className="group-row">
                      <td colSpan={5}>
                        🏢 {g.name}
                        <span className="group-meta">{g.members.length} 名 · ライセンス {g.licenses} 件</span>
                      </td>
                    </tr>
                    {g.members.map(row)}
                  </Fragment>
                ))
              : filtered.map(row)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
