import { useMemo, useState } from 'react'
import { useStore } from '../store'
import {
  daysUntil, renewalStatus, STATUS_COLORS, type Contract, type RenewalStatus,
} from '../data/contracts'
import { yen } from '../utils'

// デモの基準日（添付スケジュールが2026年のため固定）
const TODAY = new Date('2026-06-16T00:00:00')

function StatusBadge({ status, days }: { status: RenewalStatus; days: number }) {
  const c = STATUS_COLORS[status]
  const label = status === '更新間近' ? `更新間近 (あと${days}日)` : status === '期限切れ' ? `期限切れ (${-days}日経過)` : '契約中'
  return (
    <span className="tag" style={{ background: c + '18', color: c, borderColor: c + '40' }}>
      ● {label}
    </span>
  )
}

/* ---------------- 年間ガントチャート ---------------- */
function Gantt({ contracts, onOpen }: { contracts: Contract[]; onOpen: (c: Contract) => void }) {
  const year = 2026
  const yearStart = new Date(`${year}-01-01T00:00:00`).getTime()
  const yearEnd = new Date(`${year}-12-31T00:00:00`).getTime()
  const span = yearEnd - yearStart
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

  function pct(dateMs: number) {
    return Math.max(0, Math.min(100, ((dateMs - yearStart) / span) * 100))
  }
  const todayPct = pct(TODAY.getTime())

  return (
    <div className="card" style={{ padding: '18px 20px', overflowX: 'auto' }}>
      <div style={{ minWidth: 760 }}>
        {/* month header */}
        <div className="gantt-head">
          <div className="gantt-label-col" />
          <div className="gantt-track-head">
            {months.map((m) => <div key={m} className="gantt-month">{m}</div>)}
            <div className="gantt-today" style={{ left: `${todayPct}%` }} title="本日 2026-06-16">
              <span className="gantt-today-flag">今日</span>
            </div>
          </div>
        </div>

        {contracts.map((c) => {
          const s = Math.max(yearStart, new Date(c.startDate + 'T00:00:00').getTime())
          const e = Math.min(yearEnd, new Date(c.endDate + 'T00:00:00').getTime())
          const left = pct(s)
          const width = Math.max(1.5, pct(e) - left)
          const status = renewalStatus(c.endDate, TODAY)
          const color = STATUS_COLORS[status]
          return (
            <div className="gantt-row" key={c.id} onClick={() => onOpen(c)}>
              <div className="gantt-label-col">
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>{c.software}</div>
                <div className="muted" style={{ fontSize: 11 }}>{c.edition || c.vendor} · {c.seats}本</div>
              </div>
              <div className="gantt-track">
                <div className="gantt-bar" style={{ left: `${left}%`, width: `${width}%`, background: color }}>
                  <span className="gantt-bar-label">〜{c.endDate.slice(5).replace('-', '/')}</span>
                </div>
                <div className="gantt-today-line" style={{ left: `${todayPct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="legend" style={{ marginTop: 14 }}>
        {(['契約中', '更新間近', '期限切れ'] as RenewalStatus[]).map((s) => (
          <span key={s}><span className="sw-dot" style={{ background: STATUS_COLORS[s] }} />{s}</span>
        ))}
      </div>
    </div>
  )
}

/* ---------------- メイン ---------------- */
export default function Contracts({ onOpen }: { onOpen: (c: Contract) => void }) {
  const { contracts, members } = useStore()
  const [tab, setTab] = useState<'list' | 'gantt'>('list')

  // 実利用者数（社員別ライセンスとの突合）
  const actualUsers = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of members) for (const l of m.licenses) map.set(l, (map.get(l) ?? 0) + 1)
    return map
  }, [members])

  const enriched = useMemo(
    () =>
      contracts.map((c) => {
        const status = renewalStatus(c.endDate, TODAY)
        const days = daysUntil(c.endDate, TODAY)
        const annual = c.seats * c.unitAnnualCost
        const used = c.licenseKey ? actualUsers.get(c.licenseKey) ?? 0 : null
        return { c, status, days, annual, used }
      }),
    [contracts, actualUsers],
  )

  const sorted = useMemo(() => [...enriched].sort((a, b) => a.days - b.days), [enriched])

  const totals = useMemo(() => {
    const annual = enriched.reduce((s, x) => s + x.annual, 0)
    const seats = enriched.reduce((s, x) => s + x.c.seats, 0)
    const soon = enriched.filter((x) => x.status === '更新間近').length
    const expired = enriched.filter((x) => x.status === '期限切れ').length
    return { annual, seats, soon, expired }
  }, [enriched])

  const alerts = sorted.filter((x) => x.status !== '契約中')

  return (
    <div>
      <div className="kpi-grid">
        <div className="card kpi">
          <div className="label">📄 契約数</div>
          <div className="value">{contracts.length}<span className="unit">件</span></div>
          <div className="foot">契約本数 合計 {totals.seats.toLocaleString()} 本</div>
        </div>
        <div className="card kpi">
          <div className="label">💴 年間コスト（概算）</div>
          <div className="value" style={{ fontSize: 26 }}>{yen(totals.annual)}</div>
          <div className="foot">月額換算 約 {yen(Math.round(totals.annual / 12))}</div>
        </div>
        <div className="card kpi" style={{ borderColor: totals.soon ? '#fed7aa' : undefined }}>
          <div className="label">⏰ 更新間近（60日以内）</div>
          <div className="value" style={{ color: totals.soon ? '#f59e0b' : undefined }}>{totals.soon}<span className="unit">件</span></div>
          <div className="foot">早めの更新判断が必要</div>
        </div>
        <div className="card kpi" style={{ borderColor: totals.expired ? '#fecdd3' : undefined }}>
          <div className="label">🚨 期限切れ</div>
          <div className="value" style={{ color: totals.expired ? '#e11d48' : undefined }}>{totals.expired}<span className="unit">件</span></div>
          <div className="foot">対応漏れがないか確認</div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: 20, borderColor: '#fed7aa', background: '#fffbf5' }}>
          <h2 className="section-title" style={{ marginBottom: 10 }}>🔔 更新アラート</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map(({ c, status, days }) => (
              <div key={c.id} onClick={() => onOpen(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: 'var(--surface)' }}>
                <StatusBadge status={status} days={days} />
                <b style={{ fontSize: 13.5 }}>{c.software}</b>
                <span className="muted" style={{ fontSize: 12.5 }}>{c.edition}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  終了 {c.endDate} · {c.seats}本 · {c.autoRenew ? '自動更新' : '手動更新'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="toolbar">
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 4, borderRadius: 10 }}>
          <button className={'btn' + (tab === 'list' ? ' primary' : ' ghost')} onClick={() => setTab('list')}>📋 一覧</button>
          <button className={'btn' + (tab === 'gantt' ? ' primary' : ' ghost')} onClick={() => setTab('gantt')}>📅 年間スケジュール</button>
        </div>
      </div>

      {tab === 'gantt' ? (
        <Gantt contracts={contracts} onOpen={onOpen} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ソフト / エディション</th>
                <th>ベンダー</th>
                <th style={{ textAlign: 'center' }}>本数</th>
                <th style={{ textAlign: 'center' }}>実利用者（突合）</th>
                <th style={{ textAlign: 'right' }}>年額（概算）</th>
                <th>契約期間</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ c, status, days, annual, used }) => {
                const over = used != null && used > c.seats
                const under = used != null && used < c.seats
                return (
                  <tr key={c.id} onClick={() => onOpen(c)}>
                    <td>
                      <div className="person-name">{c.software}</div>
                      <div className="person-mail">{c.edition || '—'}{c.note ? ` · ${c.note}` : ''}</div>
                    </td>
                    <td><span className="muted">{c.vendor}</span></td>
                    <td style={{ textAlign: 'center' }}><span className="count-pill">{c.seats}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      {used == null ? <span className="muted">—</span> : (
                        <span className="tag" style={over
                          ? { background: '#fef2f2', color: '#e11d48', borderColor: '#fecdd3' }
                          : under ? { background: '#fffbeb', color: '#b45309', borderColor: '#fde68a' }
                          : { background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>
                          {used} 名 {over ? `· 超過 ${used - c.seats}` : under ? `· 余 ${c.seats - used}` : '· 適正'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{yen(annual)}</td>
                    <td style={{ fontSize: 12.5 }}>
                      <span className="muted">{c.startDate}</span> 〜 {c.endDate}
                    </td>
                    <td><StatusBadge status={status} days={days} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
