import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { CATEGORY_COLORS } from '../data/software'
import {
  computeOptimization,
  SOURCE_META,
  type OptRow,
} from '../data/usage'
import { yen } from '../utils'

type SortKey = 'savings' | 'util' | 'name'

const REC_STYLE: Record<OptRow['rec']['kind'], { bg: string; fg: string; icon: string }> = {
  ok: { bg: '#e1f5ee', fg: '#0f6e56', icon: '✓' },
  reduce: { bg: '#faeeda', fg: '#854f0b', icon: '▼' },
  surplus: { bg: '#eef1ff', fg: '#3730a3', icon: '⊝' },
  shortage: { bg: '#fcebeb', fg: '#a32d2d', icon: '▲' },
}

function utilColor(pct: number): string {
  if (pct >= 75) return '#1d9e75'
  if (pct >= 50) return '#97c459'
  if (pct >= 30) return '#ef9f27'
  return '#e24b4a'
}

export type VerdictKind = 'add' | 'cut' | 'ok'
export const VERDICT_STYLE: Record<VerdictKind, { label: string; bg: string; fg: string; border: string; icon: string }> = {
  add: { label: '増やす', bg: '#fcebeb', fg: '#a32d2d', border: '#a32d2d', icon: '↗' },
  cut: { label: '減らせる', bg: '#faeeda', fg: '#854f0b', border: '#ba7517', icon: '↘' },
  ok: { label: '適正', bg: '#e1f5ee', fg: '#0f6e56', border: '#1d9e75', icon: '✓' },
}

export const FREQ_SEG: { key: 'daily' | 'weekly' | 'monthly' | 'rare' | 'never'; label: string; color: string }[] = [
  { key: 'daily', label: '毎日', color: '#0f6e56' },
  { key: 'weekly', label: '週', color: '#1d9e75' },
  { key: 'monthly', label: '月1', color: '#97c459' },
  { key: 'rare', label: 'ほぼ', color: '#ef9f27' },
  { key: 'never', label: '未使用', color: '#e24b4a' },
]

export function verdictOf(r: OptRow): { kind: VerdictKind; num: string; sub: string; reason: string } {
  const sharedLic = Math.ceil(r.shared / 2)
  const compo = `専有${r.dedicated}＋共有⌈${r.shared}/2⌉=${sharedLic}` + (r.unknown > 0 ? `＋未回答${r.unknown}` : '')
  const base = `利用者${r.assigned}名 → 必要${r.required}本（${compo}）。契約${r.seats}本。`
  if (r.rec.kind === 'shortage') {
    return { kind: 'add', num: `+${r.shortage}本`, sub: `必要 ${r.required} > 契約 ${r.seats}`, reason: base + `必要が契約を上回り不足。` }
  }
  if (r.rec.kind === 'reduce' || r.rec.kind === 'surplus') {
    return {
      kind: 'cut',
      num: `−${r.surplus}本`,
      sub: r.savings > 0 ? `年 ${yen(Math.round(r.savings))} 削減` : '',
      reason: base + (r.removable > 0 ? `うち全く使わない${r.removable}名は削除可。` : '') + `契約に余剰${r.surplus}本。`,
    }
  }
  return { kind: 'ok', num: '', sub: '', reason: base + `必要と契約が均衡。対応不要。` }
}

export function FreqBar({ r }: { r: OptRow }) {
  const total = Math.max(1, r.assigned)
  return (
    <div className="dec-freqbar" title="利用頻度の構成">
      {FREQ_SEG.map((s) =>
        r.freq[s.key] > 0 ? (
          <div key={s.key} style={{ width: `${(r.freq[s.key] / total) * 100}%`, background: s.color }} title={`${s.label} ${r.freq[s.key]}名`}>
            {r.freq[s.key] / total > 0.08 ? r.freq[s.key] : ''}
          </div>
        ) : null,
      )}
      {r.unknown > 0 && (
        <div style={{ width: `${(r.unknown / total) * 100}%`, background: 'var(--border)', color: 'var(--text-muted)' }} title={`未回答 ${r.unknown}名`}>
          {r.unknown / total > 0.08 ? r.unknown : ''}
        </div>
      )}
    </div>
  )
}

function NeedBar({ seats, required }: { seats: number; required: number }) {
  const max = Math.max(1, seats, required)
  return (
    <div className="dec-needbars">
      <div className="dec-bar">
        <span className="dec-bar-l">契約</span>
        <div className="dec-bar-track"><div className="dec-bar-fill" style={{ width: `${(seats / max) * 100}%`, background: '#378add' }} /></div>
        <span className="dec-bar-v">{seats}</span>
      </div>
      <div className="dec-bar">
        <span className="dec-bar-l">必要</span>
        <div className="dec-bar-track"><div className="dec-bar-fill" style={{ width: `${(required / max) * 100}%`, background: '#534ab7' }} /></div>
        <span className="dec-bar-v">{required}</span>
      </div>
    </div>
  )
}

interface OptimizeProps {
  onSoftwareClick?: (sw: string) => void
  selectedSw?: string | null
}

export default function Optimize({ onSoftwareClick, selectedSw }: OptimizeProps) {
  const { members, software, contracts, usage } = useStore()
  const [sortBy, setSortBy] = useState<SortKey>('savings')
  const [filter, setFilter] = useState<'all' | VerdictKind>('all')
  const [showTable, setShowTable] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { rows, totals } = useMemo(
    () => computeOptimization(members, software, contracts, usage),
    [members, software, contracts, usage],
  )

  const decided = useMemo(() => {
    const order: Record<VerdictKind, number> = { add: 0, cut: 1, ok: 2 }
    return rows
      .map((r) => ({ r, v: verdictOf(r) }))
      .sort((a, b) => {
        if (order[a.v.kind] !== order[b.v.kind]) return order[a.v.kind] - order[b.v.kind]
        if (a.v.kind === 'add') return b.r.shortage - a.r.shortage
        if (a.v.kind === 'cut') return b.r.savings - a.r.savings
        return b.r.assigned - a.r.assigned
      })
  }, [rows])

  const counts = useMemo(() => ({
    add: decided.filter((d) => d.v.kind === 'add').length,
    cut: decided.filter((d) => d.v.kind === 'cut').length,
    ok: decided.filter((d) => d.v.kind === 'ok').length,
  }), [decided])

  const visible = filter === 'all' ? decided : decided.filter((d) => d.v.kind === filter)

  const sorted = useMemo(() => {
    const r = [...rows]
    if (sortBy === 'name') r.sort((a, b) => a.software.localeCompare(b.software, 'ja'))
    else if (sortBy === 'util') r.sort((a, b) => a.utilRate - b.utilRate)
    else r.sort((a, b) => b.savings - a.savings)
    return r
  }, [rows, sortBy])

  return (
    <div>
      {/* KPI */}
      <div className="kpi-grid">
        <div className="card kpi">
          <div className="label">💰 年間コスト削減余地</div>
          <div className="value" style={{ color: 'var(--success)', fontSize: 26 }}>{yen(totals.savings)}</div>
          <div className="foot">減らせる {totals.surplus}本ぶん（契約 &gt; 必要）</div>
        </div>
        <div className="card kpi">
          <div className="label">↘ 減らせる本数</div>
          <div className="value">{totals.surplus}<span className="unit">本</span></div>
          <div className="foot">{totals.reduceSoftware} ソフトで余剰</div>
        </div>
        <div className="card kpi">
          <div className="label">↗ 追加すべき本数</div>
          <div className="value" style={{ color: totals.shortage > 0 ? 'var(--danger)' : undefined }}>
            {totals.shortage}<span className="unit">本</span>
          </div>
          <div className="foot">{totals.shortageSoftware} ソフトで不足</div>
        </div>
        <div className="card kpi">
          <div className="label">🗑️ 全く使わない</div>
          <div className="value">{totals.dormant}<span className="unit">名</span></div>
          <div className="foot">付与済だが「ほぼ/全く使わない」</div>
        </div>
      </div>

      {/* 判断ビュー */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="dec-controls">
          <h2 className="section-title" style={{ margin: 0, marginRight: 4 }}>🎯 ソフト別 判断</h2>
          <button className={'dec-fchip' + (filter === 'all' ? ' active' : '')} onClick={() => setFilter('all')}>
            すべて <b>{rows.length}</b>
          </button>
          <button className={'dec-fchip add' + (filter === 'add' ? ' active' : '')} onClick={() => setFilter('add')}>
            ↗ 増やす <b>{counts.add}</b>
          </button>
          <button className={'dec-fchip cut' + (filter === 'cut' ? ' active' : '')} onClick={() => setFilter('cut')}>
            ↘ 減らせる <b>{counts.cut}</b>
          </button>
          <button className={'dec-fchip ok' + (filter === 'ok' ? ' active' : '')} onClick={() => setFilter('ok')}>
            ✓ 適正 <b>{counts.ok}</b>
          </button>
          <span className="dec-legend">
            必要本数 = 専有（毎日・週）＋ ⌈共有（月1・ほぼ）÷2⌉。利用頻度：
            {FREQ_SEG.map((s) => (<span key={s.key} style={{ color: s.color }}> ■{s.label}</span>))}
          </span>
          <div className="view-mode-toggle">
            <button className={'vmt-btn' + (viewMode === 'grid' ? ' active' : '')} onClick={() => setViewMode('grid')} title="グリッド表示">▦</button>
            <button className={'vmt-btn' + (viewMode === 'list' ? ' active' : '')} onClick={() => setViewMode('list')} title="リスト表示">☰</button>
          </div>
        </div>

        <div className={'dec-list' + (viewMode === 'list' ? ' is-list' : '')}>
          {visible.map(({ r, v }) => {
            const vs = VERDICT_STYLE[v.kind]
            const isSelected = r.software === selectedSw
            const barMax = Math.max(1, r.seats, r.required)

            if (viewMode === 'list') {
              return (
                <div
                  className={'dec-row' + (isSelected ? ' selected' : '')}
                  key={r.software}
                  style={{ borderLeftColor: vs.border, cursor: 'pointer' }}
                  onClick={() => onSoftwareClick?.(r.software)}
                >
                  <div className="li-name">
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: CATEGORY_COLORS[r.category], display: 'inline-block', flexShrink: 0 }} />
                    <span className="li-sw-text">{r.software}</span>
                  </div>
                  <div className="dec-chip li-chip" style={{ background: vs.bg, color: vs.fg }}>
                    <span className="dec-chip-ico">{vs.icon}</span>
                    {vs.label}{v.num && <b> {v.num}</b>}
                  </div>
                  <div className="li-need">
                    <div className="li-bar-row">
                      <span className="li-lbl">契約</span>
                      <div className="li-track"><div style={{ width: `${(r.seats / barMax) * 100}%`, height: '100%', background: '#378add' }} /></div>
                      <span className="li-val">{r.seats}</span>
                    </div>
                    <div className="li-bar-row">
                      <span className="li-lbl">必要</span>
                      <div className="li-track"><div style={{ width: `${(r.required / barMax) * 100}%`, height: '100%', background: '#534ab7' }} /></div>
                      <span className="li-val">{r.required}</span>
                    </div>
                  </div>
                  <div className="li-metric">
                    {r.savings > 0
                      ? <span style={{ color: '#0f6e56', fontWeight: 600 }}>{yen(Math.round(r.savings))}</span>
                      : r.shortage > 0
                        ? <span style={{ color: '#a32d2d', fontWeight: 600 }}>+{r.shortage}本不足</span>
                        : <span style={{ color: '#0f6e56' }}>適正</span>}
                  </div>
                  <div className="dec-srcrow li-src">
                    <span className="opt-src-badge" style={{ color: SOURCE_META[r.source].color, borderColor: SOURCE_META[r.source].color + '55' }}>
                      {SOURCE_META[r.source].short}
                    </span>
                    {r.dataDate && <span className="opt-src-date">{r.dataDate}</span>}
                  </div>
                </div>
              )
            }

            return (
              <div
                className={'dec-row' + (isSelected ? ' selected' : '')}
                key={r.software}
                style={{ borderLeftColor: vs.border, cursor: 'pointer' }}
                onClick={() => onSoftwareClick?.(r.software)}
              >
                <div className="dec-left">
                  <div className="dec-name">
                    <span className="sw-dot" style={{ background: CATEGORY_COLORS[r.category] }} />
                    {r.software}
                  </div>
                  <div className="dec-chip" style={{ background: vs.bg, color: vs.fg }}>
                    <span className="dec-chip-ico">{vs.icon}</span>
                    {vs.label}{v.num && <b>　{v.num}</b>}
                  </div>
                  {v.sub && <div className="dec-sub">{v.sub}</div>}
                  <div className="dec-srcrow">
                    <span className="opt-src-badge" style={{ color: SOURCE_META[r.source].color, borderColor: SOURCE_META[r.source].color + '55' }}>
                      {SOURCE_META[r.source].short}
                    </span>
                    {r.dataDate && <span className="opt-src-date">{r.dataDate}</span>}
                    {r.usageUrl && <a className="opt-src-link" href={r.usageUrl} target="_blank" rel="noopener noreferrer" title="Autodesk 使用状況レポート">🔗</a>}
                  </div>
                </div>
                <div className="dec-right">
                  <NeedBar seats={r.seats} required={r.required} />
                  <div className="dec-freq-label">利用者 {r.assigned}名の内訳</div>
                  <FreqBar r={r} />
                  <div className="dec-reason">{v.reason}</div>
                </div>
              </div>
            )
          })}
          {visible.length === 0 && <div className="empty">該当するソフトはありません</div>}
        </div>
      </div>

      {/* 明細表（折りたたみ） */}
      <button className="opt-detail-toggle" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable}>
        <span className={'rb-chevron' + (showTable ? ' open' : '')}>▸</span>
        明細表（数値・利用率・データ源）
      </button>
      {showTable && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 10 }}>
          <div className="opt-table-head">
            <h2 className="section-title" style={{ margin: 0 }}>📋 明細</h2>
            <select className="filter" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
              <option value="savings">削減余地が大きい順</option>
              <option value="util">利用率が低い順</option>
              <option value="name">ソフト名順</option>
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="opt-table">
              <thead>
                <tr>
                  <th>ソフト</th>
                  <th className="num">契約</th>
                  <th className="num">必要</th>
                  <th className="num">付与</th>
                  <th className="num">実利用</th>
                  <th className="num">未回答</th>
                  <th style={{ minWidth: 150 }}>利用率</th>
                  <th className="num">年間削減余地</th>
                  <th>推奨アクション</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const pct = r.utilRate * 100
                  const rs = REC_STYLE[r.rec.kind]
                  return (
                    <tr key={r.software} onClick={() => onSoftwareClick?.(r.software)} style={{ cursor: onSoftwareClick ? 'pointer' : undefined }}>
                      <td>
                        <span className="opt-sw">
                          <span className="sw-dot" style={{ background: CATEGORY_COLORS[r.category] }} />
                          {r.software}
                        </span>
                        <span className="opt-src">
                          <span className="opt-src-badge" style={{ color: SOURCE_META[r.source].color, borderColor: SOURCE_META[r.source].color + '55' }}>
                            {SOURCE_META[r.source].short}
                          </span>
                          {r.dataDate && <span className="opt-src-date">{r.dataDate}</span>}
                          {r.usageUrl && (
                            <a className="opt-src-link" href={r.usageUrl} target="_blank" rel="noopener noreferrer" title="Autodesk 使用状況レポートを開く">🔗</a>
                          )}
                        </span>
                      </td>
                      <td className="num">{r.seats || '—'}</td>
                      <td className="num"><b>{r.required}</b></td>
                      <td className="num">{r.assigned}</td>
                      <td className="num"><b>{r.active}</b></td>
                      <td className="num">{r.unknown > 0 ? <span className="opt-unknown">{r.unknown}</span> : '0'}</td>
                      <td>
                        <div className="opt-util">
                          <div className="bar-track" style={{ height: 8, flex: 1 }}>
                            <div className="bar-fill" style={{ width: `${pct}%`, background: utilColor(pct) }} />
                          </div>
                          <span className="opt-util-num">{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="num">{r.savings > 0 ? yen(Math.round(r.savings)) : '—'}</td>
                      <td>
                        <span className="opt-rec" style={{ background: rs.bg, color: rs.fg }}>
                          <span className="opt-rec-ico">{rs.icon}</span>
                          {r.rec.label}
                          {r.rec.detail && <span className="opt-rec-detail">· {r.rec.detail}</span>}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="opt-legend">
            必要 = 専有（毎日・週は1人1本）＋ ⌈共有（月1・ほぼは2人で1本）÷2⌉ ＋ 未回答（暫定で専有扱い）。
            年間削減余地 =（契約 − 必要）× 1本あたり年額。利用率 = 実利用 ÷ 付与。
          </div>
        </div>
      )}
    </div>
  )
}
