import { useMemo, useState, useEffect } from 'react'
import { useStore } from '../store'
import { CATEGORY_COLORS, metaOf, AI_MODEL_ICONS, API_SERVICE_ICONS } from '../data/software'
import type { SoftwareMeta } from '../data/types'
import { SEED_AI_PLANS, AI_MODEL_URLS, type AiPlan } from '../data/aiplans'
import { computeSpend } from '../data/budgets'
import { computeOptimization, type OptRow } from '../data/usage'
import { yen } from '../utils'
import type { ApiKey } from '../data/apikeys'

// タブ: すべて / Adobe / Autodesk / DCCツール / AIツール / API
// DCCツールは meta.dcc===true のものを分類（3ds Max は Autodesk vendor だが DCC タブに表示）
type VendorGroup = {
  key: string
  label: string
  color: string
  match?: (sw: string, meta: ReturnType<typeof metaOf>) => boolean
}
const VENDOR_GROUPS: VendorGroup[] = [
  { key: 'all',      label: 'すべて',    color: '' },
  { key: 'adobe',    label: 'Adobe',     color: '#e11d48', match: (_, m) => groupOf(m) === 'adobe' },
  { key: 'autodesk', label: 'Autodesk',  color: '#1a6bbf', match: (_, m) => groupOf(m) === 'autodesk' },
  { key: 'dcc',      label: 'DCCツール', color: '#64748b', match: (_, m) => groupOf(m) === 'dcc' },
  { key: 'ai',       label: 'AIツール',  color: '#7c3aed', match: (_, m) => groupOf(m) === 'ai' },
  { key: 'api',      label: 'API',       color: '#0891b2', match: (_, m) => groupOf(m) === 'api' },
]

type GroupKey = 'all' | 'adobe' | 'autodesk' | 'dcc' | 'ai' | 'api'
type ToolGroup = Exclude<GroupKey, 'all'>

// 分類の選択肢（ホームのフィルタタブと対応）
const GROUP_OPTIONS: { key: ToolGroup; label: string }[] = [
  { key: 'adobe',    label: 'Adobe' },
  { key: 'autodesk', label: 'Autodesk' },
  { key: 'dcc',      label: 'DCCツール' },
  { key: 'ai',       label: 'AIツール' },
  { key: 'api',      label: 'API' },
]

// meta から表示分類を判定（明示の group があれば優先、なければベンダー等から推定）
function groupOf(meta: SoftwareMeta): ToolGroup {
  if (meta.group) return meta.group
  if (meta.vendor === 'Adobe') return 'adobe'
  if (meta.vendor === 'Autodesk' && !meta.dcc) return 'autodesk'
  if (meta.dcc || ['Trimble', 'Dassault', 'Epic Games', 'Chaos'].includes(meta.vendor)) return 'dcc'
  if (meta.category === 'AI') return 'ai'
  return 'dcc'
}

// 分類に対応するカテゴリ（カードの色・サブタイトル表示用）
function categoryForGroup(g: ToolGroup): SoftwareMeta['category'] {
  switch (g) {
    case 'adobe': return 'クリエイティブ'
    case 'autodesk': return 'CAD/3D'
    case 'dcc': return 'CAD/3D'
    case 'ai': return 'AI'
    case 'api': return 'その他'
  }
}

const DISPLAY_NAMES: Record<string, string> = {
  Autocad: 'AutoCAD', AutocadLT: 'AutoCAD LT', acrobat: 'Acrobat',
  photoshop: 'Photoshop', sketchup: 'SketchUp', solidworks: 'SolidWorks',
  CreativeCloud: 'Creative Cloud', 'Adobe Express': 'Adobe Express',
  Midjourney: 'Midjourney', chatGPT: 'ChatGPT', Twinmotion: 'Twinmotion',
  Revit: 'Revit', KreaAI: 'Krea AI', Genspark: 'Genspark', Tripo: 'Tripo', GoogleAI: 'Google AI',
}
function swLabel(sw: string): string {
  const meta = metaOf(sw)
  // If customMeta has an explicit name different from the key, use it (user override)
  const customName = meta.name !== sw ? meta.name : undefined
  return customName ?? DISPLAY_NAMES[sw] ?? sw
}

const AI_DISPLAY: Record<string, string> = {
  chatGPT: 'ChatGPT', KreaAI: 'Krea AI', Adobeexpress: 'Adobe Express', 'Google AI': 'Google AI',
}
function aiLabel(model: string): string { return AI_DISPLAY[model] ?? model }

// ---------- API サービス雁E��E----------
type ApiService = {
  service: string; keys: ApiKey[]; activeCount: number
  totalUsage: number; totalBudget: number; consoleUrl?: string
}
function groupApiKeys(apiKeys: ApiKey[]): ApiService[] {
  const map = new Map<string, ApiService>()
  for (const k of apiKeys) {
    const s = map.get(k.service) ?? {
      service: k.service, keys: [], activeCount: 0,
      totalUsage: 0, totalBudget: 0, consoleUrl: k.consoleUrl,
    }
    s.keys.push(k)
    if (k.status === '有効') s.activeCount++
    s.totalUsage += k.monthlyUsage
    s.totalBudget += k.monthlyBudget
    map.set(k.service, s)
  }
  return [...map.values()].sort((a, b) => b.totalUsage - a.totalUsage)
}

// ---------- 予算バナ�E ----------
function BudgetBanner({ year }: { year: number }) {
  const { contracts, apiKeys, budgets } = useStore()
  const spend = useMemo(() => computeSpend(contracts, SEED_AI_PLANS, apiKeys), [contracts, apiKeys])
  const totals = useMemo(() => {
    const budget = budgets.filter((b) => b.year === year).reduce((s, b) => s + b.amount, 0)
    const actual = spend.filter((s) => s.year === year).reduce((sum, x) => sum + x.amount, 0)
    const diff = budget - actual
    return { budget, actual, diff, rate: budget ? actual / budget : 0 }
  }, [budgets, spend, year])

  return (
    <div className="budget-banner">
      <div className="bb-kpis">
        <div className="bb-kpi"><div className="bb-kpi-label">年間予算</div><div className="bb-kpi-val">{yen(totals.budget)}</div></div>
        <div className="bb-kpi"><div className="bb-kpi-label">支払い実績・年額</div><div className="bb-kpi-val">{yen(totals.actual)}</div></div>
        <div className="bb-kpi">
          <div className="bb-kpi-label">{totals.diff < 0 ? '予算超過' : '予算残'}</div>
          <div className="bb-kpi-val" style={{ color: totals.diff < 0 ? '#e11d48' : '#16a34a' }}>{yen(Math.abs(totals.diff))}</div>
        </div>
        <div className="bb-kpi bb-kpi-last">
          <div className="bb-kpi-label">予算消化率</div>
          <div className="bb-kpi-val" style={{ color: totals.rate > 1 ? '#e11d48' : totals.rate > 0.9 ? '#f59e0b' : undefined }}>
            {(totals.rate * 100).toFixed(0)}<span className="bb-unit">%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SwIconImg({ src, fallback, bg }: { src?: string; fallback: string; bg: string }) {
  if (src) {
    return (
      <div className="sw-icon" style={{ background: 'var(--surface-2, #f1f5f9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={src} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
      </div>
    )
  }
  return <div className="sw-icon" style={{ background: bg }}>{fallback}</div>
}

// ---------- 最適化判断�E�カード�Eコンパクト表示�E�E----------
type CardVerdict = { kind: 'add' | 'cut' | 'ok'; num: string; sub: string; seats: number; required: number }

const CARD_VERDICT_STYLE = {
  add: { bg: '#fcebeb', fg: '#a32d2d', icon: '+', label: '増やす' },
  cut: { bg: '#faeeda', fg: '#854f0b', icon: '-', label: '減らせる' },
  ok:  { bg: '#e1f5ee', fg: '#0f6e56', icon: '✓', label: '適正' },
} as const

function toCardVerdict(r: OptRow): CardVerdict {
  if (r.rec.kind === 'shortage') {
    return { kind: 'add', num: `+${r.shortage}本`, sub: `必要 ${r.required} > 契約 ${r.seats}`, seats: r.seats, required: r.required }
  }
  if (r.rec.kind === 'reduce' || r.rec.kind === 'surplus') {
    const sub = r.savings >= 10000
      ? `年${Math.round(r.savings / 10000)}万円削減可`
      : `契約 ${r.seats} > 必要 ${r.required}`
    return { kind: 'cut', num: `-${r.surplus}本`, sub, seats: r.seats, required: r.required }
  }
  return { kind: 'ok', num: '', sub: '', seats: r.seats, required: r.required }
}

type CardData = { sw: string; meta: ReturnType<typeof metaOf>; count: number; cost: number }

function SwCard({ sw, meta, count, cost, onOpen, selected, optVerdict, onEdit }: CardData & {
  onOpen: (sw: string) => void
  selected?: boolean
  optVerdict?: CardVerdict
  onEdit?: (sw: string) => void
}) {
  const c = CATEGORY_COLORS[meta.category]
  const vs = optVerdict ? CARD_VERDICT_STYLE[optVerdict.kind] : null
  const barMax = optVerdict ? Math.max(optVerdict.seats, optVerdict.required, 1) : 1

  return (
    <div
      className={'card sw-card' + (selected ? ' selected' : '')}
      onClick={(e) => { e.stopPropagation(); onOpen(sw) }}
      style={{ cursor: 'pointer', '--sw-accent': c, position: 'relative' } as React.CSSProperties}
    >
      {onEdit && (
        <button
          className="sw-edit-btn"
          onClick={(e) => { e.stopPropagation(); onEdit(sw) }}
          title="ツールを編集"
        >
          ✎
        </button>
      )}
      <div className="sw-head">
        <SwIconImg src={meta.icon} fallback={swLabel(sw).slice(0, 1).toUpperCase()} bg={c} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sw-name">{swLabel(sw)}</div>
          <div className="sw-vendor">{meta.vendor} · {meta.category}</div>
        </div>
      </div>
      <div className="sw-stats">
        <div className="sw-stat"><div className="n">{count}</div><div className="l">利用者数</div></div>
        <div className="sw-stat sw-stat-r"><div className="n sw-stat-sm">{yen(meta.monthlyCost)}</div><div className="l">1本月額</div></div>
        <div className="sw-stat"><div className="n sw-stat-sm">{yen(cost)}</div><div className="l">月額（概算）</div></div>
        <div className="sw-stat sw-stat-r"><div className="n sw-stat-sm" style={{ color: c }}>{yen(cost * 12)}</div><div className="l">年額（概算）</div></div>
      </div>

      {optVerdict && vs && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: optVerdict.kind !== 'ok' ? 6 : 0 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: vs.bg, color: vs.fg }}>
              {vs.icon} {vs.label}{optVerdict.num ? ' ' + optVerdict.num : ''}
            </span>
            {optVerdict.sub && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{optVerdict.sub}</span>
            )}
          </div>
          {optVerdict.kind !== 'ok' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {([
                { label: '契約', value: optVerdict.seats, color: '#378add' },
                { label: '必要', value: optVerdict.required, color: optVerdict.kind === 'add' ? '#a32d2d' : '#854f0b' },
              ] as const).map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', width: 22, textAlign: 'right' }}>{label}</span>
                  <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: ((value / barMax) * 100) + '%', background: color, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, width: 24 }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {meta.url && (
        <a className="sw-link" href={meta.url} target="_blank" rel="noopener noreferrer" style={{ color: c }} onClick={(e) => e.stopPropagation()}>
          管理画面で状況を確認
        </a>
      )}

    </div>
  )
}

const TODAY = '2026-06-25'
function AiPlanCard({ p, onOpen }: { p: AiPlan; onOpen: (p: AiPlan) => void }) {
  const aiColor = '#7c3aed'
  const overdue = p.renewalDate && p.renewalDate < TODAY
  const url = AI_MODEL_URLS[p.model]
  return (
    <div className="card sw-card" onClick={(e) => { e.stopPropagation(); onOpen(p) }} style={{ cursor: 'pointer' }}>
      <div className="sw-head">
        <SwIconImg src={AI_MODEL_ICONS[p.model]} fallback={aiLabel(p.model).slice(0, 1).toUpperCase()} bg={aiColor} />
        <div>
          <div className="sw-name">{aiLabel(p.model)}</div>
          <div className="sw-vendor">{p.plan} · AIツール</div>
        </div>
      </div>
      <div className="sw-stats">
        <div className="sw-stat"><div className="n">{p.seats}</div><div className="l">契約本数</div></div>
        <div className="sw-stat" style={{ textAlign: 'right' }}>
          <div className="n" style={{ fontSize: 16 }}>{yen(p.estMonthlyJpy)}</div><div className="l">月額概算</div>
        </div>
      </div>
      {p.renewalText && (
        <div style={{ fontSize: 11.5, color: overdue ? '#e11d48' : 'var(--text-muted)', marginTop: 8 }}>
          更新 {p.renewalText}
        </div>
      )}
      {url && (
        <a className="sw-link" href={url} target="_blank" rel="noopener noreferrer" style={{ color: aiColor }} onClick={(e) => e.stopPropagation()}>
          管理画面で状況を確認
        </a>
      )}
    </div>
  )
}

function ApiServiceCard({ svc, onOpen }: { svc: ApiService; onOpen: (service: string) => void }) {
  const apiColor = '#0891b2'
  const ratio = svc.totalBudget > 0 ? svc.totalUsage / svc.totalBudget : 0
  const over = ratio > 1; const warn = ratio > 0.85
  return (
    <div className="card sw-card" onClick={(e) => { e.stopPropagation(); onOpen(svc.service) }} style={{ cursor: 'pointer' }}>
      <div className="sw-head">
        <SwIconImg src={API_SERVICE_ICONS[svc.service]} fallback={svc.service.slice(0, 1).toUpperCase()} bg={apiColor} />
        <div>
          <div className="sw-name">{svc.service}</div>
          <div className="sw-vendor">
            {svc.activeCount} キー有効
            {svc.keys.length > svc.activeCount && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>/ {svc.keys.length}本</span>}
            {' · '}API
          </div>
        </div>
      </div>
      <div style={{ margin: '10px 0 6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          <span>今月の利用額</span>
          <span style={{ fontWeight: 600, color: over ? '#e11d48' : warn ? '#f59e0b' : 'var(--text)' }}>{(ratio * 100).toFixed(0)}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: Math.min(100, ratio * 100) + '%', background: over ? '#e11d48' : warn ? '#f59e0b' : apiColor, borderRadius: 3 }} />
        </div>
      </div>
      <div className="sw-stats" style={{ marginTop: 6 }}>
        <div className="sw-stat"><div className="n" style={{ fontSize: 17 }}>{yen(svc.totalUsage)}</div><div className="l">今月の利用額</div></div>
        <div className="sw-stat" style={{ textAlign: 'right' }}>
          <div className="n" style={{ fontSize: 14, color: 'var(--text-muted)' }}>{yen(svc.totalBudget)}</div><div className="l">月予算</div>
        </div>
      </div>
      {svc.consoleUrl && (
        <a className="sw-link" href={svc.consoleUrl} target="_blank" rel="noopener noreferrer" style={{ color: apiColor }} onClick={(e) => e.stopPropagation()}>
          管理画面で状況を確認
        </a>
      )}
    </div>
  )
}

// ---------- ツール編集モーダル ----------
function EditToolModal({ sw, isCustom, isArchived, onClose, onSave, onToggleArchive, onDelete }: {
  sw: string
  isCustom: boolean
  isArchived: boolean
  onClose: () => void
  onSave: (patch: Partial<SoftwareMeta>) => void
  onToggleArchive: () => void
  onDelete: () => void
}) {
  const currentMeta = metaOf(sw)
  const [name, setName] = useState(swLabel(sw))
  const [icon, setIcon] = useState<string | undefined>(currentMeta.icon)
  const [url, setUrl] = useState(currentMeta.url ?? '')
  const [vendor, setVendor] = useState(currentMeta.vendor === '—' ? '' : currentMeta.vendor)
  const [grp, setGrp] = useState<ToolGroup>(groupOf(currentMeta))
  const [cost, setCost] = useState(String(currentMeta.monthlyCost ?? 0))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const c = CATEGORY_COLORS[categoryForGroup(grp)]

  function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setIcon(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleSave() {
    onSave({
      name,
      icon,
      url: url.trim() || undefined,
      vendor: vendor.trim() || '—',
      group: grp,
      category: categoryForGroup(grp),
      monthlyCost: Number(cost) || 0,
      dcc: grp === 'dcc',
    })
    onClose()
  }

  const fieldLabel: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }
  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 11px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface-2)', color: 'var(--text)' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: 16, width: 440, maxWidth: '95vw', maxHeight: '90vh', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{swLabel(sw)} を編集</h3>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', lineHeight: 1, padding: '2px 6px', borderRadius: 6 }} onClick={onClose}>✕</button>
        </div>

        {/* スクロール可能なボディ */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ロゴ */}
          <div>
            <div style={fieldLabel}>ロゴ</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SwIconImg src={icon} fallback={name.slice(0, 1).toUpperCase()} bg={c} />
              <label style={{ cursor: 'pointer', fontSize: 13, padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text)' }}>
                画像を変更
                <input type="file" accept="image/*" onChange={handleIconUpload} style={{ display: 'none' }} />
              </label>
              {icon && (
                <button onClick={() => setIcon(undefined)} style={{ fontSize: 12, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  削除
                </button>
              )}
            </div>
          </div>

          {/* ツール名 */}
          <div>
            <div style={fieldLabel}>ツール名</div>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>

          {/* ベンダー */}
          <div>
            <div style={fieldLabel}>ベンダー</div>
            <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="例: Adobe" style={inputStyle} />
          </div>

          {/* 分類 */}
          <div>
            <div style={fieldLabel}>分類</div>
            <select value={grp} onChange={(e) => setGrp(e.target.value as ToolGroup)} style={{ ...inputStyle, appearance: 'auto' }}>
              {GROUP_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 5 }}>ホーム画面でこの分類のタブに表示されます</div>
          </div>

          {/* 月額 */}
          <div>
            <div style={fieldLabel}>1ライセンス月額（円）</div>
            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" style={inputStyle} />
          </div>

          {/* 管理画面URL */}
          <div>
            <div style={fieldLabel}>管理画面URL</div>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
            {url.trim() && (
              <a href={url.trim()} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 6, fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>
                ↗ 確認する
              </a>
            )}
          </div>

          {/* 区切り: アーカイブ・削除 */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>その他の操作</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={onToggleArchive}
                style={{ fontSize: 12, padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 7, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                {isArchived ? 'アーカイブ解除' : 'アーカイブ'}
              </button>
              {isCustom && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)}
                  style={{ fontSize: 12, padding: '6px 14px', border: '1px solid #fca5a5', borderRadius: 7, background: 'none', cursor: 'pointer', color: '#e11d48' }}>
                  削除
                </button>
              )}
              {isCustom && confirmDelete && (
                <>
                  <button onClick={onDelete}
                    style={{ fontSize: 12, padding: '6px 14px', borderRadius: 7, background: '#e11d48', border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 700 }}>
                    本当に削除する
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    style={{ fontSize: 12, padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 7, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    キャンセル
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 固定フッター */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)' }}>
          <button
            onClick={onClose}
            style={{ fontSize: 13, padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 9, background: 'none', cursor: 'pointer', color: 'var(--text)' }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            style={{ fontSize: 13, padding: '8px 22px', borderRadius: 9, background: name.trim() ? 'var(--primary)' : 'var(--border)', border: 'none', cursor: name.trim() ? 'pointer' : 'not-allowed', color: '#fff', fontWeight: 700 }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- ツール管理パネル ----------

function ToolManagePanel({ software, archivedSoftware, customSoftware, onClose, onToggleArchive, onAddTool, onEditTool }: {
  software: string[]
  archivedSoftware: string[]
  customSoftware: string[]
  onClose: () => void
  onToggleArchive: (sw: string) => void
  onAddTool: (key: string, meta: Omit<SoftwareMeta, 'name'>) => void
  onEditTool: (sw: string) => void
}) {
  const [mode, setMode] = useState<'list' | 'add'>('list')
  const [addName, setAddName] = useState('')
  const [addVendor, setAddVendor] = useState('')
  const [addIcon, setAddIcon] = useState<string | undefined>()
  const [addGroup, setAddGroup] = useState<ToolGroup>('adobe')
  const [addCost, setAddCost] = useState('')

  const activeSw = software.filter((sw) => !archivedSoftware.includes(sw))
  const archivedSw = software.filter((sw) => archivedSoftware.includes(sw))

  function handleIconFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAddIcon(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleAdd() {
    if (!addName.trim()) return
    const key = addName.trim().replace(/\s+/g, '_')
    onAddTool(key, {
      vendor: addVendor.trim() || '—',
      group: addGroup,
      category: categoryForGroup(addGroup),
      monthlyCost: Number(addCost) || 0,
      icon: addIcon,
      dcc: addGroup === 'dcc',
    })
    setMode('list')
    setAddName(''); setAddVendor(''); setAddIcon(undefined); setAddCost(''); setAddGroup('adobe')
  }

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }
  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface-2)', color: 'var(--text)' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{ width: 420, maxWidth: '95vw', height: '100%', background: 'var(--surface)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 32px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {mode === 'add' && (
              <button onClick={() => setMode('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '0 4px' }}>←</button>
            )}
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              {mode === 'add' ? '新しいツールを追加' : 'ツール管理'}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', padding: '2px 6px' }}>✕</button>
        </div>

        {mode === 'list' ? (
          <>
            {/* ツール一覧 */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {activeSw.length > 0 && (
                <div>
                  <div style={{ padding: '10px 20px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    表示中 — {activeSw.length}本
                  </div>
                  {activeSw.map((sw) => {
                    const meta = metaOf(sw)
                    return (
                      <div key={sw} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px', borderBottom: '1px solid var(--border)' }}>
                        <SwIconImg src={meta.icon} fallback={swLabel(sw).slice(0, 1).toUpperCase()} bg={CATEGORY_COLORS[meta.category]} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{swLabel(sw)}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{meta.vendor} · {meta.category}</div>
                        </div>
                        <button
                          onClick={() => onEditTool(sw)}
                          style={{ fontSize: 11.5, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--primary)', flexShrink: 0 }}
                        >
                          編集
                        </button>
                        <button
                          onClick={() => onToggleArchive(sw)}
                          style={{ fontSize: 11.5, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}
                        >
                          非表示
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {archivedSw.length > 0 && (
                <div>
                  <div style={{ padding: '10px 20px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    アーカイブ済み — {archivedSw.length}本
                  </div>
                  {archivedSw.map((sw) => {
                    const meta = metaOf(sw)
                    return (
                      <div key={sw} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px', borderBottom: '1px solid var(--border)', opacity: 0.55 }}>
                        <SwIconImg src={meta.icon} fallback={swLabel(sw).slice(0, 1).toUpperCase()} bg={CATEGORY_COLORS[meta.category]} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{swLabel(sw)}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{meta.vendor} · {meta.category}</div>
                        </div>
                        <button
                          onClick={() => onEditTool(sw)}
                          style={{ fontSize: 11.5, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--primary)', flexShrink: 0, opacity: 1 }}
                        >
                          編集
                        </button>
                        <button
                          onClick={() => onToggleArchive(sw)}
                          style={{ fontSize: 11.5, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text)', flexShrink: 0, opacity: 1 }}
                        >
                          表示する
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* フッター: 追加ボタン */}
            <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', flexShrink: 0 }}>
              <button
                onClick={() => setMode('add')}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1.5px dashed var(--border)', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}
              >
                + 新しいツールを追加
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 追加フォーム */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* ロゴ */}
              <div>
                <div style={labelStyle}>ロゴ（任意）</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {addIcon
                    ? <SwIconImg src={addIcon} fallback="?" bg="#64748b" />
                    : <div style={{ width: 44, height: 44, borderRadius: 11, border: '2px dashed var(--border)', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: 20 }}>+</div>
                  }
                  <label style={{ cursor: 'pointer', fontSize: 13, padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text)' }}>
                    画像を選択
                    <input type="file" accept="image/*" onChange={handleIconFile} style={{ display: 'none' }} />
                  </label>
                  {addIcon && (
                    <button onClick={() => setAddIcon(undefined)} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>削除</button>
                  )}
                </div>
              </div>

              {/* ツール名 */}
              <div>
                <div style={labelStyle}>ツール名 *</div>
                <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="例: Figma" style={inputStyle} />
              </div>

              {/* ベンダー */}
              <div>
                <div style={labelStyle}>ベンダー</div>
                <input value={addVendor} onChange={(e) => setAddVendor(e.target.value)} placeholder="例: Figma Inc." style={inputStyle} />
              </div>

              {/* 分類 */}
              <div>
                <div style={labelStyle}>分類</div>
                <select value={addGroup} onChange={(e) => setAddGroup(e.target.value as ToolGroup)} style={{ ...inputStyle, appearance: 'auto' }}>
                  {GROUP_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 5 }}>ホーム画面でこの分類のタブに表示されます</div>
              </div>

              {/* 月額 */}
              <div>
                <div style={labelStyle}>1ライセンス月額（円）</div>
                <input type="number" value={addCost} onChange={(e) => setAddCost(e.target.value)} placeholder="0" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <button onClick={() => setMode('list')} style={{ fontSize: 13, padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--text)' }}>
                キャンセル
              </button>
              <button
                onClick={handleAdd}
                disabled={!addName.trim()}
                style={{ fontSize: 13, padding: '7px 20px', borderRadius: 8, background: addName.trim() ? 'var(--primary)' : 'var(--border)', border: 'none', cursor: addName.trim() ? 'pointer' : 'not-allowed', color: '#fff', fontWeight: 600 }}
              >
                追加
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ label: lbl, color, count }: { label: string; color: string; count: number }) {
  return (
    <div className="sw-section-header" onClick={(e) => e.stopPropagation()}>
      <span className="sw-section-dot" style={{ background: color }} />
      <span className="sw-section-label">{lbl}</span>
      <span className="sw-section-count">{count}</span>
      <div className="sw-section-line" />
    </div>
  )
}

// ---------- メインコンポーネント ----------
const SW_GROUPS = VENDOR_GROUPS.filter((g) => g.key !== 'all' && g.key !== 'ai' && g.key !== 'api')

interface SoftwareProps {
  onOpen: (sw: string) => void
  onOpenAiPlan: (plan: AiPlan) => void
  onOpenApiService: (service: string) => void
  onClose?: () => void
  selectedSw?: string | null
  year: number
}

export default function Software({ onOpen, onOpenAiPlan, onOpenApiService, onClose, selectedSw, year }: SoftwareProps) {
  const { members, software, archivedSoftware, customSoftware, contracts, apiKeys, usage,
          archiveSoftware, unarchiveSoftware, updateSoftwareMeta, removeSoftwareTool, addSoftwareTool } = useStore()
  const [group, setGroup] = useState<GroupKey>('all')
  const [editingSw, setEditingSw] = useState<string | null>(null)
  const [showManage, setShowManage] = useState(false)

  const activeSoftware = useMemo(() => software.filter((sw) => !archivedSoftware.includes(sw)), [software, archivedSoftware])

  const cards = useMemo(
    () => activeSoftware
      .map((sw) => {
        const meta = metaOf(sw)
        const users = members.filter((m) => m.licenses.includes(sw))
        return { sw, meta, count: users.length, cost: users.length * meta.monthlyCost }
      })
      .sort((a, b) => b.count - a.count),
    [members, activeSoftware],
  )

  const apiServices = useMemo(() => groupApiKeys(apiKeys), [apiKeys])

  const { rows: optRows } = useMemo(
    () => computeOptimization(members, software, contracts, usage),
    [members, software, contracts, usage],
  )

  const verdictOf = (sw: string): CardVerdict | undefined => {
    const r = optRows.find((row) => row.software === sw)
    return r ? toCardVerdict(r) : undefined
  }

  // Arrow keys select previous/next software card
  useEffect(() => {
    if (!selectedSw) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      const t = e.target as Element
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      e.preventDefault()
      const idx = cards.findIndex((c) => c.sw === selectedSw)
      if (idx === -1) return
      const next = (e.key === 'ArrowRight' || e.key === 'ArrowDown')
        ? (idx + 1) % cards.length
        : (idx - 1 + cards.length) % cards.length
      onOpen(cards[next].sw)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedSw, cards, onOpen])

  // Return to summary when clicking empty card area
  const dismissOn = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  // AI/API は組み込みツールが AIプラン/APIサービスとして表示されるため、
  // カードとして表示するのはユーザーが追加したカスタムツールのみ（重複防止）
  const aiCards = useMemo(
    () => cards.filter((c) => groupOf(c.meta) === 'ai' && customSoftware.includes(c.sw)),
    [cards, customSoftware],
  )
  const apiCards = useMemo(
    () => cards.filter((c) => groupOf(c.meta) === 'api' && customSoftware.includes(c.sw)),
    [cards, customSoftware],
  )

  const countOf = (gkey: GroupKey) => {
    if (gkey === 'all') return cards.length
    if (gkey === 'ai') return SEED_AI_PLANS.length + aiCards.length
    if (gkey === 'api') return apiServices.length + apiCards.length
    const g = VENDOR_GROUPS.find((v) => v.key === gkey)
    if (!g?.match) return cards.length
    return cards.filter((c) => g.match!(c.sw, c.meta)).length
  }

  const filtered = useMemo(() => {
    if (group === 'all' || group === 'ai' || group === 'api') return cards
    const g = VENDOR_GROUPS.find((v) => v.key === group)
    if (!g?.match) return cards
    return cards.filter((c) => g.match!(c.sw, c.meta))
  }, [cards, group])

  return (
    <div>
      <BudgetBanner year={year} />

      {/* フィルタータブ + ツール管理ボタン */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }} onClick={(e) => e.stopPropagation()}>
        <div className="subnav" style={{ flex: 1, marginBottom: 0 }}>
          {VENDOR_GROUPS.map((g) => (
            <button key={g.key} className={'subtab' + (group === g.key ? ' active' : '')} onClick={() => setGroup(g.key as GroupKey)}>
              {g.color && <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color, display: 'inline-block', marginRight: 5, verticalAlign: 'middle' }} />}
              {g.label}
              <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.6, fontWeight: 400 }}>{countOf(g.key as GroupKey)}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowManage(true)}
          style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <span style={{ fontSize: 14 }}>⚙</span> ツール管理
        </button>
      </div>

      {group === 'all' ? (
        <div className="sw-sections" onClick={dismissOn}>
          {SW_GROUPS.map((g) => {
            const sc = g.match ? cards.filter((c) => g.match!(c.sw, c.meta)) : cards
            if (sc.length === 0) return null
            return (
              <div key={g.key} className="sw-section" onClick={dismissOn}>
                <SectionHeader label={g.label} color={g.color} count={sc.length} />
                <div className="sw-grid-3" onClick={dismissOn}>
                  {sc.map((d) => (
                    <SwCard
                      key={d.sw} {...d} onOpen={onOpen}
                      selected={selectedSw === d.sw}
                      optVerdict={verdictOf(d.sw)}
                      onEdit={setEditingSw}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          <div className="sw-section" onClick={dismissOn}>
            <SectionHeader label="AIツール" color="#7c3aed" count={SEED_AI_PLANS.length + aiCards.length} />
            <div className="sw-grid-3" onClick={dismissOn}>
              {SEED_AI_PLANS.map((p) => <AiPlanCard key={p.id} p={p} onOpen={onOpenAiPlan} />)}
              {aiCards.map((d) => (
                <SwCard key={d.sw} {...d} onOpen={onOpen} selected={selectedSw === d.sw} optVerdict={verdictOf(d.sw)} onEdit={setEditingSw} />
              ))}
            </div>
          </div>
          {(apiServices.length > 0 || apiCards.length > 0) && (
            <div className="sw-section" onClick={dismissOn}>
              <SectionHeader label="API" color="#0891b2" count={apiServices.length + apiCards.length} />
              <div className="sw-grid-3" onClick={dismissOn}>
                {apiServices.map((svc) => <ApiServiceCard key={svc.service} svc={svc} onOpen={onOpenApiService} />)}
                {apiCards.map((d) => (
                  <SwCard key={d.sw} {...d} onOpen={onOpen} selected={selectedSw === d.sw} optVerdict={verdictOf(d.sw)} onEdit={setEditingSw} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : group === 'ai' ? (
        <div className="sw-grid-3" onClick={dismissOn}>
          {SEED_AI_PLANS.map((p) => <AiPlanCard key={p.id} p={p} onOpen={onOpenAiPlan} />)}
          {aiCards.map((d) => (
            <SwCard key={d.sw} {...d} onOpen={onOpen} selected={selectedSw === d.sw} optVerdict={verdictOf(d.sw)} onEdit={setEditingSw} />
          ))}
        </div>
      ) : group === 'api' ? (
        <div className="sw-grid-3" onClick={dismissOn}>
          {apiServices.map((svc) => <ApiServiceCard key={svc.service} svc={svc} onOpen={onOpenApiService} />)}
          {apiCards.map((d) => (
            <SwCard key={d.sw} {...d} onOpen={onOpen} selected={selectedSw === d.sw} optVerdict={verdictOf(d.sw)} onEdit={setEditingSw} />
          ))}
          {apiServices.length === 0 && apiCards.length === 0 && <div className="empty" style={{ gridColumn: '1/-1' }}>APIキーチE�Eタがありません</div>}
        </div>
      ) : (
        <div className="sw-grid-3" onClick={dismissOn}>
          {filtered.map((d) => (
            <SwCard
              key={d.sw} {...d} onOpen={onOpen}
              selected={selectedSw === d.sw}
              optVerdict={verdictOf(d.sw)}
              onEdit={setEditingSw}
            />
          ))}
          {filtered.length === 0 && <div className="empty" style={{ gridColumn: '1/-1' }}>こ�EカチE��リのソフトはありません</div>}
        </div>
      )}

      {editingSw && (
        <EditToolModal
          sw={editingSw}
          isCustom={customSoftware.includes(editingSw)}
          isArchived={archivedSoftware.includes(editingSw)}
          onClose={() => setEditingSw(null)}
          onSave={(patch) => { updateSoftwareMeta(editingSw, patch) }}
          onToggleArchive={() => {
            if (archivedSoftware.includes(editingSw)) unarchiveSoftware(editingSw)
            else archiveSoftware(editingSw)
            setEditingSw(null)
          }}
          onDelete={() => {
            removeSoftwareTool(editingSw)
            setEditingSw(null)
          }}
        />
      )}

      {showManage && (
        <ToolManagePanel
          software={software}
          archivedSoftware={archivedSoftware}
          customSoftware={customSoftware}
          onClose={() => setShowManage(false)}
          onToggleArchive={(sw) => {
            if (archivedSoftware.includes(sw)) unarchiveSoftware(sw)
            else archiveSoftware(sw)
          }}
          onAddTool={addSoftwareTool}
          onEditTool={(sw) => setEditingSw(sw)}
        />
      )}
    </div>
  )
}
