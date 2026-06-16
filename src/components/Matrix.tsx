import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { CATEGORY_COLORS, metaOf } from '../data/software'
import { avatarColor, initials } from '../utils'

export default function Matrix() {
  const { members, software, toggleLicense } = useStore()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')

  const depts = useMemo(
    () => [...new Set(members.map((m) => m.department).filter(Boolean))].sort(),
    [members],
  )

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return members.filter((m) => {
      if (dept && m.department !== dept) return false
      if (kw && !`${m.name} ${m.department} ${m.section}`.toLowerCase().includes(kw)) return false
      return true
    })
  }, [members, q, dept])

  return (
    <div>
      <div className="toolbar">
        <div className="search">
          <span>🔍</span>
          <input placeholder="メンバーを絞り込み…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="filter" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">すべての部署</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          セルをクリックで付与／解除（{rows.length} 名）
        </span>
      </div>

      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th className="corner">メンバー</th>
              {software.map((sw) => (
                <th key={sw} title={sw}><div className="rot">{sw}</div></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <th>
                  <div className="person-cell">
                    <div className="avatar" style={{ background: avatarColor(m.name), width: 26, height: 26, fontSize: 11 }}>
                      {initials(m.name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                      <div className="person-mail">{m.department || '—'}</div>
                    </div>
                  </div>
                </th>
                {software.map((sw) => {
                  const on = m.licenses.includes(sw)
                  return (
                    <td className="cell" key={sw}>
                      <div
                        className={'dot' + (on ? ' on' : '')}
                        style={on ? { borderColor: CATEGORY_COLORS[metaOf(sw).category], color: CATEGORY_COLORS[metaOf(sw).category], background: CATEGORY_COLORS[metaOf(sw).category] + '18' } : undefined}
                        onClick={() => toggleLicense(m.id, sw)}
                        title={`${m.name} — ${sw}`}
                      >
                        {on ? '●' : ''}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
