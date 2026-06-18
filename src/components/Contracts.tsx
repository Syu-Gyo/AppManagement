import { useMemo, useState } from 'react'
import { useStore } from '../store'
import {
  daysUntil, renewalStatus, STATUS_COLORS, type Contract, type RenewalStatus,
} from '../data/contracts'
import { contractCategory, BUDGET_CATEGORY_COLORS } from '../data/budgets'
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

/* ---------------- 週次ガントカレンダー ---------------- */
const WG_YEAR = 2026
const WG_YS = new Date(`${WG_YEAR}-01-01T00:00:00`).getTime()
const WG_YE = new Date(`${WG_YEAR}-12-31T00:00:00`).getTime()
const WG_SPAN = WG_YE - WG_YS
const WEEK_W = 30
const N_WEEKS = 52
const TRACK_W = WEEK_W * N_WEEKS
const LABEL_W = 200
const QUARTERS = [
  { label: 'Q1', m0: 0, m1: 3, color: '#1e293b' },
  { label: 'Q2', m0: 3, m1: 6, color: '#4ca64c' },
  { label: 'Q3', m0: 6, m1: 9, color: '#2e7d32' },
  { label: 'Q4', m0: 9, m1: 12, color: '#3f86c4' },
]

function xOf(ms: number) {
  return Math.max(0, Math.min(TRACK_W, ((ms - WG_YS) / WG_SPAN) * TRACK_W))
}
function ms(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').getTime()
}
function monthStart(m: number) {
  return new Date(WG_YEAR, m, 1).getTime()
}
function fmtMD(t: number) {
  const dt = new Date(t)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}
function twoMonthsBefore(dateStr: string) {
  const dt = new Date(dateStr + 'T00:00:00')
  dt.setMonth(dt.getMonth() - 2)
  return dt.getTime()
}

function WgChip({ x, color, label, align = 'center' }: { x: number; color: string; label: string; align?: 'center' | 'left' }) {
  return (
    <div
      className="wg-chip"
      style={{
        left: x,
        background: color,
        transform: align === 'left' ? 'translate(0, -50%)' : 'translate(-50%, -50%)',
      }}
    >
      {label}
    </div>
  )
}

function WeekGantt({ contracts, onOpen }: { contracts: Contract[]; onOpen: (c: Contract) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, Contract[]>()
    for (const c of contracts) {
      const arr = map.get(c.software)
      if (arr) arr.push(c)
      else map.set(c.software, [c])
    }
    return [...map.entries()]
  }, [contracts])

  const todayX = xOf(TODAY.getTime())
  const weeks = Array.from({ length: N_WEEKS }, (_, i) => WG_YS + i * 7 * 86400000)

  return (
    <div className="wg-wrap">
      <div className="wg" style={{ width: LABEL_W + TRACK_W }}>
        {/* ヘッダー: 四半期 */}
        <div className="wg-row">
          <div className="wg-label wg-corner" style={{ width: LABEL_W }} />
          <div className="wg-track wg-qrow" style={{ width: TRACK_W }}>
            {QUARTERS.map((q) => {
              const left = xOf(monthStart(q.m0))
              const right = q.m1 >= 12 ? TRACK_W : xOf(monthStart(q.m1))
              return (
                <div key={q.label} className="wg-q" style={{ left, width: right - left, background: q.color }}>{q.label}</div>
              )
            })}
            <div className="wg-today-flag" style={{ left: todayX }}>TODAY</div>
          </div>
        </div>
        {/* ヘッダー: 月 */}
        <div className="wg-row">
          <div className="wg-label" style={{ width: LABEL_W }} />
          <div className="wg-track wg-mrow" style={{ width: TRACK_W }}>
            {Array.from({ length: 12 }, (_, m) => {
              const left = xOf(monthStart(m))
              const right = m === 11 ? TRACK_W : xOf(monthStart(m + 1))
              return <div key={m} className="wg-m" style={{ left, width: right - left }}>{m + 1}月</div>
            })}
          </div>
        </div>
        {/* ヘッダー: 週の開始日 + 週番号 */}
        <div className="wg-row">
          <div className="wg-label wg-week-lbl" style={{ width: LABEL_W }}>Week</div>
          <div className="wg-track wg-wrow" style={{ width: TRACK_W }}>
            {weeks.map((w, i) => (
              <div key={i} className="wg-w" style={{ left: i * WEEK_W, width: WEEK_W }}>
                <span className="wg-w-date">{new Date(w).getDate()}</span>
                <span className="wg-w-num">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 本体: ソフトごとにグループ */}
        {groups.map(([sw, list]) => (
          <div key={sw}>
            <div className="wg-row wg-grouprow">
              <div className="wg-label wg-glabel" style={{ width: LABEL_W }}>{sw}</div>
              <div className="wg-track" style={{ width: TRACK_W }}>
                <div className="wg-today-line" style={{ left: todayX }} />
              </div>
            </div>
            {list.map((c) => {
              const sX = xOf(ms(c.startDate))
              const eX = xOf(ms(c.endDate))
              const cat = contractCategory(c)
              const color = BUDGET_CATEGORY_COLORS[cat]
              const startsInYear = ms(c.startDate) >= WG_YS
              const endsInYear = ms(c.endDate) <= WG_YE
              const m2 = twoMonthsBefore(c.endDate)
              const m2InYear = m2 >= WG_YS && m2 <= WG_YE
              const startDt = new Date(c.startDate + 'T00:00:00')
              return (
                <div className="wg-row wg-barrow" key={c.id} onClick={() => onOpen(c)} title={`${c.software} ${c.edition}`}>
                  <div className="wg-label wg-sublabel" style={{ width: LABEL_W }}>
                    <span className="wg-dot" style={{ background: color }} />
                    {c.edition || c.vendor} · {c.seats}本
                  </div>
                  <div className="wg-track" style={{ width: TRACK_W }}>
                    <div className="wg-today-line" style={{ left: todayX }} />
                    {/* 契約期間バー（矢印） */}
                    <div className="wg-bar" style={{ left: sX, width: Math.max(2, eX - sX), color }}>
                      {endsInYear && <span className="wg-arrow" style={{ borderLeftColor: color }} />}
                    </div>
                    {/* 開始マーカー */}
                    {startsInYear ? (
                      <WgChip x={sX} color="#4ca64c" label={`${fmtMD(ms(c.startDate))} ${c.autoRenew ? '契約更新' : '契約'}`} align="left" />
                    ) : (
                      <WgChip x={2} color="#4ca64c" align="left"
                        label={`${startDt.getFullYear()}/${startDt.getMonth() + 1}/${startDt.getDate()} ${c.autoRenew ? '契約更新' : '契約'}`} />
                    )}
                    {/* 2ヶ月前リマインド */}
                    {m2InYear && <WgChip x={xOf(m2)} color="#0e9f6e" label={`${fmtMD(m2)} 2ヶ月前`} />}
                    {/* 終了マーカー */}
                    {endsInYear && <WgChip x={eX} color="#274b6d" label={`${fmtMD(ms(c.endDate))} ${c.autoRenew ? '更新満了日' : '契約満了'}`} />}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- メイン ---------------- */
export default function Contracts({ onOpen }: { onOpen: (c: Contract) => void }) {
  const { contracts, members } = useStore()
  const [tab, setTab] = useState<'list' | 'gantt' | 'week'>('list')

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
          <button className={'btn' + (tab === 'week' ? ' primary' : ' ghost')} onClick={() => setTab('week')}>📆 週間ガント</button>
        </div>
      </div>

      {tab === 'week' ? (
        <WeekGantt contracts={contracts} onOpen={onOpen} />
      ) : tab === 'gantt' ? (
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
