import { useState, useEffect, useRef, useMemo } from 'react'
import type { Slide, ActionItem, OptBreakdown, OptItem, OptItemKind, SlideSectionKey } from '../data/application'
import { SOFTWARE_CATALOG, OPT_KIND_META, optKindMeta, optItemSeats, optAfterSeats, optDeltaTerms, SLIDE_SECTIONS } from '../data/application'
import { useStore } from '../store'
import { computeOptimization, deriveBreakdown } from '../data/usage'

const BADGES: Slide['badge'][] = ['追加購入', '新規申請', '現状維持']
const BADGE_COLORS: Record<Slide['badge'], string> = {
  '更新集約': '#2563eb',
  '追加購入': '#0891b2',
  '新規申請': '#7c3aed',
  '現状維持': '#db2777',
}

const css = {
  field: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    fontSize: 13.5,
    color: 'var(--text)',
    background: 'var(--bg)',
    border: '1.5px solid var(--border)',
    borderRadius: 8,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '9px 12px',
    fontSize: 13,
    color: 'var(--text)',
    background: 'var(--bg)',
    border: '1.5px solid var(--border)',
    borderRadius: 8,
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    lineHeight: 1.6,
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  select: {
    width: '100%',
    padding: '9px 12px',
    fontSize: 13.5,
    color: 'var(--text)',
    background: 'var(--bg)',
    border: '1.5px solid var(--border)',
    borderRadius: 8,
    outline: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7688' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: 32,
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
}

function focusStyle(el: HTMLElement | null) {
  if (!el) return
  el.style.borderColor = 'var(--primary)'
  el.style.boxShadow = '0 0 0 3px rgba(59,91,253,0.12)'
  el.style.background = 'var(--surface)'
}
function blurStyle(el: HTMLElement | null) {
  if (!el) return
  el.style.borderColor = ''
  el.style.boxShadow = ''
  el.style.background = 'var(--bg)'
}

type DrawerTab = 'basic' | 'seats' | 'opt' | 'cost' | 'reason' | 'schedule'
const DRAWER_TABS: { key: DrawerTab; label: string; icon: string }[] = [
  { key: 'basic', label: '基本', icon: '🏷' },
  { key: 'seats', label: '本数', icon: '📦' },
  { key: 'opt', label: '内訳', icon: '💡' },
  { key: 'cost', label: '費用', icon: '💴' },
  { key: 'reason', label: '理由', icon: '📝' },
  { key: 'schedule', label: '予定', icon: '🗓' },
]
function tabOfField(f: string): DrawerTab {
  if (f.startsWith('opt.')) return 'opt'
  if (f.startsWith('action-')) return 'schedule'
  if (f === 'costNote') return 'cost'
  if (f === 'reason') return 'reason'
  if (['currentSeats', 'requestSeats', 'requestDate', 'targetRenewalDate', 'currentUsersOverride', 'userDelta'].includes(f)) return 'seats'
  return 'basic'
}

interface Props {
  slide: Slide
  onSave: (updated: Slide) => void
  onChange?: (updated: Slide) => void
  onClose: () => void
  focusField?: string | null
}

export default function ApplicationSlideDrawer({ slide, onSave, onChange, onClose, focusField }: Props) {
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})
  const { applicationGroups, members, software, contracts, usage } = useStore()

  // このソフトの利用実態（最適化内訳の初期値・再取込用）
  const computedBreakdown = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, '')
    const { rows } = computeOptimization(members, software, contracts, usage)
    const row = rows.find((r) => norm(r.software) === norm(slide.software))
    return row && row.assigned > 0 ? deriveBreakdown(row) : null
  }, [members, software, contracts, usage, slide.software])

  const softwareNames = Array.from(new Set([
    ...SOFTWARE_CATALOG.map(s => s.name),
    ...applicationGroups.map(g => g.software),
  ])).sort()

  const vendorSuggestions = Array.from(new Set(
    applicationGroups.flatMap(g => g.submissions.map(s => s.vendor)).filter(Boolean)
  )).sort()

  const purchaseSuggestions = Array.from(new Set(
    applicationGroups.flatMap(g => g.submissions.map(s => s.purchaseVia)).filter(Boolean)
  )).sort()

  const [activeTab, setActiveTab] = useState<DrawerTab>('basic')

  useEffect(() => {
    if (!focusField) return
    const target = tabOfField(focusField)
    if (activeTab !== target) { setActiveTab(target); return } // タブ切替後に再実行
    const el = fieldRefs.current[focusField]
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ;(el as HTMLElement).focus()
    el.style.borderColor = 'var(--primary)'
    el.style.boxShadow = '0 0 0 3px rgba(59,91,253,0.12)'
    el.style.background = 'var(--surface)'
  }, [focusField, activeTab])

  const [draft, setDraft] = useState<Slide>({
    ...slide,
    actions: slide.actions.map((a) => ({ ...a })),
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      onSave(draft)            // Supabaseへ永続化（編集中は onChange で既に表示反映済み）
      setSaving(false)
      setSaved(true)           // 「保存しました」トースト表示
      setTimeout(() => { setSaved(false); onClose() }, 1300)
    }, 600)
  }

  // 編集を draft に反映し、同時に表示画面へライブ反映
  const commit = (next: Slide) => {
    setDraft(next)
    onChange?.(next)
  }

  const set = <K extends keyof Slide>(key: K, val: Slide[K]) =>
    commit({ ...draft, [key]: val })

  const setAction = (i: number, key: keyof ActionItem, val: string) =>
    commit({
      ...draft,
      actions: draft.actions.map((a, idx) => (idx === i ? { ...a, [key]: val } : a)),
    })

  const addAction = () =>
    commit({ ...draft, actions: [...draft.actions, { label: '', detail: '' }] })

  const removeAction = (i: number) =>
    commit({ ...draft, actions: draft.actions.filter((_, idx) => idx !== i) })

  const handleBadgeChange = (badge: Slide['badge']) =>
    commit({ ...draft, badge, badgeColor: BADGE_COLORS[badge] })

  // 最適化内訳：現在値（slide優先 → 利用実態の算出値 → 空）
  const EMPTY_OPT: OptBreakdown = { show: false, items: [] }
  const opt: OptBreakdown = (draft.optBreakdown && Array.isArray(draft.optBreakdown.items))
    ? draft.optBreakdown
    : (computedBreakdown ?? EMPTY_OPT)
  // 内訳が変わったら 申請後＝需要合計、増減＝申請後−現在 で requestSeats を駆動
  const driveRequest = (nextOpt: OptBreakdown) =>
    nextOpt.items.length > 0 ? optAfterSeats(nextOpt) - draft.currentSeats : draft.requestSeats
  const setOpt = (patch: Partial<OptBreakdown>) => {
    const nextOpt = { ...opt, ...patch }
    commit({ ...draft, optBreakdown: nextOpt, requestSeats: driveRequest(nextOpt) })
  }
  const setOptItem = (id: string, patch: Partial<OptItem>) =>
    setOpt({ items: opt.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })
  const removeOptItem = (id: string) =>
    setOpt({ items: opt.items.filter((it) => it.id !== id) })
  const moveOptItem = (id: string, dir: -1 | 1) => {
    const idx = opt.items.findIndex((it) => it.id === id)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= opt.items.length) return
    const items = [...opt.items]
    ;[items[idx], items[j]] = [items[j], items[idx]]
    setOpt({ items })
  }
  const addOptItem = (kind: OptItemKind) => {
    const label = kind === 'shared' ? '2人で1ライセンス' : kind === 'remove' ? '削除対象' : kind === 'reserve' ? '予備' : '現状維持（専有）'
    const it: OptItem = { id: `opt-${Date.now()}-${opt.items.length}`, label, kind, people: 0, ...(kind === 'shared' ? { ratio: 2 } : {}), ...(kind === 'reserve' ? { fixedSeats: 0 } : {}) }
    setOpt({ show: true, items: [...opt.items, it] })
  }
  const reloadOpt = () => {
    const nextOpt: OptBreakdown = computedBreakdown ? { show: true, items: computedBreakdown.items.map((it) => ({ ...it })) } : { show: true, items: [] }
    commit({ ...draft, optBreakdown: nextOpt, requestSeats: driveRequest(nextOpt) })
  }
  // 現在の契約本数を変えたら 増減 を追従（申請後は需要で固定）
  const setCurrentSeats = (v: number) =>
    commit({ ...draft, currentSeats: v, requestSeats: opt.items.length > 0 ? optAfterSeats(opt) - v : draft.requestSeats })
  const optAfter = optAfterSeats(opt)                // 申請後の本数 = 需要合計
  const optDeltaVal = optAfter - draft.currentSeats  // 増減申請本数 = 申請後 − 現在
  const optReduce = optDeltaTerms(opt).filter((t) => t.sign === '-').reduce((s, t) => s + t.value, 0)
  const optAdd = optDeltaTerms(opt).filter((t) => t.sign === '+').reduce((s, t) => s + t.value, 0)

  // セクション表示制御
  const isSectionOn = (key: SlideSectionKey) => draft.sections?.[key] !== false
  const toggleSection = (key: SlideSectionKey) =>
    commit({ ...draft, sections: { ...draft.sections, [key]: !isSectionOn(key) } })

  const color = draft.badgeColor

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* ── ヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '16px 20px 14px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: color + '18', border: `1.5px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>✏️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>スライド編集</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{draft.software}</div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '7px 16px', fontSize: 12.5, fontWeight: 700,
            background: saving ? 'var(--text-faint)' : 'var(--primary)', color: '#fff',
            border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer',
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s',
          }}
        >
          {saving && <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
          保存
        </button>
        <button
          onClick={onClose}
          style={{
            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: '1.5px solid var(--border)', borderRadius: 7,
            cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', flexShrink: 0,
          }}
        >✕</button>
      </div>

      {/* ── タブバー */}
      <div style={{ display: 'flex', gap: 2, padding: '8px 12px 0', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto' }}>
        {DRAWER_TABS.map((t) => {
          const active = activeTab === t.key
          const hidden = (t.key === 'cost' && !isSectionOn('cost')) || (t.key === 'reason' && !isSectionOn('reason')) || (t.key === 'schedule' && !isSectionOn('schedule')) || (t.key === 'opt' && !isSectionOn('optBreakdown'))
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                padding: '7px 11px', border: 'none', borderBottom: `2px solid ${active ? 'var(--primary)' : 'transparent'}`,
                background: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? 'var(--primary)' : 'var(--text-muted)',
                opacity: hidden ? 0.45 : 1,
              }}
              title={hidden ? '申請書では非表示' : undefined}
            >
              <span>{t.icon}</span>{t.label}{hidden ? ' ·' : ''}
            </button>
          )
        })}
      </div>

      {/* ── スクロールエリア */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>

        {activeTab === 'basic' && (<>
        {/* 表示する項目 */}
        <SectionHead title="表示する項目" icon="👁" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SLIDE_SECTIONS.map((sec) => {
            const on = isSectionOn(sec.key)
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => toggleSection(sec.key)}
                title={on ? 'クリックで非表示' : 'クリックで表示'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 999,
                  border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                  background: on ? 'var(--primary-soft)' : 'var(--bg)',
                  color: on ? 'var(--primary)' : 'var(--text-faint)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  textDecoration: on ? 'none' : 'line-through',
                }}
              >
                <span style={{ fontSize: 13 }}>{sec.icon}</span>{sec.label}
              </button>
            )
          })}
        </div>

        {/* 基本情報 */}
        <SectionHead title="基本情報" icon="🏷" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="ソフトウェア名">
              <input
                ref={(el) => { fieldRefs.current['software'] = el }}
                list="asd-software-list"
                style={css.input} value={draft.software}
                onChange={(e) => set('software', e.target.value)}
                onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
              />
              <datalist id="asd-software-list">
                {softwareNames.map(n => <option key={n} value={n} />)}
              </datalist>
            </FormField>
            <FormField label="種別">
              <div style={{ position: 'relative' }}>
                <select
                  ref={(el) => { fieldRefs.current['badge'] = el }}
                  style={css.select} value={draft.badge}
                  onChange={(e) => handleBadgeChange(e.target.value as Slide['badge'])}
                  onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
                >
                  {BADGES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="カテゴリ">
              <div style={{ position: 'relative' }}>
                <select
                  ref={(el) => { fieldRefs.current['category'] = el }}
                  style={css.select} value={draft.category}
                  onChange={(e) => set('category', e.target.value as Slide['category'])}
                  onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
                >
                  {(['CAD/3D', 'AI', 'クリエイティブ', 'その他'] as Slide['category'][]).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </FormField>
            <FormField label="ベンダー">
              <input
                ref={(el) => { fieldRefs.current['vendor'] = el }}
                list="asd-vendor-list"
                style={css.input} value={draft.vendor}
                onChange={(e) => set('vendor', e.target.value)}
                onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
              />
              <datalist id="asd-vendor-list">
                {vendorSuggestions.map(v => <option key={v} value={v} />)}
              </datalist>
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="購入窓口">
              <input
                ref={(el) => { fieldRefs.current['purchaseVia'] = el }}
                list="asd-purchase-list"
                style={css.input} value={draft.purchaseVia}
                onChange={(e) => set('purchaseVia', e.target.value)}
                onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
              />
              <datalist id="asd-purchase-list">
                {purchaseSuggestions.map(v => <option key={v} value={v} />)}
              </datalist>
            </FormField>
          </div>
        </div>

        </>)}

        {activeTab === 'seats' && (<>
        {/* 本数・時期 */}
        <SectionHead title="本数・時期" icon="📅" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="現在の利用者数">
              <div style={{ position: 'relative' }}>
                <input
                  ref={(el) => { fieldRefs.current['currentUsersOverride'] = el }}
                  type="number" min={0} style={{ ...css.input, paddingRight: 30 }}
                  value={draft.currentUsersOverride ?? ''}
                  placeholder="自動計算"
                  onChange={(e) => set('currentUsersOverride', e.target.value === '' ? undefined : Number(e.target.value))}
                  onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-faint)', pointerEvents: 'none' }}>名</span>
              </div>
            </FormField>
            <FormField label="現在の契約本数">
              <div style={{ position: 'relative' }}>
                <input
                  ref={(el) => { fieldRefs.current['currentSeats'] = el }}
                  type="number" min={0} style={{ ...css.input, paddingRight: 30 }}
                  value={draft.currentSeats}
                  onChange={(e) => setCurrentSeats(Number(e.target.value))}
                  onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-faint)', pointerEvents: 'none' }}>本</span>
              </div>
            </FormField>
            <FormField label={opt.items.length > 0 ? '増減申請本数（内訳から自動）' : '増減申請本数'}>
              <div style={{ position: 'relative' }}>
                <input
                  ref={(el) => { fieldRefs.current['requestSeats'] = el }}
                  type="number" step={1} placeholder="増は＋ / 減は−"
                  readOnly={opt.items.length > 0}
                  style={{ ...css.input, paddingRight: 30, background: opt.items.length > 0 ? 'var(--surface-2)' : 'var(--bg)', color: opt.items.length > 0 ? 'var(--text-muted)' : 'var(--text)' }}
                  value={draft.requestSeats}
                  onChange={(e) => set('requestSeats', e.target.value === '' || e.target.value === '-' ? 0 : Number(e.target.value))}
                  onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-faint)', pointerEvents: 'none' }}>本</span>
              </div>
            </FormField>
          </div>
          {opt.items.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: -4 }}>
              ※ 増減・申請後の本数は「内訳」タブの式から自動計算されます（増減 {optDeltaVal > 0 ? '＋' : ''}{optDeltaVal}本／申請後 {optAfter}本）
            </div>
          )}
          <FormField label="申請・実施月">
            <input
              ref={(el) => { fieldRefs.current['requestDate'] = el }}
              style={css.input} value={draft.requestDate}
              onChange={(e) => set('requestDate', e.target.value)}
              onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
            />
          </FormField>
          <FormField label="目標更新月">
            <input
              ref={(el) => { fieldRefs.current['targetRenewalDate'] = el }}
              style={css.input} value={draft.targetRenewalDate}
              onChange={(e) => set('targetRenewalDate', e.target.value)}
              onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
            />
          </FormField>
          <FormField label="人数の増減（利用人数分析）">
            <div style={{ position: 'relative' }}>
              <input
                ref={(el) => { fieldRefs.current['userDelta'] = el }}
                type="number"
                style={{ ...css.input, paddingRight: 30, color: (draft.userDelta ?? 0) > 0 ? '#16a34a' : (draft.userDelta ?? 0) < 0 ? '#e11d48' : 'var(--text)' }}
                value={draft.userDelta ?? 0}
                onChange={(e) => set('userDelta', Number(e.target.value))}
                onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-faint)', pointerEvents: 'none' }}>名</span>
            </div>
          </FormField>
        </div>

        </>)}

        {activeTab === 'opt' && (<>
        {/* 最適化内訳 */}
        <SectionHead title="最適化内訳（利用実態より）" icon="💡" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 再取込＋表示状態 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: isSectionOn('optBreakdown') ? '#0f6e56' : 'var(--text-faint)' }}>
              {isSectionOn('optBreakdown') ? '● 申請書に表示中' : '○ 非表示（上の「表示する項目」で切替）'}
            </span>
            {computedBreakdown && (
              <button
                type="button"
                onClick={reloadOpt}
                title="利用実態データから区分・人数を再計算して取り込みます"
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-soft)', border: '1px solid var(--primary)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}
              >↺ 利用実態から取込</button>
            )}
          </div>

          {/* 区分アイテム */}
          {opt.items.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '8px 0' }}>区分がありません。下のボタンで追加してください。</div>
              )}
              {opt.items.map((it, idx) => {
                const meta = optKindMeta(it.kind)
                const seats = optItemSeats(it)
                return (
                  <div key={it.id} style={{ border: '1.5px solid var(--border)', borderRadius: 10, padding: 10, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: meta.color, flexShrink: 0 }} />
                      <input
                        style={{ ...css.input, padding: '6px 10px', fontSize: 13, fontWeight: 600 }}
                        value={it.label}
                        onChange={(e) => setOptItem(it.id, { label: e.target.value })}
                        onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => moveOptItem(it.id, -1)}
                          disabled={idx === 0}
                          title="上へ移動"
                          style={{ width: 22, height: 14, borderRadius: '5px 5px 0 0', border: '1px solid var(--border)', borderBottom: 'none', background: 'var(--bg)', color: idx === 0 ? 'var(--border)' : 'var(--text-muted)', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 9, lineHeight: 1, padding: 0 }}
                        >▲</button>
                        <button
                          type="button"
                          onClick={() => moveOptItem(it.id, 1)}
                          disabled={idx === opt.items.length - 1}
                          title="下へ移動"
                          style={{ width: 22, height: 14, borderRadius: '0 0 5px 5px', border: '1px solid var(--border)', background: 'var(--bg)', color: idx === opt.items.length - 1 ? 'var(--border)' : 'var(--text-muted)', cursor: idx === opt.items.length - 1 ? 'default' : 'pointer', fontSize: 9, lineHeight: 1, padding: 0 }}
                        >▼</button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOptItem(it.id)}
                        title="この区分を削除"
                        style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 13 }}
                      >✕</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 120px' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>種別</span>
                        <select
                          style={{ ...css.select, padding: '6px 10px', paddingRight: 28, fontSize: 12.5 }}
                          value={it.kind}
                          onChange={(e) => setOptItem(it.id, { kind: e.target.value as OptItemKind })}
                          onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
                        >
                          {(Object.keys(OPT_KIND_META) as OptItemKind[]).map((k) => (
                            <option key={k} value={k}>{OPT_KIND_META[k].label}</option>
                          ))}
                        </select>
                      </div>
                      {it.kind === 'reserve' ? (
                        <div style={{ flex: '1 1 90px' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>本数</span>
                          <OptNum inputRef={(el) => { fieldRefs.current[`opt.item.${it.id}`] = el }} value={it.fixedSeats ?? 0} onChange={(v) => setOptItem(it.id, { fixedSeats: v })} unit="本" />
                        </div>
                      ) : (
                        <div style={{ flex: '1 1 90px' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>人数</span>
                          <OptNum inputRef={(el) => { fieldRefs.current[`opt.item.${it.id}`] = el }} value={it.people} onChange={(v) => setOptItem(it.id, { people: v })} unit="名" />
                        </div>
                      )}
                      {it.kind === 'shared' && (
                        <div style={{ flex: '1 1 110px' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>共有比率</span>
                          <select
                            style={{ ...css.select, padding: '6px 10px', paddingRight: 28, fontSize: 12.5 }}
                            value={it.ratio ?? 2}
                            onChange={(e) => setOptItem(it.id, { ratio: Number(e.target.value) })}
                            onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
                          >
                            {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}人で1本</option>)}
                          </select>
                        </div>
                      )}
                      <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: meta.color, paddingBottom: 8 }}>→ {seats}本</div>
                    </div>
                    <input
                      style={{ ...css.input, padding: '5px 10px', fontSize: 11.5, color: 'var(--text-muted)' }}
                      placeholder="補足（例：毎日5・週数回38）"
                      value={it.note ?? ''}
                      onChange={(e) => setOptItem(it.id, { note: e.target.value || undefined })}
                      onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
                    />
                  </div>
                )
              })}

              {/* 追加ボタン */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.keys(OPT_KIND_META) as OptItemKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => addOptItem(k)}
                    style={{ fontSize: 11, fontWeight: 600, color: OPT_KIND_META[k].color, background: 'var(--bg)', border: `1px solid ${OPT_KIND_META[k].color}55`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}
                  >＋ {OPT_KIND_META[k].label}</button>
                ))}
              </div>

              {/* 式プレビュー */}
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12.5, lineHeight: 1.9 }}>
                <div>
                  <span style={{ color: 'var(--text-faint)', fontWeight: 700, fontSize: 10.5 }}>削減申請本数</span>{' '}
                  <span style={{ fontWeight: 700, color: '#e11d48' }}>{optReduce}本 削減</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-faint)', fontWeight: 700, fontSize: 10.5 }}>増加申請本数</span>{' '}
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>{optAdd}本 増加</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-faint)', fontWeight: 700, fontSize: 10.5 }}>申請後の本数</span>{' '}
                  <span style={{ fontWeight: 800, color: '#0f6e56' }}>{optAfter}本</span>
                  <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>（増減 {optDeltaVal > 0 ? '＋' : ''}{optDeltaVal}本）</span>
                </div>
              </div>
        </div>

        </>)}

        {activeTab === 'cost' && (<>
        {/* 費用概算 */}
        <SectionHead title="費用概算" icon="💴" />
        <textarea
          ref={(el) => { fieldRefs.current['costNote'] = el }}
          style={{ ...css.textarea, minHeight: 64 }}
          value={draft.costNote}
          onChange={(e) => set('costNote', e.target.value)}
          onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
        />

        </>)}

        {activeTab === 'reason' && (<>
        {/* 申請理由 */}
        <SectionHead title="申請理由" icon="📝" />
        <textarea
          ref={(el) => { fieldRefs.current['reason'] = el }}
          style={{ ...css.textarea, minHeight: 100 }}
          value={draft.reason}
          onChange={(e) => set('reason', e.target.value)}
          onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
        />

        </>)}

        {activeTab === 'schedule' && (<>
        {/* 実施スケジュール */}
        <SectionHead title="実施スケジュール" icon="🗓" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {draft.actions.map((a, i) => (
            <div
              key={i}
              style={{
                border: '1.5px solid var(--border)', borderRadius: 10,
                overflow: 'hidden', background: 'var(--surface)',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '8px 12px', background: 'var(--bg)',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: color + '18', border: `1.5px solid ${color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color, marginRight: 8, flexShrink: 0,
                }}>{i + 1}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', flex: 1 }}>STEP {i + 1}</span>
                <button
                  onClick={() => removeAction(i)}
                  style={{
                    width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-faint)', fontSize: 13, borderRadius: 5,
                  }}
                >✕</button>
              </div>
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <FormField label="時期">
                  <input
                    ref={(el) => { fieldRefs.current[`action-${i}`] = el }}
                    style={css.input} value={a.label} placeholder="例：2026年9月"
                    onChange={(e) => setAction(i, 'label', e.target.value)}
                    onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
                  />
                </FormField>
                <FormField label="内容">
                  <textarea
                    style={{ ...css.textarea, minHeight: 52 }} value={a.detail}
                    placeholder="このステップで実施する内容"
                    onChange={(e) => setAction(i, 'detail', e.target.value)}
                    onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
                  />
                </FormField>
              </div>
            </div>
          ))}
          <button
            onClick={addAction}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 0', fontSize: 12.5, fontWeight: 600,
              color: 'var(--primary)', background: 'var(--primary-soft)',
              border: '1.5px dashed var(--primary)', borderRadius: 9, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#dde3ff')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'var(--primary-soft)')}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> ステップを追加
          </button>
        </div>

        {/* 注意事項 */}
        <SectionHead title="注意事項（任意）" icon="⚠️" />
        <textarea
          ref={(el) => { fieldRefs.current['alert'] = el }}
          style={{ ...css.textarea, minHeight: 64 }}
          placeholder="例：⚠️ 期限切れ中のため至急対応が必要..."
          value={draft.alert ?? ''}
          onChange={(e) => set('alert', e.target.value || undefined)}
          onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
        />
        </>)}

        {/* 保存ボタン */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: '11px 0', fontSize: 13.5, fontWeight: 700,
              background: saving ? 'var(--text-faint)' : 'var(--primary)', color: '#fff',
              border: 'none', borderRadius: 9, cursor: saving ? 'default' : 'pointer',
              letterSpacing: '0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.2s',
            }}
          >
            {saving
              ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />保存中…</>
              : '✓ 変更を保存'
            }
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '11px 16px', fontSize: 13, fontWeight: 600,
              background: 'none', color: 'var(--text-muted)',
              border: '1.5px solid var(--border)', borderRadius: 9, cursor: 'pointer',
            }}
          >キャンセル</button>
        </div>
      </div>

      {/* ── 保存完了トースト ── */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: `translateX(-50%) translateY(${saved ? 0 : 12}px)`,
        background: '#16a34a', color: '#fff',
        padding: '10px 20px', borderRadius: 10,
        fontSize: 13, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        opacity: saved ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 0.25s, transform 0.25s',
        whiteSpace: 'nowrap',
        zIndex: 100,
      }}>
        <span style={{ fontSize: 16 }}>✓</span> 保存しました
      </div>
    </div>
  )
}

function SectionHead({ title, icon }: { title: string; icon: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      marginTop: 22, marginBottom: 10,
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }} />
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>{label}</span>
      {children}
    </div>
  )
}

function OptNum({ value, onChange, unit, inputRef }: { value: number; onChange: (v: number) => void; unit: string; inputRef?: (el: HTMLInputElement | null) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="number" min={0}
        style={{ ...css.input, paddingRight: 30 }}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
        onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)}
      />
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-faint)', pointerEvents: 'none' }}>{unit}</span>
    </div>
  )
}
