import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { CATEGORY_COLORS, metaOf } from '../data/software'
import { avatarColor, initials, yen } from '../utils'

type Tab = 'usage' | 'coverage'

// 使用率に応じた色（高いほど濃い緑、低いほど赤＝未活用）
function rateColor(pct: number): string {
  if (pct >= 60) return '#16a34a'
  if (pct >= 30) return '#3b5bfd'
  if (pct >= 10) return '#f59e0b'
  return '#e11d48'
}

export default function Analytics() {
  const { members, software, apiKeys } = useStore()
  const [tab, setTab] = useState<Tab>('usage')
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [sortBy, setSortBy] = useState<'count' | 'name'>('count')

  const N = Math.max(1, members.length)

  // ツール別 使用率（保有者数 / 全メンバー）
  const perTool = useMemo(
    () =>
      software
        .map((sw) => {
          const meta = metaOf(sw)
          const count = members.filter((m) => m.licenses.includes(sw)).length
          return { sw, meta, count, pct: (count / N) * 100 }
        })
        .sort((a, b) => b.count - a.count),
    [members, software, N],
  )

  const summary = useMemo(() => {
    const totalLic = perTool.reduce((s, t) => s + t.count, 0)
    const avgPerMember = totalLic / N
    const overallRate = (totalLic / (N * Math.max(1, software.length))) * 100
    const top = perTool[0]
    const bottom = perTool[perTool.length - 1]
    return { avgPerMember, overallRate, top, bottom }
  }, [perTool, N, software.length])

  // API: 管理者（owner）別の月間利用額を集計
  const apiByOwner = useMemo(() => {
    const map = new Map<string, { usage: number; budget: number; keys: number }>()
    for (const k of apiKeys) {
      const cur = map.get(k.owner) ?? { usage: 0, budget: 0, keys: 0 }
      cur.usage += k.monthlyUsage
      cur.budget += k.monthlyBudget
      cur.keys += 1
      map.set(k.owner, cur)
    }
    return [...map.entries()]
      .map(([owner, v]) => ({ owner, ...v }))
      .sort((a, b) => b.usage - a.usage)
  }, [apiKeys])

  const depts = useMemo(
    () => [...new Set(members.map((m) => m.department).filter(Boolean))].sort(),
    [members],
  )

  // ユーザー別カバレッジ行
  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    const list = members.filter((m) => {
      if (dept && m.department !== dept) return false
      if (kw && !`${m.name} ${m.department} ${m.section}`.toLowerCase().includes(kw)) return false
      return true
    })
    return [...list].sort((a, b) =>
      sortBy === 'name'
        ? a.name.localeCompare(b.name, 'ja')
        : b.licenses.length - a.licenses.length,
    )
  }, [members, q, dept, sortBy])

  const maxPct = Math.max(1, ...perTool.map((t) => t.pct))
  const maxApiUsage = Math.max(1, ...apiByOwner.map((o) => o.usage))

  return (
    <div>
      {/* KPI サマリ */}
      <div className="kpi-grid">
        <div className="card kpi">
          <div className="label">📊 全社 平均使用率</div>
          <div className="value">{summary.overallRate.toFixed(0)}<span className="unit">%</span></div>
          <div className="foot">全 {software.length} ツールの保有率の平均</div>
        </div>
        <div className="card kpi">
          <div className="label">🧰 1人あたり保有ツール</div>
          <div className="value">{summary.avgPerMember.toFixed(1)}<span className="unit">種</span></div>
          <div className="foot">{members.length} 名の平均</div>
        </div>
        <div className="card kpi">
          <div className="label">🥇 最も使われているツール</div>
          <div className="value" style={{ fontSize: 22 }}>{summary.top?.sw ?? '—'}</div>
          <div className="foot">使用率 {summary.top?.pct.toFixed(0)}%（{summary.top?.count} 名）</div>
        </div>
        <div className="card kpi">
          <div className="label">📉 最も未活用のツール</div>
          <div className="value" style={{ fontSize: 22 }}>{summary.bottom?.sw ?? '—'}</div>
          <div className="foot">使用率 {summary.bottom?.pct.toFixed(0)}%（{summary.bottom?.count} 名）</div>
        </div>
      </div>

      {/* タブ切替 */}
      <div className="seg-tabs">
        <button className={'seg' + (tab === 'usage' ? ' active' : '')} onClick={() => setTab('usage')}>
          📈 ツール別 使用率
        </button>
        <button className={'seg' + (tab === 'coverage' ? ' active' : '')} onClick={() => setTab('coverage')}>
          🔲 ユーザー別 利用カバレッジ
        </button>
      </div>

      {tab === 'usage' && (
        <div className="grid-2">
          <div className="card" style={{ padding: 20 }}>
            <h2 className="section-title">📦 ソフト・AIツール別 使用率</h2>
            <div className="legend" style={{ marginBottom: 12 }}>
              {Object.entries(CATEGORY_COLORS).map(([c, col]) => (
                <span key={c}><span className="sw-dot" style={{ background: col }} />{c}</span>
              ))}
            </div>
            {perTool.map((t) => {
              const col = CATEGORY_COLORS[t.meta.category]
              return (
                <div className="bar-row" key={t.sw}>
                  <div className="bar-label">
                    <span className="sw-dot" style={{ background: col, width: 11, height: 11, borderRadius: 3, display: 'inline-block' }} />
                    {t.sw}
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(t.pct / maxPct) * 100}%`, background: col }} />
                  </div>
                  <div className="bar-val"><b>{t.pct.toFixed(0)}%</b> · {t.count}名</div>
                </div>
              )
            })}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h2 className="section-title">🔑 API 月間利用額（管理者別）</h2>
            {apiByOwner.map((o) => {
              const usePct = o.budget > 0 ? (o.usage / o.budget) * 100 : 0
              return (
                <div className="bar-row" key={o.owner} style={{ gridTemplateColumns: '170px 1fr 110px' }}>
                  <div className="bar-label" style={{ fontSize: 12 }} title={o.owner.split('@')[0]}>
                    {o.owner.split('@')[0]}
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(o.usage / maxApiUsage) * 100}%`, background: '#7c3aed' }} />
                  </div>
                  <div className="bar-val"><b>{yen(o.usage)}</b><br />
                    <span style={{ fontSize: 11 }}>予算消化 {usePct.toFixed(0)}%</span>
                  </div>
                </div>
              )
            })}
            {apiByOwner.length === 0 && <div className="empty">APIキーが登録されていません</div>}
            <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--text-faint)' }}>
              ※ ソフト・AIツールは「ライセンス保有率」、API のみ実利用額ベースです（デモ用の概算値）。
            </div>
          </div>
        </div>
      )}

      {tab === 'coverage' && (
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
            <select className="filter" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'count' | 'name')}>
              <option value="count">保有数が多い順</option>
              <option value="name">名前順</option>
            </select>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              ● = 利用中 / 空欄 = 未利用（{rows.length} 名）
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
                  <th title="カバレッジ"><div className="rot">カバレッジ</div></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const cov = (m.licenses.length / Math.max(1, software.length)) * 100
                  return (
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
                        const col = CATEGORY_COLORS[metaOf(sw).category]
                        return (
                          <td className="cell" key={sw}>
                            <div
                              className={'heat-dot ' + (on ? 'on' : 'off')}
                              style={on ? { background: col } : undefined}
                              title={`${m.name} — ${sw}：${on ? '利用中' : '未利用'}`}
                            >
                              {on ? '●' : ''}
                            </div>
                          </td>
                        )
                      })}
                      <td className="cell" style={{ minWidth: 110, padding: '0 12px' }}>
                        <div className="cov-cell">
                          <div className="bar-track" style={{ height: 8 }}>
                            <div className="bar-fill" style={{ width: `${cov}%`, background: rateColor(cov) }} />
                          </div>
                          <div className="cov-num">{m.licenses.length}/{software.length}</div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={software.length + 2}><div className="empty">該当するメンバーがいません</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
