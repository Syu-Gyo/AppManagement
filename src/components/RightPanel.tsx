import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { daysUntil, renewalStatus } from '../data/contracts'
import type { Contract } from '../data/contracts'
import { usageRatio } from '../data/apikeys'
import type { ApiKey } from '../data/apikeys'
import { SEED_AI_PLANS } from '../data/aiplans'
import type { AiPlan } from '../data/aiplans'
import { computeSpend } from '../data/budgets'
import {
  computeOptimization,
  SOURCE_META,
  AUTODESK_USAGE_URL,
  AUTODESK_SEATS_URL,
  type OptRow,
  type UsageRecord,
} from '../data/usage'
import type { Member } from '../data/types'
import { metaOf } from '../data/software'
import { avatarColor, initials, yen } from '../utils'
import MemberDrawer from './MemberDrawer'
import ContractDrawer from './ContractDrawer'
import ApiKeyDrawer from './ApiKeyDrawer'
import ApplicationSlideDrawer from './ApplicationSlideDrawer'
import type { Slide } from '../data/application'

const TODAY = new Date('2026-06-16T00:00:00')

export type View = 'dashboard' | 'optimize' | 'members' | 'software' | 'aitools' | 'api' | 'analytics' | 'contracts' | 'budget' | 'application' | 'survey'

export type Selection =
  | { kind: 'member'; mode: 'view' | 'new'; item: Member | null }
  | { kind: 'contract'; mode: 'view' | 'new'; item: Contract | null }
  | { kind: 'apikey'; mode: 'view' | 'new'; item: ApiKey | null }
  | { kind: 'aiplan'; mode: 'view'; item: AiPlan }
  | { kind: 'software'; mode: 'view'; item: string }
  | { kind: 'apiservice'; mode: 'view'; item: string }
  | { kind: 'application'; mode: 'edit'; item: Slide }

interface Props {
  view: View
  selection: Selection | null
  onClose: () => void
  onNavigate: (v: View) => void
  onAddMember: () => void
  onAddContract: () => void
  onAddApiKey: () => void
  onSelectMember?: (m: Member) => void
  onUpdateSlide?: (slide: Slide) => void
  onUpdateSlideLive?: (slide: Slide) => void
  applicationFocusField?: string | null
}

const AI_MODEL_COLORS: Record<string, string> = {
  Midjourney: '#7c3aed', chatGPT: '#10a37f', KreaAI: '#db2777',
  Genspark: '#2563eb', Tripo: '#0891b2', Adobeexpress: '#e11d48', 'Google AI': '#f59e0b',
}

function AiPlanDetail({ p }: { p: AiPlan }) {
  const c = AI_MODEL_COLORS[p.model] ?? '#64748b'
  const over = p.members.length > p.seats
  return (
    <div className="rb-detail">
      <div className="drawer-head">
        <div className="sw-icon" style={{ background: c, width: 38, height: 38 }}>{p.model.slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{p.model}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>プラン: {p.plan} · {p.billing}</div>
        </div>
      </div>
      <div className="drawer-body">
        <div className="rb-stat-row"><span className="l">契約本数</span><span className="v">{p.seats} 本</span></div>
        <div className="rb-stat-row"><span className="l">配布人数</span><span className="v" style={{ color: over ? '#e11d48' : undefined }}>{p.members.length} 名{over ? ' ⚠' : ''}</span></div>
        <div className="rb-stat-row"><span className="l">金額</span><span className="v">{p.amountText || '—'}</span></div>
        <div className="rb-stat-row"><span className="l">月額概算</span><span className="v">{yen(p.estMonthlyJpy)}</span></div>
        <div className="rb-stat-row"><span className="l">契約日</span><span className="v" style={{ fontSize: 12 }}>{p.contractText || '—'}</span></div>
        <div className="rb-stat-row"><span className="l">更新日</span><span className="v" style={{ fontSize: 12 }}>{p.renewalText || '—'}</span></div>
        {over && (
          <div style={{ margin: '12px 0', padding: '10px 12px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 9, fontSize: 12, color: '#9f1239' }}>
            ⚠ 契約本数（{p.seats}）より配布人数（{p.members.length}）が多くなっています
          </div>
        )}
        {p.admins.length > 0 && (
          <>
            <div className="subhead" style={{ marginTop: 14 }}>アカウント管理者</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {p.admins.map((a) => <span key={a} className="tag" style={{ background: c + '14', color: c, borderColor: c + '33' }}>★ {a}</span>)}
            </div>
          </>
        )}
        <div className="subhead" style={{ marginTop: 14 }}>配布メンバー（{p.members.length}）</div>
        {p.members.length === 0 ? (
          <div className="rb-empty">この資料に個別の配布先リストはありません</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {p.members.map((m) => (
              <div key={m} className="person-cell" style={{ background: 'var(--surface-2)', padding: '4px 10px 4px 4px', borderRadius: 999 }}>
                <div className="avatar" style={{ background: avatarColor(m), width: 22, height: 22, fontSize: 10 }}>{initials(m)}</div>
                <span style={{ fontSize: 12, fontWeight: p.admins.includes(m) ? 700 : 500 }}>{m}{p.admins.includes(m) ? ' ★' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ApiServiceDetail({ service }: { service: string }) {
  const { apiKeys } = useStore()
  const keys = apiKeys.filter((k) => k.service === service)
  const totalUsage = keys.reduce((s, k) => s + k.monthlyUsage, 0)
  const totalBudget = keys.reduce((s, k) => s + k.monthlyBudget, 0)
  const ratio = totalBudget > 0 ? totalUsage / totalBudget : 0
  const over = ratio > 1; const warn = ratio > 0.85
  const apiColor = '#0891b2'
  const consoleUrl = keys[0]?.consoleUrl

  return (
    <div className="rb-detail">
      <div className="drawer-head">
        <div className="sw-icon" style={{ background: apiColor, width: 38, height: 38 }}>{service.slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{service}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>APIサービス · {keys.length}キー</div>
        </div>
      </div>
      <div className="drawer-body">
        <div className="subhead">今月の利用状況</div>
        <div className="rb-stat-row"><span className="l">今月の利用額</span><span className="v" style={{ color: over ? '#e11d48' : warn ? '#f59e0b' : undefined }}>{yen(totalUsage)}</span></div>
        <div className="rb-stat-row"><span className="l">月予算</span><span className="v">{yen(totalBudget)}</span></div>
        <div className="rb-stat-row"><span className="l">予算消化率</span><span className="v" style={{ color: over ? '#e11d48' : warn ? '#f59e0b' : undefined }}>{(ratio * 100).toFixed(0)}%</span></div>
        <div style={{ margin: '10px 0 14px' }}>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, ratio * 100)}%`, background: over ? '#e11d48' : warn ? '#f59e0b' : apiColor, borderRadius: 4 }} />
          </div>
        </div>
        {consoleUrl && (
          <a className="sw-link" href={consoleUrl} target="_blank" rel="noopener noreferrer" style={{ color: apiColor, marginBottom: 16, display: 'block' }}>
            🔗 利用量コンソールで確認
          </a>
        )}

        <div className="subhead" style={{ marginTop: 6 }}>APIキー一覧（{keys.length}）</div>
        {keys.map((k) => {
          const kr = k.monthlyBudget > 0 ? k.monthlyUsage / k.monthlyBudget : 0
          const kOver = kr > 1; const kWarn = kr > 0.85
          return (
            <div key={k.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{k.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
                    {k.keyMasked} · {k.env} · {k.owner.split('@')[0]}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, alignSelf: 'flex-start',
                  background: k.status === '有効' ? '#dcfce7' : '#f1f5f9',
                  color: k.status === '有効' ? '#15803d' : '#64748b' }}>
                  {k.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: kOver ? '#e11d48' : kWarn ? '#f59e0b' : 'var(--text)' }}>{yen(k.monthlyUsage)}</span>
                <span style={{ color: 'var(--text-muted)' }}>/ {yen(k.monthlyBudget)}</span>
              </div>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, kr * 100)}%`, background: kOver ? '#e11d48' : kWarn ? '#f59e0b' : apiColor, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>最終利用: {k.lastUsed}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const FREQ_COLORS: Record<string, string> = {
  daily: '#0f6e56', weekly: '#1d9e75', monthly: '#97c459', rare: '#ef9f27', never: '#e24b4a',
}
const FREQ_LABELS: Record<string, string> = {
  daily: '毎日', weekly: '週', monthly: '月1', rare: 'ほぼ', never: '未使用',
}
const FREQ_KEYS = ['daily', 'weekly', 'monthly', 'rare', 'never'] as const

const RP_VERDICT = {
  add: { label: '増やす', bg: '#fcebeb', fg: '#a32d2d', icon: '↗' },
  cut: { label: '減らせる', bg: '#faeeda', fg: '#854f0b', icon: '↘' },
  ok: { label: '適正', bg: '#e1f5ee', fg: '#0f6e56', icon: '✓' },
} as const

function rpVerdictOf(r: OptRow) {
  const sharedLic = Math.ceil(r.shared / 2)
  const compo = `専有${r.dedicated}＋共有⌈${r.shared}/2⌉=${sharedLic}` + (r.unknown > 0 ? `＋未回答${r.unknown}` : '')
  const base = `利用者${r.assigned}名 → 必要${r.required}本（${compo}）。契約${r.seats}本。`
  if (r.rec.kind === 'shortage') {
    return { kind: 'add' as const, num: `+${r.shortage}本`, sub: `必要${r.required} > 契約${r.seats}`, reason: base + '必要が契約を上回り不足。' }
  }
  if (r.rec.kind === 'reduce' || r.rec.kind === 'surplus') {
    return { kind: 'cut' as const, num: `−${r.surplus}本`, sub: r.savings > 0 ? `年${yen(Math.round(r.savings))}削減` : '', reason: base + (r.removable > 0 ? `うち全く使わない${r.removable}名は削除可。` : '') + `契約に余剰${r.surplus}本。` }
  }
  return { kind: 'ok' as const, num: '', sub: '', reason: base + '必要と契約が均衡。対応不要。' }
}

// ---------- 利用頻度グラフ（制御コンポーネント） ----------
const FREQ_H_DAY: Record<string, number> = { daily: 4.5, weekly: 0.8, monthly: 0.15, rare: 0.03, never: 0 }
const FREQ_C_DAY: Record<string, number> = { daily: 10, weekly: 2, monthly: 0.4, rare: 0.08, never: 0 }

type ChartMetric = 'time' | 'count'
type ChartPeriod = 'day' | 'week' | 'month'

function UsageBarChart({ sw, users, usage, color, metric, period, thrDay, onThrChange, assignedSeats = 0 }: {
  sw: string; users: Member[]; usage: UsageRecord[]; color: string
  metric: ChartMetric; period: ChartPeriod
  thrDay: Record<ChartMetric, number>
  onThrChange: (metric: ChartMetric, val: number) => void
  assignedSeats?: number
}) {
  const factor = period === 'day' ? 1 : period === 'week' ? 5 : 21
  const pLabel = period === 'day' ? '日' : period === 'week' ? '週' : '月'
  const unit = metric === 'time' ? `h/${pLabel}` : `回/${pLabel}`
  const currThrDay = thrDay[metric]
  const thrDisp = currThrDay * factor
  const maxThrDay = metric === 'time' ? 8 : 20

  type Row = { name: string; val: number; freq: string | null }
  const rows = useMemo((): Row[] => {
    const r = users.map((m) => {
      const rec = usage
        .filter((u) => u.memberId === m.id && u.software === sw)
        .sort((a, b) => b.surveyedAt.localeCompare(a.surveyedAt))[0]
      const freq = rec?.frequency ?? null
      const vd = freq ? (metric === 'time' ? (FREQ_H_DAY[freq] ?? 0) : (FREQ_C_DAY[freq] ?? 0)) : 0
      return { name: m.name, val: Math.round(vd * factor * 10) / 10, freq }
    })
    if (r.length === 0 && assignedSeats > 0) {
      return Array.from({ length: assignedSeats }, (_, i) => ({
        name: `未割当 ${i + 1}`,
        val: 0,
        freq: null,
      }))
    }
    return r.sort((a, b) => b.val - a.val)
  }, [users, usage, sw, metric, factor, assignedSeats])

  const maxVal = Math.max(...rows.map((r) => r.val), thrDisp, 0.01)
  const flagged = rows.filter((r) => r.val > 0 && r.val < thrDisp)
  const noDataCount = rows.filter((r) => r.freq === null).length
  const thrLabel = (thrDisp % 1 === 0 ? `${thrDisp}` : `${thrDisp.toFixed(1)}`) + unit
  const fmtVal = (v: number) =>
    metric === 'time' ? (v < 1 ? v.toFixed(1) : `${Math.round(v)}`) + 'h' : `${Math.round(v)}回`

  const chartRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)

  function handleThresholdMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = true

    const updateThreshold = (ev: MouseEvent) => {
      if (!dragRef.current || !chartRef.current) return
      const rect = chartRef.current.getBoundingClientRect()
      const relX = ev.clientX - rect.left - 108
      const usableWidth = rect.width - 108 - 14
      if (usableWidth <= 0) return
      const ratio = Math.max(0, Math.min(1, relX / usableWidth))
      const newThrDay = (ratio * maxVal) / factor
      onThrChange(metric, Math.max(0, Math.min(maxThrDay, newThrDay)))
    }

    const stopDrag = () => {
      dragRef.current = false
      document.removeEventListener('mousemove', updateThreshold)
      document.removeEventListener('mouseup', stopDrag)
    }

    document.addEventListener('mousemove', updateThreshold)
    document.addEventListener('mouseup', stopDrag)
  }

  if (rows.length === 0) return null

  return (
    <div style={{ marginTop: 10, marginBottom: 4 }}>
      {/* 未達 / 達成通知 */}
      {flagged.length > 0 ? (
        <div style={{ fontSize: 11.5, marginBottom: 8, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 800, color: '#d23b3f' }}>{flagged.length}名</span>が未達 · {flagged.slice(0, 3).map((r) => r.name).join(', ')}{flagged.length > 3 ? ' ほか' : ''}
        </div>
      ) : rows.some((r) => r.freq !== null) ? (
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#3f9a5a', marginBottom: 8 }}>全員がしきい値に到達しています</div>
      ) : null}

      {/* グラフ本体 */}
      <div style={{ position: 'relative' }} ref={chartRef}>
        {/* 損切ライン（ドラッグで移動） */}
        <div style={{ position: 'absolute', left: 108, right: 14, top: 0, bottom: 0, pointerEvents: 'none', zIndex: 3 }}>
          {thrDisp > 0 && (
            <div
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${(thrDisp / maxVal) * 100}%`,
                width: 16, marginLeft: -8,
                cursor: 'ew-resize',
                pointerEvents: 'auto',
              }}
              onMouseDown={handleThresholdMouseDown}
            >
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', borderLeft: '2px dashed #e5484d', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', background: '#e5484d', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                {thrLabel}
              </div>
            </div>
          )}
        </div>

        {/* 棒グラフ行 */}
        {rows.map((r) => {
          const isFlagged = r.val > 0 && r.val < thrDisp
          const barPct = (r.val / maxVal) * 100
          return (
            <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '108px 1fr', alignItems: 'center', height: 38, position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10, gap: 4, minWidth: 0 }}>
                {isFlagged && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#e5484d', flexShrink: 0 }} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: isFlagged ? '#c73535' : r.freq === null ? 'var(--text-faint)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                </span>
              </div>
              <div style={{ paddingRight: 14, height: 22, display: 'flex', alignItems: 'center' }}>
                {r.val > 0 && (
                  <div style={{ height: '100%', borderRadius: 5, background: color, width: `${barPct}%`, minWidth: 3, opacity: isFlagged ? 0.45 : 1, transition: 'width .3s cubic-bezier(.4,0,.2,1)', flexShrink: 0 }} />
                )}
                {r.val > 0 && (
                  <span style={{ paddingLeft: 8, fontSize: 12, fontWeight: 800, color: isFlagged ? '#c73535' : color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {fmtVal(r.val)}
                  </span>
                )}
                {r.freq === null && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>未回答</span>}
                {r.freq !== null && r.val === 0 && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>—</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* X軸ラベル */}
      <div style={{ display: 'grid', gridTemplateColumns: '108px 1fr', marginTop: 2 }}>
        <div />
        <div style={{ paddingRight: 14, paddingTop: 4, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          {unit}（アンケート推定）
        </div>
      </div>

      {noDataCount > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 5 }}>
          ※ {noDataCount}名は利用状況未回答
        </div>
      )}
    </div>
  )
}

function SoftwareDetail({ name }: { name: string }) {
  const { members, software, contracts, usage } = useStore()
  const meta = metaOf(name)
  const c = meta.category
  const color = ({ 'CAD/3D': '#2563eb', AI: '#7c3aed', クリエイティブ: '#db2777', その他: '#64748b' } as Record<string, string>)[c] ?? '#64748b'
  const users = useMemo(() => {
    const respondentIds = new Set(usage.filter((u) => u.software === name).map((u) => u.memberId))
    return members.filter((m) => m.licenses.includes(name) || respondentIds.has(m.id))
  }, [members, usage, name])
  const assignedSeats = contracts
    .filter((contract) => contract.licenseKey === name)
    .reduce((sum, contract) => sum + contract.seats, 0)
  const monthly = Math.max(users.length, assignedSeats) * meta.monthlyCost
  const isAutodesk = meta.vendor === 'Autodesk'

  const { rows } = useMemo(
    () => computeOptimization(members, software, contracts, usage),
    [members, software, contracts, usage],
  )
  const row = rows.find((r) => r.software === name)

  const [metric, setMetric] = useState<ChartMetric>('time')
  const [period, setPeriod] = useState<ChartPeriod>('day')
  const [thrDay, setThrDay] = useState<Record<ChartMetric, number>>({ time: 2, count: 6 })

  return (
    <div className="rb-detail">
      <div className="drawer-head">
        <div className="sw-icon" style={{ background: color, width: 38, height: 38 }}>{name.slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{meta.vendor} · {meta.category}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <div className="seg-tabs" style={{ marginBottom: 0 }}>
            {(['time', 'count'] as ChartMetric[]).map((m) => (
              <button key={m} className={'seg' + (metric === m ? ' active' : '')} onClick={() => setMetric(m)} style={{ fontSize: 11, padding: '4px 8px' }}>
                {m === 'time' ? '利用時間' : '利用回数'}
              </button>
            ))}
          </div>
          <div className="seg-tabs" style={{ marginBottom: 0 }}>
            {(['day', 'week', 'month'] as ChartPeriod[]).map((p) => (
              <button key={p} className={'seg' + (period === p ? ' active' : '')} onClick={() => setPeriod(p)} style={{ fontSize: 11, padding: '4px 8px' }}>
                {p === 'day' ? '1日' : p === 'week' ? '週' : '月'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="drawer-body">
        <UsageBarChart
          sw={name} users={users} usage={usage} color={color}
          metric={metric} period={period} thrDay={thrDay}
          assignedSeats={assignedSeats || row?.seats || 0}
          onThrChange={(m, v) => setThrDay((t) => ({ ...t, [m]: v }))}
        />
      </div>

    </div>
  )
}

// ---------- ツール別利用状況グラフ（デフォルト右パネル） ----------
const SW_DISPLAY: Record<string, string> = {
  Autocad: 'AutoCAD', AutocadLT: 'AutoCAD LT', acrobat: 'Acrobat',
  photoshop: 'Photoshop', sketchup: 'SketchUp', solidworks: 'SolidWorks',
  CreativeCloud: 'Creative Cloud', 'Adobe Express': 'Adobe Express',
  Midjourney: 'Midjourney', chatGPT: 'ChatGPT', Twinmotion: 'Twinmotion',
  Revit: 'Revit', KreaAI: 'Krea AI', Genspark: 'Genspark', Tripo: 'Tripo', GoogleAI: 'Google AI',
}
const CAT_COLORS: Record<string, string> = {
  'CAD/3D': '#2563eb', AI: '#7c3aed', クリエイティブ: '#db2777', その他: '#64748b',
}

function ToolUsageOverview() {
  const { members, software, contracts, usage } = useStore()
  const [metric, setMetric] = useState<ChartMetric>('time')
  const [period, setPeriod] = useState<ChartPeriod>('day')
  const [thrDay, setThrDay] = useState<Record<ChartMetric, number>>({ time: 1, count: 3 })
  const chartRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)

  const factor = period === 'day' ? 1 : period === 'week' ? 5 : 21
  const pLabel = period === 'day' ? '日' : period === 'week' ? '週' : '月'
  const unit = metric === 'time' ? `h/${pLabel}` : `回/${pLabel}`
  const thrDisp = thrDay[metric] * factor
  const maxThrDay = metric === 'time' ? 8 : 20

  type ToolRow = { sw: string; seats: number; perLic: number; totalUsers: number; noData: number; color: string }
  const rows = useMemo((): ToolRow[] => {
    return software.map((sw) => {
      const users = members.filter((m) => m.licenses.includes(sw))
      const cs = contracts.filter((c) => c.licenseKey === sw)
      const aiPlans = SEED_AI_PLANS.filter((p) => p.model === sw)
      const seats = cs.reduce((s, c) => s + c.seats, 0) + aiPlans.reduce((s, p) => s + p.seats, 0)
      let total = 0; let noData = 0
      for (const u of users) {
        const rec = usage
          .filter((r) => r.memberId === u.id && r.software === sw)
          .sort((a, b) => b.surveyedAt.localeCompare(a.surveyedAt))[0]
        if (!rec) { noData++; continue }
        const vd = metric === 'time' ? (FREQ_H_DAY[rec.frequency] ?? 0) : (FREQ_C_DAY[rec.frequency] ?? 0)
        total += vd * factor
      }
      const licCount = Math.max(seats || users.length, 1)
      const perLic = Math.round((total / licCount) * 10) / 10
      const color = CAT_COLORS[metaOf(sw).category] ?? '#64748b'
      return { sw, seats: seats || users.length, perLic, totalUsers: users.length, noData, color }
    }).sort((a, b) => b.perLic - a.perLic)
  }, [software, members, contracts, usage, metric, factor])

  const maxVal = Math.max(...rows.map((r) => r.perLic), thrDisp, 0.01)
  const thrLabel = (thrDisp % 1 === 0 ? `${thrDisp}` : `${thrDisp.toFixed(1)}`) + unit
  const fmtVal = (v: number) => metric === 'time' ? (v < 1 ? v.toFixed(1) : `${Math.round(v)}`) + 'h' : `${Math.round(v)}回`
  const belowThr = rows.filter((r) => r.perLic > 0 && r.perLic < thrDisp)

  function handleThresholdMouseDown(e: React.MouseEvent) {
    e.preventDefault(); dragRef.current = true
    const update = (ev: MouseEvent) => {
      if (!dragRef.current || !chartRef.current) return
      const rect = chartRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left - 120) / (rect.width - 120 - 14)))
      setThrDay((t) => ({ ...t, [metric]: Math.max(0, Math.min(maxThrDay, (ratio * maxVal) / factor)) }))
    }
    const stop = () => { dragRef.current = false; document.removeEventListener('mousemove', update); document.removeEventListener('mouseup', stop) }
    document.addEventListener('mousemove', update)
    document.addEventListener('mouseup', stop)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="rb-section-title" style={{ marginBottom: 0 }}>📊 ツール別利用状況</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <div className="seg-tabs" style={{ marginBottom: 0 }}>
            {(['time', 'count'] as ChartMetric[]).map((m) => (
              <button key={m} className={'seg' + (metric === m ? ' active' : '')} onClick={() => setMetric(m)} style={{ fontSize: 11, padding: '4px 8px' }}>
                {m === 'time' ? '利用時間' : '利用回数'}
              </button>
            ))}
          </div>
          <div className="seg-tabs" style={{ marginBottom: 0 }}>
            {(['day', 'week', 'month'] as ChartPeriod[]).map((p) => (
              <button key={p} className={'seg' + (period === p ? ' active' : '')} onClick={() => setPeriod(p)} style={{ fontSize: 11, padding: '4px 8px' }}>
                {p === 'day' ? '1日' : p === 'week' ? '週' : '月'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {belowThr.length > 0 && (
        <div style={{ fontSize: 11.5, marginBottom: 8, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 800, color: '#d23b3f' }}>{belowThr.length}ツール</span>が損切ライン未達
        </div>
      )}

      <div style={{ position: 'relative' }} ref={chartRef}>
        <div style={{ position: 'absolute', left: 120, right: 14, top: 0, bottom: 0, pointerEvents: 'none', zIndex: 3 }}>
          {thrDisp > 0 && (
            <div
              style={{ position: 'absolute', top: 0, bottom: 0, left: `${(thrDisp / maxVal) * 100}%`, width: 16, marginLeft: -8, cursor: 'ew-resize', pointerEvents: 'auto' }}
              onMouseDown={handleThresholdMouseDown}
            >
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', borderLeft: '2px dashed #e5484d', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', background: '#e5484d', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                {thrLabel}
              </div>
            </div>
          )}
        </div>

        {rows.map((r) => {
          const isFlagged = r.perLic > 0 && r.perLic < thrDisp
          const barPct = (r.perLic / maxVal) * 100
          return (
            <div key={r.sw} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', height: 34, position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10, gap: 4, minWidth: 0 }}>
                {isFlagged && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#e5484d', flexShrink: 0 }} />}
                <span style={{ fontSize: 11.5, fontWeight: 600, color: isFlagged ? '#c73535' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {SW_DISPLAY[r.sw] ?? r.sw}
                </span>
              </div>
              <div style={{ paddingRight: 14, height: 20, display: 'flex', alignItems: 'center' }}>
                {r.perLic > 0 && (
                  <div style={{ height: '100%', borderRadius: 4, background: r.color, width: `${barPct}%`, minWidth: 3, opacity: isFlagged ? 0.45 : 1, transition: 'width .3s cubic-bezier(.4,0,.2,1)', flexShrink: 0 }} />
                )}
                {r.perLic > 0 && (
                  <span style={{ paddingLeft: 7, fontSize: 11.5, fontWeight: 800, color: isFlagged ? '#c73535' : r.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {fmtVal(r.perLic)}
                  </span>
                )}
                {r.perLic === 0 && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{r.noData === r.totalUsers ? '未回答' : '—'}</span>}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', marginTop: 2 }}>
        <div />
        <div style={{ paddingRight: 14, paddingTop: 4, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          {unit}／ライセンス（アンケート推定）
        </div>
      </div>
    </div>
  )
}

interface Alert { sev: string; title: string; sub: string; target: View }

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function AlertBell({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { contracts, apiKeys, members } = useStore()
  const [open, setOpen] = useState(false)

  const actualUsers = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of members) for (const l of p.licenses) m.set(l, (m.get(l) ?? 0) + 1)
    return m
  }, [members])

  const alerts = useMemo<Alert[]>(() => {
    const list: Alert[] = []
    for (const c of contracts) {
      const st = renewalStatus(c.endDate, TODAY)
      const d = daysUntil(c.endDate, TODAY)
      if (st === '期限切れ') list.push({ sev: '#e11d48', title: `${c.software} 契約期限切れ`, sub: `${-d}日経過 · ${c.endDate}`, target: 'contracts' })
      else if (st === '更新間近') list.push({ sev: '#f59e0b', title: `${c.software} 更新間近`, sub: `あと${d}日 · ${c.seats}本`, target: 'contracts' })
    }
    for (const c of contracts) {
      if (!c.licenseKey) continue
      const used = actualUsers.get(c.licenseKey) ?? 0
      if (used > c.seats) list.push({ sev: '#e11d48', title: `${c.software} 本数超過`, sub: `契約${c.seats}本 < 利用${used}名`, target: 'contracts' })
    }
    for (const p of SEED_AI_PLANS) {
      if (p.members.length > p.seats) list.push({ sev: '#db2777', title: `${p.model} 配布超過`, sub: `契約${p.seats}本 < 配布${p.members.length}名`, target: 'aitools' })
    }
    for (const k of apiKeys) {
      const r = usageRatio(k)
      if (r >= 1) list.push({ sev: '#e11d48', title: `${k.service} 予算超過`, sub: `${(r * 100).toFixed(0)}% · ${k.label}`, target: 'api' })
      else if (r >= 0.8) list.push({ sev: '#f59e0b', title: `${k.service} 予算逼迫`, sub: `${(r * 100).toFixed(0)}% · ${k.label}`, target: 'api' })
    }
    return list
  }, [contracts, apiKeys, actualUsers])

  return (
    <div style={{ position: 'relative' }}>
      <button
        className={'hdr-toggle' + (open ? ' active' : '')}
        style={{ position: 'relative' }}
        onClick={() => setOpen((v) => !v)}
        title="アラート"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {alerts.length > 0 && (
          <span style={{ position: 'absolute', top: 1, right: 1, background: '#e11d48', color: '#fff', borderRadius: '50%', fontSize: 8, fontWeight: 800, minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', lineHeight: 1, pointerEvents: 'none' }}>
            {alerts.length > 9 ? '9+' : alerts.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 1000, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.15)', width: 300, maxHeight: 400, overflowY: 'auto' }}>
            <div style={{ padding: '10px 14px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'center' }}>
              🔔 アラート
              {alerts.length > 0 && <span style={{ background: '#fee2e2', color: '#e11d48', borderRadius: 6, fontSize: 11, padding: '1px 6px', fontWeight: 700 }}>{alerts.length}</span>}
            </div>
            {alerts.length === 0 ? (
              <div style={{ padding: '16px 14px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>対応が必要な項目はありません 🎉</div>
            ) : (
              alerts.map((a, i) => (
                <div key={i} className="rb-alert" style={{ cursor: 'pointer' }} onClick={() => { onNavigate(a.target); setOpen(false) }}>
                  <span className="rb-dot" style={{ background: a.sev }} />
                  <div>
                    <div className="rb-alert-title">{a.title}</div>
                    <div className="rb-alert-sub">{a.sub}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---------- デフォルトパネル群 ----------

function HomeSummaryPanel({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { contracts, apiKeys, members, software } = useStore()
  const totalSoftware = software.length
  const totalLicenses = contracts.reduce((s, c) => s + c.seats, 0)
  const spend = computeSpend(contracts, SEED_AI_PLANS, apiKeys)
  const thisYear = TODAY.getFullYear()
  const thisMonth = TODAY.getMonth() + 1
  const monthlySpend = spend
    .filter((s) => {
      const y = s.year
      return y === thisYear
    })
    .reduce((s, item) => s + Math.round(item.amount / 12), 0)

  const actualUsers = new Map<string, number>()
  for (const m of members) for (const l of m.licenses) actualUsers.set(l, (actualUsers.get(l) ?? 0) + 1)

  const alerts: { sev: string; title: string; sub: string }[] = []
  for (const c of contracts) {
    const st = renewalStatus(c.endDate, TODAY)
    const d = daysUntil(c.endDate, TODAY)
    if (st === '期限切れ') alerts.push({ sev: '#e11d48', title: `${c.software} 期限切れ`, sub: `${-d}日経過` })
    else if (st === '更新間近') alerts.push({ sev: '#f59e0b', title: `${c.software} 更新間近`, sub: `あと${d}日` })
  }
  for (const k of apiKeys) {
    const r = k.monthlyBudget > 0 ? k.monthlyUsage / k.monthlyBudget : 0
    if (r >= 1) alerts.push({ sev: '#e11d48', title: `${k.service} 予算超過`, sub: `${(r * 100).toFixed(0)}%` })
    else if (r >= 0.8) alerts.push({ sev: '#f59e0b', title: `${k.service} 予算逼迫`, sub: `${(r * 100).toFixed(0)}%` })
  }
  const topAlerts = alerts.slice(0, 3)

  return (
    <div className="drawer-body">
      <div className="rb-section-title">📋 ライセンスサマリー</div>
      <div className="rb-stat-row"><span className="l">総ソフト数</span><span className="v">{totalSoftware} 本</span></div>
      <div className="rb-stat-row"><span className="l">総ライセンス数</span><span className="v">{totalLicenses} 席</span></div>
      <div className="rb-stat-row"><span className="l">{thisYear}年の月額概算</span><span className="v">{yen(monthlySpend)}</span></div>
      {topAlerts.length > 0 && (
        <>
          <div className="subhead" style={{ marginTop: 14 }}>⚠ アラート上位 {topAlerts.length} 件</div>
          {topAlerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.sev, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.sub}</div>
              </div>
            </div>
          ))}
          {alerts.length > 3 && (
            <button className="sw-link" style={{ marginTop: 6, fontSize: 12 }} onClick={() => onNavigate('contracts')}>
              他 {alerts.length - 3} 件を確認 →
            </button>
          )}
        </>
      )}
      <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <ToolUsageOverview />
      </div>
    </div>
  )
}

function MemberSummaryPanel({ onAddMember }: { onAddMember: () => void }) {
  const { members } = useStore()
  const deptMap = new Map<string, number>()
  for (const m of members) deptMap.set(m.department, (deptMap.get(m.department) ?? 0) + 1)
  const depts = Array.from(deptMap.entries()).sort((a, b) => b[1] - a[1])
  const maxCount = Math.max(...depts.map(([, c]) => c), 1)
  const recent = [...members].reverse().slice(0, 3)

  return (
    <div className="drawer-body">
      <div className="rb-section-title">👥 メンバーサマリー</div>
      <div className="rb-stat-row"><span className="l">総メンバー数</span><span className="v">{members.length} 名</span></div>
      <button
        onClick={onAddMember}
        style={{ width: '100%', margin: '12px 0', padding: '8px 0', borderRadius: 8, border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
      >
        ＋ メンバーを追加
      </button>
      <div className="subhead" style={{ marginTop: 4 }}>部署別人数</div>
      {depts.map(([dept, count]) => (
        <div key={dept} style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ fontWeight: 600 }}>{dept}</span>
            <span style={{ color: 'var(--text-muted)' }}>{count} 名</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(count / maxCount) * 100}%`, background: 'var(--primary)', borderRadius: 3 }} />
          </div>
        </div>
      ))}
      <div className="subhead" style={{ marginTop: 16 }}>最近追加されたメンバー</div>
      {recent.map((m) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="avatar" style={{ background: avatarColor(m.name), width: 28, height: 28, fontSize: 11, flexShrink: 0 }}>{initials(m.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{m.department}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ContractSummaryPanel({ onAddContract }: { onAddContract: () => void }) {
  const { contracts } = useStore()
  const total = contracts.length
  const expired = contracts.filter((c) => renewalStatus(c.endDate, TODAY) === '期限切れ')
  const nearRenewal = contracts.filter((c) => renewalStatus(c.endDate, TODAY) === '更新間近')
  const urgent = [
    ...expired.map((c) => ({ c, sev: '#e11d48', label: '期限切れ', days: daysUntil(c.endDate, TODAY) })),
    ...nearRenewal.map((c) => ({ c, sev: '#f59e0b', label: '更新間近', days: daysUntil(c.endDate, TODAY) })),
  ].sort((a, b) => a.days - b.days)

  return (
    <div className="drawer-body">
      <div className="rb-section-title">📄 契約サマリー</div>
      <div className="rb-stat-row"><span className="l">総契約数</span><span className="v">{total} 件</span></div>
      <div className="rb-stat-row">
        <span className="l">期限切れ</span>
        <span className="v" style={{ color: expired.length > 0 ? '#e11d48' : undefined }}>{expired.length} 件</span>
      </div>
      <div className="rb-stat-row">
        <span className="l">更新間近（30日以内）</span>
        <span className="v" style={{ color: nearRenewal.length > 0 ? '#f59e0b' : undefined }}>{nearRenewal.length} 件</span>
      </div>
      <button
        onClick={onAddContract}
        style={{ width: '100%', margin: '12px 0', padding: '8px 0', borderRadius: 8, border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
      >
        ＋ 契約を追加
      </button>
      {urgent.length > 0 && (
        <>
          <div className="subhead">要対応の契約</div>
          {urgent.map(({ c, sev, label, days }) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: sev, flexShrink: 0, marginTop: 4 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.software}{c.edition ? ` (${c.edition})` : ''}</div>
                <div style={{ fontSize: 11.5, color: sev }}>
                  {label} · {label === '期限切れ' ? `${-days}日経過` : `あと${days}日`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.endDate} · {c.seats}本</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function BudgetSummaryPanel({ view, onAddApiKey }: { view: View; onAddApiKey: () => void }) {
  const { contracts, apiKeys, budgets } = useStore()
  const thisYear = TODAY.getFullYear()
  const yearBudgets = budgets.filter((b) => b.year === thisYear)
  const totalBudget = yearBudgets.reduce((s, b) => s + b.amount, 0)
  const spend = computeSpend(contracts, SEED_AI_PLANS, apiKeys)
  const totalSpend = spend.filter((s) => s.year === thisYear).reduce((s, item) => s + item.amount, 0)
  const ratio = totalBudget > 0 ? totalSpend / totalBudget : 0
  const over = ratio > 1
  const warn = ratio > 0.85

  const overBudgetKeys = apiKeys.filter((k) => k.monthlyBudget > 0 && k.monthlyUsage / k.monthlyBudget >= 1)
  const warnKeys = apiKeys.filter((k) => k.monthlyBudget > 0 && k.monthlyUsage / k.monthlyBudget >= 0.8 && k.monthlyUsage / k.monthlyBudget < 1)

  return (
    <div className="drawer-body">
      <div className="rb-section-title">💰 予算サマリー（{thisYear}年）</div>
      <div className="rb-stat-row"><span className="l">年間予算合計</span><span className="v">{yen(totalBudget)}</span></div>
      <div className="rb-stat-row">
        <span className="l">支出合計</span>
        <span className="v" style={{ color: over ? '#e11d48' : warn ? '#f59e0b' : undefined }}>{yen(totalSpend)}</span>
      </div>
      <div style={{ margin: '10px 0 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 5 }}>
          <span>予算消化率</span>
          <span style={{ fontWeight: 700, color: over ? '#e11d48' : warn ? '#f59e0b' : 'var(--text)' }}>{(ratio * 100).toFixed(1)}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, ratio * 100)}%`, background: over ? '#e11d48' : warn ? '#f59e0b' : 'var(--primary)', borderRadius: 4 }} />
        </div>
      </div>
      {(overBudgetKeys.length > 0 || warnKeys.length > 0) && (
        <>
          <div className="subhead">API予算アラート</div>
          {[...overBudgetKeys.map((k) => ({ k, sev: '#e11d48', label: '超過' })), ...warnKeys.map((k) => ({ k, sev: '#f59e0b', label: '逼迫' }))].map(({ k, sev, label }) => (
            <div key={k.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: sev, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.service} · {k.label}</div>
                <div style={{ fontSize: 11.5, color: sev }}>{label} · {yen(k.monthlyUsage)} / {yen(k.monthlyBudget)}</div>
              </div>
            </div>
          ))}
        </>
      )}
      {view === 'api' && (
        <button
          onClick={onAddApiKey}
          style={{ width: '100%', marginTop: 14, padding: '8px 0', borderRadius: 8, border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          ＋ APIキーを追加
        </button>
      )}
    </div>
  )
}

function ApplicationGuidePanel() {
  return (
    <div className="drawer-body">
      <div className="rb-section-title">📝 申請ガイド</div>
      <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10, marginBottom: 16, fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)' }}>
        スライドを選んで内容を確認・編集し、申請書として出力できます。
      </div>
      <div className="subhead">申請フロー</div>
      {[
        { step: '1', label: '左リストからスライドを選択' },
        { step: '2', label: '内容を確認・編集' },
        { step: '3', label: '申請書を出力（PDF / PPTX）' },
      ].map(({ step, label }) => (
        <div key={step} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{step}</div>
          <span style={{ fontSize: 13 }}>{label}</span>
        </div>
      ))}
      <div style={{ marginTop: 18, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, fontSize: 12, lineHeight: 1.6, color: '#92400e' }}>
        📅 申請期限：毎月末日<br />
        ※ 申請内容は管理者が確認後に承認されます
      </div>
    </div>
  )
}

export default function RightPanel({ view, selection, onClose, onNavigate, onSelectMember, onUpdateSlide, onUpdateSlideLive, onAddMember, onAddContract, onAddApiKey, applicationFocusField }: Props) {
  if (selection) {
    const backLabel = selection.kind === 'member' ? 'メンバー一覧'
      : selection.kind === 'contract' ? '契約一覧'
      : selection.kind === 'apikey' ? 'APIキー一覧'
      : selection.kind === 'software' ? 'ソフトウェア一覧'
      : selection.kind === 'apiservice' ? 'API一覧'
      : selection.kind === 'application' ? '申請書一覧'
      : 'AIツール一覧'
    return (
      <aside className="rightbar detail">
        {selection.kind !== 'software' && selection.kind !== 'application' && (
          <button className="rb-back" onClick={onClose}>← {backLabel}に戻る</button>
        )}
        {selection.kind === 'member' && <MemberDrawer inline member={selection.item} mode={selection.mode} onClose={onClose} onSelectMember={onSelectMember} />}
        {selection.kind === 'contract' && <ContractDrawer inline contract={selection.item} mode={selection.mode} onClose={onClose} />}
        {selection.kind === 'apikey' && <ApiKeyDrawer inline apiKey={selection.item} mode={selection.mode} onClose={onClose} />}
        {selection.kind === 'aiplan' && <AiPlanDetail p={selection.item} />}
        {selection.kind === 'software' && <SoftwareDetail name={selection.item} />}
        {selection.kind === 'apiservice' && <ApiServiceDetail service={selection.item} />}
        {selection.kind === 'application' && (
          <ApplicationSlideDrawer
            key={selection.item.id}
            slide={selection.item}
            onChange={(updated) => onUpdateSlideLive?.(updated)}
            onSave={(updated) => onUpdateSlide?.(updated)}
            onClose={onClose}
            focusField={applicationFocusField}
          />
        )}
      </aside>
    )
  }

  let defaultContent: React.ReactNode
  switch (view) {
    case 'software':
    case 'survey':
      defaultContent = <HomeSummaryPanel onNavigate={onNavigate} />
      break
    case 'members':
      defaultContent = <MemberSummaryPanel onAddMember={onAddMember} />
      break
    case 'contracts':
      defaultContent = <ContractSummaryPanel onAddContract={onAddContract} />
      break
    case 'budget':
    case 'api':
      defaultContent = <BudgetSummaryPanel view={view} onAddApiKey={onAddApiKey} />
      break
    case 'application':
      defaultContent = <ApplicationGuidePanel />
      break
    default:
      defaultContent = <div className="drawer-body"><ToolUsageOverview /></div>
  }

  return (
    <aside className="rightbar">
      {defaultContent}
    </aside>
  )
}
