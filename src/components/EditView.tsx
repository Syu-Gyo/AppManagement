import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import SheetEditor, { type SheetConfig, type SheetFilter, type SheetGroup, type SheetOption, type SheetSorter } from './SheetEditor'
import { CATEGORY_COLORS, metaOf } from '../data/software'
import type { Member } from '../data/types'
import { CONTRACT_VENDORS, type Contract } from '../data/contracts'
import { API_ENVS, type ApiKey } from '../data/apikeys'
import { parseMemberDirectoryFile } from '../memberDirectoryImport'

export const EDITABLE_VIEWS = ['software', 'members', 'contracts', 'api'] as const

const DCC_VENDORS = new Set(['Trimble', 'Dassault', 'Epic Games', 'Chaos'])

const COLUMN_CATEGORIES: { label: string; match: (sw: string) => boolean }[] = [
  { label: 'Adobe',    match: (sw) => metaOf(sw).vendor === 'Adobe' },
  { label: 'Autodesk', match: (sw) => metaOf(sw).vendor === 'Autodesk' && !metaOf(sw).dcc },
  { label: 'DCCツール', match: (sw) => { const m = metaOf(sw); return !!m.dcc || DCC_VENDORS.has(m.vendor) } },
  { label: 'AIツール',  match: (sw) => metaOf(sw).category === 'AI' },
]
export type EditableView = (typeof EDITABLE_VIEWS)[number]

export function isEditable(view: string): view is EditableView {
  return (EDITABLE_VIEWS as readonly string[]).includes(view)
}

function options(values: readonly string[]): SheetOption[] {
  return [...new Set(values.map((v) => v || '未分類'))]
    .sort((a, b) => a.localeCompare(b, 'ja'))
    .map((value) => ({ value, label: value }))
}

function memberFilters(members: Member[], software: string[]): SheetFilter<Member>[] {
  const departments = options(members.map((m) => m.department || '未所属'))
  const tools = software.map((sw) => ({ value: sw, label: sw }))
  const categories = options(software.map((sw) => metaOf(sw).category))
  return [
    {
      key: 'department',
      label: '部署',
      allLabel: 'すべての部署',
      options: departments,
      predicate: (m, value) => (m.department || '未所属') === value,
    },

    {
      key: 'category',
      label: 'カテゴリ',
      allLabel: 'すべてのカテゴリ',
      options: categories,
      predicate: (m, value) => m.licenses.some((sw) => metaOf(sw).category === value),
    },
  ]
}

const memberSorters: SheetSorter<Member>[] = [
  { key: 'sheet', label: '名簿順', compare: () => 0 },
  { key: 'name', label: '氏名順', compare: (a, b) => a.name.localeCompare(b.name, 'ja') },
  { key: 'department', label: '部署順', compare: (a, b) => `${a.department} ${a.name}`.localeCompare(`${b.department} ${b.name}`, 'ja') },
  { key: 'licenses', label: 'ツール数が多い順', compare: (a, b) => b.licenses.length - a.licenses.length || a.name.localeCompare(b.name, 'ja') },
]

const memberGroups: SheetGroup<Member>[] = [
  { key: 'department', label: '部署ごと', getValues: (m) => m.department || '未所属' },
  { key: 'tool', label: 'ツールごと', getValues: (m) => (m.licenses.length ? m.licenses : ['未割当']) },
]

function memberLicenseColumns(software: string[], visibleTools: readonly string[] = [], archiveSoftware?: (sw: string) => void) {
  return software.map((sw) => {
    const meta = metaOf(sw)
    const catColor = CATEGORY_COLORS[meta.category]
    return {
      key: `lic:${sw}`,
      label: sw,
      type: 'check' as const,
      width: 80,
      align: 'center' as const,
      color: () => catColor,
      visible: visibleTools.length === 0 || visibleTools.includes(sw),
      headerIcon: meta.icon,
      headerBg: catColor,
      headerBadge: sw === 'chatGPT Business' ? 'Biz' : sw === 'chatGPT Pro' ? 'Pro' : sw === 'AutocadLT' ? 'LT' : undefined,
      headerBadgeBg: sw === 'chatGPT Business' ? '#16a34a' : sw === 'chatGPT Pro' ? '#9333ea' : sw === 'AutocadLT' ? '#1a6bbf' : undefined,
      onArchive: archiveSoftware
        ? () => { if (confirm(`「${sw}」をアーカイブしますか？\n閲覧画面から非表示になります。アーカイブ管理パネルからいつでも復活できます。`)) archiveSoftware(sw) }
        : undefined,
      get: (m: Member) => m.licenses.includes(sw),
      set: (v: string | number | boolean, m: Member) => ({
        licenses: v
          ? [...new Set([...m.licenses, sw])]
          : m.licenses.filter((s) => s !== sw),
      }),
    }
  })
}

function ToolColumnPicker({ tools, selected, onChange }: { tools: readonly string[]; selected: readonly string[]; onChange: (tools: string[]) => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selectedSet = new Set(selected)
  const label = selected.length === 0 ? 'すべてのツール' : `${selected.length}件を表示`

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const toggle = (tool: string) => {
    const next = new Set(selectedSet)
    if (next.has(tool)) next.delete(tool)
    else next.add(tool)
    onChange(tools.filter((t) => next.has(t)))
  }

  return (
    <div ref={rootRef} className="sheet-control sheet-multi-control">
      <span>ツール</span>
      <details className="sheet-multi" open={open}>
        <summary onClick={(e) => { e.preventDefault(); setOpen((v) => !v) }}>{label}</summary>
        <div className="sheet-multi-menu">
          <button type="button" className="sheet-multi-clear" onClick={() => onChange([])}>
            すべて表示
          </button>
          {tools.map((tool) => (
            <label key={tool} className="sheet-multi-option">
              <input type="checkbox" checked={selectedSet.has(tool)} onChange={() => toggle(tool)} />
              <span>{tool}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}
function MemberDirectoryUpload({ onImport }: { onImport: ReturnType<typeof useStore>['importMembersFromSheet'] }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setMessage('')
    try {
      const rows = await parseMemberDirectoryFile(file)
      onImport(rows)
      setMessage(`${rows.length}名を反映しました`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '取り込みに失敗しました')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="sheet-import">
      <button className="btn" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? '取り込み中...' : '名簿アップロード'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {message && <span className="sheet-import-msg">{message}</span>}
    </div>
  )
}
function SoftwareArchivePanel({
  software,
  archived,
  onArchive,
  onUnarchive,
}: {
  software: string[]
  archived: string[]
  onArchive: (sw: string) => void
  onUnarchive: (sw: string) => void
}) {
  const [open, setOpen] = useState(false)
  const archivedSet = new Set(archived)

  return (
    <div style={{ marginBottom: 12, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', background: 'var(--surface-2, #f8fafc)',
          border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
        </svg>
        ツールのアーカイブ管理
        {archived.length > 0 && (
          <span style={{ marginLeft: 4, padding: '1px 7px', borderRadius: 10, background: '#f1f5f9', fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
            {archived.length}件アーカイブ中
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {software.map((sw) => {
            const isArchived = archivedSet.has(sw)
            return (
              <div
                key={sw}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 8, fontSize: 12.5,
                  border: `1px solid ${isArchived ? '#e2e8f0' : 'var(--border)'}`,
                  background: isArchived ? '#f8fafc' : 'var(--surface)',
                  color: isArchived ? 'var(--text-muted)' : 'var(--text)',
                  opacity: isArchived ? 0.7 : 1,
                }}
              >
                <span>{sw}</span>
                {isArchived ? (
                  <button
                    type="button"
                    title="アーカイブを解除して表示に戻す"
                    onClick={() => onUnarchive(sw)}
                    style={{
                      border: 'none', background: '#e0f2fe', color: '#0369a1',
                      borderRadius: 5, padding: '2px 7px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    復活
                  </button>
                ) : (
                  <button
                    type="button"
                    title="アーカイブして閲覧画面から非表示にする"
                    onClick={() => onArchive(sw)}
                    style={{
                      border: 'none', background: '#fef3c7', color: '#92400e',
                      borderRadius: 5, padding: '2px 7px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    アーカイブ
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AddToolModal({ onAdd, onClose }: {
  onAdd: (key: string, meta: { vendor: string; category: 'CAD/3D' | 'AI' | 'クリエイティブ' | 'その他'; monthlyCost: number; icon?: string; dcc?: boolean }) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [vendor, setVendor] = useState('')
  const [category, setCategory] = useState<'CAD/3D' | 'AI' | 'クリエイティブ' | 'その他'>('その他')
  const [dcc, setDcc] = useState(false)
  const [cost, setCost] = useState(0)
  const [iconPreview, setIconPreview] = useState<string | undefined>()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleIcon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setIconPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const submit = () => {
    const key = name.trim()
    if (!key) return
    onAdd(key, { vendor: vendor.trim() || '—', category, monthlyCost: cost, icon: iconPreview, dcc: dcc || undefined })
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 400, maxWidth: '92vw', padding: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🛠</span>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>ツールを追加</div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: 4 }} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* アイコン + ツール名 */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 56, height: 56, borderRadius: 12, border: '2px dashed var(--border)',
                background: 'var(--surface-2)', cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}
              title="アイコンをアップロード"
            >
              {iconPreview
                ? <img src={iconPreview} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                : <span style={{ fontSize: 22, opacity: 0.4 }}>🖼</span>
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleIcon} />
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>ツール名 *</label>
              <input
                className="sheet-input"
                style={{ width: '100%', fontSize: 14 }}
                placeholder="例: Figma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          {/* ベンダー */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>ベンダー</label>
            <input
              className="sheet-input"
              style={{ width: '100%', fontSize: 13 }}
              placeholder="例: Adobe"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
          </div>
          {/* カテゴリ + DCCフラグ */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>カテゴリ</label>
              <select
                className="filter"
                style={{ width: '100%' }}
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
              >
                <option value="CAD/3D">CAD/3D</option>
                <option value="AI">AI</option>
                <option value="クリエイティブ">クリエイティブ</option>
                <option value="その他">その他</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>DCCツール</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={dcc} onChange={(e) => setDcc(e.target.checked)} />
                DCCタブに表示
              </label>
            </div>
          </div>
          {/* 月額 */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>1本あたり月額（円）</label>
            <input
              className="sheet-input"
              type="number"
              style={{ width: '100%', fontSize: 13, textAlign: 'right' }}
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="btn" onClick={onClose}>キャンセル</button>
            <button className="btn primary" onClick={submit} disabled={!name.trim()}>追加する</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EditView({ view }: { view: EditableView }) {
  const store = useStore()
  const memberFilterDefs = useMemo(() => memberFilters(store.members, store.software), [store.members, store.software])
  const departmentOptions = useMemo(
    () => ['', ...new Set(store.members.map((m) => m.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')),
    [store.members],
  )
  const sectionOptions = useMemo(
    () => ['', ...new Set(store.members.map((m) => m.section).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')),
    [store.members],
  )
  const [visibleTools, setVisibleTools] = useState<string[]>([])
  const [colCategory, setColCategory] = useState('')
  const [showAddTool, setShowAddTool] = useState(false)

  if (view === 'software') {
    const activeSoftware = store.software.filter((sw) => !store.archivedSoftware.includes(sw))
    const catFilteredTools = colCategory
      ? activeSoftware.filter(COLUMN_CATEGORIES.find(c => c.label === colCategory)!.match)
      : []
    const effectiveVisible = colCategory ? catFilteredTools : visibleTools
    const cfg: SheetConfig<Member> = {
      getId: (m) => m.id,
      rowLabel: (m) => m.name || '(無名)',
      searchText: (m) => `${m.name} ${m.department} ${m.section} ${m.licenses.join(' ')}`,
      freeze: 3,
      blank: () => ({ name: '', department: '', section: '', email: '', licenses: [] }),
      filters: memberFilterDefs,
      rowPredicate: effectiveVisible.length > 0 ? (m) => m.licenses.some((sw) => effectiveVisible.includes(sw)) : undefined,
      sorters: memberSorters,
      groups: memberGroups,
      defaultSort: 'sheet',
      filterControls: (
        <>
          <label className="sheet-control">
            <span>カテゴリ</span>
            <select
              className="filter"
              value={colCategory}
              onChange={(e) => { setColCategory(e.target.value); setVisibleTools([]) }}
            >
              <option value="">すべて</option>
              {COLUMN_CATEGORIES.map((c) => (
                <option key={c.label} value={c.label}>{c.label}</option>
              ))}
            </select>
          </label>
          <ToolColumnPicker
            tools={colCategory ? catFilteredTools : activeSoftware}
            selected={visibleTools}
            onChange={(t) => { setVisibleTools(t); setColCategory('') }}
          />
        </>
      ),
      toolbarActions: (
        <>
          <button className="btn" onClick={() => setShowAddTool(true)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            ツールを追加
          </button>
          <MemberDirectoryUpload onImport={store.importMembersFromSheet} />
        </>
      ),
      columns: [
        { key: 'name', label: '氏名', type: 'text', width: 160, get: (m) => m.name, set: (v) => ({ name: String(v) }) },
        { key: 'department', label: '部署', type: 'select', width: 150, options: departmentOptions, get: (m) => m.department, set: (v) => ({ department: String(v) }) },
        { key: 'section', label: '課', type: 'select', width: 130, options: sectionOptions, get: (m) => m.section, set: (v) => ({ section: String(v) }) },
        ...memberLicenseColumns(activeSoftware, effectiveVisible, store.archiveSoftware),
      ],
    }
    return (
      <div>
        {showAddTool && (
          <AddToolModal
            onAdd={store.addSoftwareTool}
            onClose={() => setShowAddTool(false)}
          />
        )}
        <SoftwareArchivePanel
          software={store.software}
          archived={store.archivedSoftware}
          onArchive={store.archiveSoftware}
          onUnarchive={store.unarchiveSoftware}
        />
        <SheetEditor rows={store.members} config={cfg} onUpdate={store.updateMember} onAdd={store.addMember} onRemove={store.removeMember} />
      </div>
    )
  }

  if (view === 'members') {
    const cfg: SheetConfig<Member> = {
      getId: (m) => m.id,
      rowLabel: (m) => m.name || '(無名)',
      searchText: (m) => `${m.name} ${m.department} ${m.section} ${m.email} ${m.licenses.join(' ')}`,
      freeze: 2,
      blank: () => ({ name: '', department: '', section: '', email: '', licenses: [] }),
      filters: memberFilterDefs,
      rowPredicate: visibleTools.length > 0 ? (m) => m.licenses.some((sw) => visibleTools.includes(sw)) : undefined,
      sorters: memberSorters,
      groups: memberGroups,
      defaultSort: 'sheet',
      filterControls: <ToolColumnPicker tools={store.software} selected={visibleTools} onChange={setVisibleTools} />,
      toolbarActions: <MemberDirectoryUpload onImport={store.importMembersFromSheet} />,
      columns: [
        { key: 'name', label: '氏名', type: 'text', width: 160, get: (m) => m.name, set: (v) => ({ name: String(v) }) },
        { key: 'department', label: '部署', type: 'select', width: 150, options: departmentOptions, get: (m) => m.department, set: (v) => ({ department: String(v) }) },
        { key: 'section', label: '課', type: 'select', width: 130, options: sectionOptions, get: (m) => m.section, set: (v) => ({ section: String(v) }) },
        { key: 'email', label: 'メール', type: 'text', width: 220, get: (m) => m.email, set: (v) => ({ email: String(v) }) },
        ...memberLicenseColumns(store.software, visibleTools),
      ],
    }
    return <SheetEditor rows={store.members} config={cfg} onUpdate={store.updateMember} onAdd={store.addMember} onRemove={store.removeMember} />
  }

  if (view === 'contracts') {
    const cfg: SheetConfig<Contract> = {
      getId: (c) => c.id,
      rowLabel: (c) => c.software || '(未入力)',
      searchText: (c) => `${c.software} ${c.edition} ${c.vendor} ${c.licenseKey ?? ''}`,
      freeze: 1,
      blank: () => ({
        software: '', edition: '', vendor: 'Autodesk', licenseKey: null,
        seats: 1, unitAnnualCost: 0, startDate: '', endDate: '', autoRenew: false, note: '',
      }),
      filters: [
        { key: 'vendor', label: 'ベンダー', allLabel: 'すべてのベンダー', options: options(CONTRACT_VENDORS), predicate: (c, value) => c.vendor === value },
        { key: 'tool', label: 'ツール', allLabel: 'すべてのツール', options: store.software.map((sw) => ({ value: sw, label: sw })), predicate: (c, value) => c.licenseKey === value || c.software === value },
      ],
      sorters: [
        { key: 'software', label: 'ソフト名順', compare: (a, b) => a.software.localeCompare(b.software, 'ja') },
        { key: 'endDate', label: '終了日が近い順', compare: (a, b) => a.endDate.localeCompare(b.endDate) },
        { key: 'seats', label: '本数が多い順', compare: (a, b) => b.seats - a.seats },
        { key: 'cost', label: '年額が高い順', compare: (a, b) => b.unitAnnualCost * b.seats - a.unitAnnualCost * a.seats },
      ],
      groups: [
        { key: 'vendor', label: 'ベンダーごと', getValues: (c) => c.vendor || '未分類' },
        { key: 'tool', label: '連携ツールごと', getValues: (c) => c.licenseKey || c.software || '未分類' },
      ],
      columns: [
        { key: 'software', label: 'ソフト名', type: 'text', width: 170, get: (c) => c.software, set: (v) => ({ software: String(v) }) },
        { key: 'edition', label: 'エディション', type: 'text', width: 150, get: (c) => c.edition, set: (v) => ({ edition: String(v) }) },
        { key: 'vendor', label: 'ベンダー', type: 'select', width: 160, options: CONTRACT_VENDORS, get: (c) => c.vendor, set: (v) => ({ vendor: String(v) }) },
        { key: 'seats', label: '本数', type: 'number', width: 80, align: 'right', get: (c) => c.seats, set: (v) => ({ seats: Number(v) }) },
        { key: 'unitAnnualCost', label: '年額単価', type: 'number', width: 120, align: 'right', get: (c) => c.unitAnnualCost, set: (v) => ({ unitAnnualCost: Number(v) }) },
        { key: 'startDate', label: '開始日', type: 'date', width: 150, get: (c) => c.startDate, set: (v) => ({ startDate: String(v) }) },
        { key: 'endDate', label: '終了日', type: 'date', width: 150, get: (c) => c.endDate, set: (v) => ({ endDate: String(v) }) },
        { key: 'autoRenew', label: '自動更新', type: 'check', width: 80, align: 'center', get: (c) => c.autoRenew, set: (v) => ({ autoRenew: Boolean(v) }) },
        { key: 'licenseKey', label: '連携キー', type: 'select', width: 140, options: ['', ...store.software], get: (c) => c.licenseKey ?? '', set: (v) => ({ licenseKey: v ? String(v) : null }) },
        { key: 'note', label: '備考', type: 'text', width: 220, get: (c) => c.note, set: (v) => ({ note: String(v) }) },
      ],
    }
    return <SheetEditor rows={store.contracts} config={cfg} onUpdate={store.updateContract} onAdd={store.addContract} onRemove={store.removeContract} />
  }

  const services = options(store.apiKeys.map((k) => k.service))
  const cfg: SheetConfig<ApiKey> = {
    getId: (k) => k.id,
    rowLabel: (k) => `${k.service} / ${k.label}`,
    searchText: (k) => `${k.service} ${k.label} ${k.owner} ${k.env} ${k.status}`,
    freeze: 1,
    blank: () => ({
      service: '', label: '', keyMasked: '', owner: '', env: API_ENVS[0],
      status: '有効', monthlyUsage: 0, monthlyBudget: 0, lastUsed: '', consoleUrl: '',
    }),
    filters: [
      { key: 'service', label: 'サービス', allLabel: 'すべてのサービス', options: services, predicate: (k, value) => k.service === value },
      { key: 'env', label: '環境', allLabel: 'すべての環境', options: options(API_ENVS), predicate: (k, value) => k.env === value },
      { key: 'status', label: '状態', allLabel: 'すべての状態', options: options(['有効', '無効']), predicate: (k, value) => k.status === value },
    ],
    sorters: [
      { key: 'service', label: 'サービス順', compare: (a, b) => `${a.service} ${a.label}`.localeCompare(`${b.service} ${b.label}`, 'ja') },
      { key: 'usage', label: '利用額が高い順', compare: (a, b) => b.monthlyUsage - a.monthlyUsage },
      { key: 'lastUsed', label: '最終利用が新しい順', compare: (a, b) => b.lastUsed.localeCompare(a.lastUsed) },
    ],
    groups: [
      { key: 'service', label: 'サービスごと', getValues: (k) => k.service || '未分類' },
      { key: 'env', label: '環境ごと', getValues: (k) => k.env || '未分類' },
    ],
    columns: [
      { key: 'service', label: 'サービス', type: 'text', width: 170, get: (k) => k.service, set: (v) => ({ service: String(v) }) },
      { key: 'label', label: '用途', type: 'text', width: 180, get: (k) => k.label, set: (v) => ({ label: String(v) }) },
      { key: 'owner', label: '管理者', type: 'text', width: 210, get: (k) => k.owner, set: (v) => ({ owner: String(v) }) },
      { key: 'env', label: '環境', type: 'select', width: 90, options: API_ENVS, get: (k) => k.env, set: (v) => ({ env: v as ApiKey['env'] }) },
      { key: 'status', label: '状態', type: 'select', width: 90, options: ['有効', '無効'], get: (k) => k.status, set: (v) => ({ status: v as ApiKey['status'] }) },
      { key: 'monthlyUsage', label: '今月利用額', type: 'number', width: 130, align: 'right', get: (k) => k.monthlyUsage, set: (v) => ({ monthlyUsage: Number(v) }) },
      { key: 'monthlyBudget', label: '月予算', type: 'number', width: 120, align: 'right', get: (k) => k.monthlyBudget, set: (v) => ({ monthlyBudget: Number(v) }) },
      { key: 'lastUsed', label: '最終利用日', type: 'date', width: 150, get: (k) => k.lastUsed, set: (v) => ({ lastUsed: String(v) }) },
      { key: 'consoleUrl', label: '管理コンソールURL', type: 'text', width: 240, get: (k) => k.consoleUrl ?? '', set: (v) => ({ consoleUrl: String(v) }) },
    ],
  }
  return <SheetEditor rows={store.apiKeys} config={cfg} onUpdate={store.updateApiKey} onAdd={store.addApiKey} onRemove={store.removeApiKey} />
}