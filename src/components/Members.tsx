import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { CATEGORY_COLORS, metaOf } from '../data/software'
import { avatarColor, initials } from '../utils'
import type { Member } from '../data/types'

export default function Members({ onOpen }: { onOpen: (m: Member) => void }) {
  const { members, software } = useStore()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [sw, setSw] = useState('')

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
        const hay = `${m.name} ${m.department} ${m.section}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [members, q, dept, sw])

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
        <button className="btn" onClick={() => { setQ(''); setDept(''); setSw('') }}>クリア</button>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>
        {filtered.length} 名を表示中（全 {members.length} 名）
      </div>

      <div className="table-wrap">
        <table>
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
            {filtered.map((m) => (
              <tr key={m.id} onClick={() => onOpen(m)}>
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
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5}><div className="empty">該当するメンバーがいません</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
