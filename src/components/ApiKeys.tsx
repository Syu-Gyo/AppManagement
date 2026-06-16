import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { usageRatio, type ApiKey } from '../data/apikeys'
import { yen } from '../utils'

function UsageBar({ k }: { k: ApiKey }) {
  const r = usageRatio(k)
  const pct = Math.min(100, r * 100)
  const color = r >= 1 ? '#e11d48' : r >= 0.8 ? '#f59e0b' : '#16a34a'
  return (
    <div>
      <div className="bar-track" style={{ height: 9 }}>
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
        {yen(k.monthlyUsage)} / {yen(k.monthlyBudget)}（{(r * 100).toFixed(0)}%）
      </div>
    </div>
  )
}

export default function ApiKeys({ onOpen }: { onOpen: (k: ApiKey) => void }) {
  const { apiKeys, updateApiKey } = useStore()
  const [reveal, setReveal] = useState<Set<number>>(new Set())
  const [envFilter, setEnvFilter] = useState('')

  const filtered = useMemo(
    () => apiKeys.filter((k) => !envFilter || k.env === envFilter),
    [apiKeys, envFilter],
  )

  const totals = useMemo(() => {
    const usage = apiKeys.reduce((s, k) => s + k.monthlyUsage, 0)
    const budget = apiKeys.reduce((s, k) => s + k.monthlyBudget, 0)
    const active = apiKeys.filter((k) => k.status === '有効').length
    const overBudget = apiKeys.filter((k) => usageRatio(k) >= 0.8).length
    return { usage, budget, active, overBudget }
  }, [apiKeys])

  function toggleReveal(id: number) {
    setReveal((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  return (
    <div>
      <div className="kpi-grid">
        <div className="card kpi">
          <div className="label">🔑 APIキー</div>
          <div className="value">{apiKeys.length}<span className="unit">件</span></div>
          <div className="foot">有効 {totals.active} 件</div>
        </div>
        <div className="card kpi">
          <div className="label">💴 今月の利用額</div>
          <div className="value" style={{ fontSize: 26 }}>{yen(totals.usage)}</div>
          <div className="foot">月予算合計 {yen(totals.budget)}</div>
        </div>
        <div className="card kpi">
          <div className="label">📊 予算消化率</div>
          <div className="value">{totals.budget ? ((totals.usage / totals.budget) * 100).toFixed(0) : 0}<span className="unit">%</span></div>
          <div className="foot">全キー合計ベース</div>
        </div>
        <div className="card kpi" style={{ borderColor: totals.overBudget ? '#fed7aa' : undefined }}>
          <div className="label">⚠️ 予算逼迫（80%以上）</div>
          <div className="value" style={{ color: totals.overBudget ? '#f59e0b' : undefined }}>{totals.overBudget}<span className="unit">件</span></div>
          <div className="foot">上限引き上げ等の検討</div>
        </div>
      </div>

      <div className="toolbar">
        <select className="filter" value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}>
          <option value="">すべての環境</option>
          <option value="本番">本番</option>
          <option value="開発">開発</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-muted)' }}>{filtered.length} 件</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>サービス / 用途</th>
              <th>APIキー</th>
              <th style={{ width: 70 }}>環境</th>
              <th>管理者</th>
              <th style={{ width: 200 }}>今月の利用量 / 予算</th>
              <th style={{ width: 100, textAlign: 'center' }}>状態</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((k) => (
              <tr key={k.id} onClick={() => onOpen(k)}>
                <td>
                  <div className="person-name">{k.service}</div>
                  <div className="person-mail">{k.label} · 最終利用 {k.lastUsed}</div>
                </td>
                <td>
                  <code style={{ fontSize: 12, background: 'var(--surface-2)', padding: '3px 7px', borderRadius: 6 }}>
                    {reveal.has(k.id) ? k.keyMasked.replace(/•+/, '_LIVE_KEY_') : k.keyMasked}
                  </code>
                  <button className="btn ghost" style={{ padding: '2px 6px', fontSize: 11, marginLeft: 6 }}
                    onClick={(e) => { e.stopPropagation(); toggleReveal(k.id) }}>
                    {reveal.has(k.id) ? '隠す' : '表示'}
                  </button>
                </td>
                <td>
                  <span className="tag" style={k.env === '本番'
                    ? { background: '#eef2ff', color: '#4f46e5', borderColor: '#c7d2fe' }
                    : { background: 'var(--surface-2)' }}>{k.env}</span>
                </td>
                <td style={{ fontSize: 12.5 }}><span className="muted">{k.owner.split('@')[0]}</span></td>
                <td onClick={(e) => e.stopPropagation()}><UsageBar k={k} /></td>
                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    className="tag"
                    style={k.status === '有効'
                      ? { background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0', cursor: 'pointer' }
                      : { background: '#f8fafc', color: '#94a3b8', cursor: 'pointer' }}
                    onClick={() => updateApiKey(k.id, { status: k.status === '有効' ? '無効' : '有効' })}
                  >
                    ● {k.status}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        ※ デモのため利用額・予算は概算値です。キーはマスク表示で、実際のシークレットは保持していません。
      </p>
    </div>
  )
}
