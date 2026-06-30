import { useState, useEffect, useMemo } from 'react'
import type { Slide, ApplicationGroup, OptBreakdown } from '../data/application'
import { SOFTWARE_CATALOG, optKindMeta, optItemSeats, optDelta, optDeltaTerms, optAfterSeats, optNeedTerms, sectionVisible } from '../data/application'
import { metaOf } from '../data/software'
import { exportAsPptx, exportAsPdf } from '../lib/exportSlide'
import { useStore } from '../store'
import type { Member } from '../data/types'
import type { Contract } from '../data/contracts'
import { computeOptimization, deriveBreakdown, type OptRow } from '../data/usage'

function formatYM(dateStr: string): string {
  const [y, m] = dateStr.split('-')
  return `${y}年${parseInt(m)}月`
}

interface Props {
  groups: ApplicationGroup[]
  setGroups: React.Dispatch<React.SetStateAction<ApplicationGroup[]>>
  onOpenSlide: (slide: Slide) => void
  onFocusField?: (field: string) => void
}

// ソフト名の曖昧マッチ（大文字小文字・部分一致）
function matchSoftware(licenseName: string, slideSoftware: string): boolean {
  const a = licenseName.toLowerCase().replace(/\s/g, '')
  const b = slideSoftware.toLowerCase().replace(/\s/g, '')
  return a === b || a.includes(b) || b.includes(a)
}

function countUsers(members: Member[], software: string): number {
  return members.filter(m => m.licenses.some(l => matchSoftware(l, software))).length
}

function blankSlide(software: string, contracts: Contract[], members: Member[]): Slide {
  const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, '')
  const meta = SOFTWARE_CATALOG.find((s) => s.name === software)
  const swMeta = metaOf(software)

  // 契約データから一致するものを探す
  const matched = contracts.filter(c =>
    norm(c.software) === norm(software) ||
    (c.licenseKey && norm(c.licenseKey) === norm(software))
  )
  const totalSeats = matched.reduce((sum, c) => sum + c.seats, 0)
  const latestContract = matched.sort((a, b) => b.endDate.localeCompare(a.endDate))[0]

  const requestDate = latestContract ? formatYM(latestContract.endDate) : ''
  const userCount = countUsers(members, software)

  return {
    id: `${software.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`,
    software,
    category: (meta?.category as Slide['category']) ?? 'その他',
    badge: '新規申請',
    badgeColor: '#7c3aed',
    vendor: swMeta.vendor !== '—' ? swMeta.vendor : (latestContract?.vendor ?? ''),
    purchaseVia: swMeta.purchaseVia ?? '',
    currentSeats: totalSeats,
    currentUsersOverride: userCount > 0 ? userCount : undefined,
    requestSeats: 0,
    requestDate,
    targetRenewalDate: latestContract ? formatYM(latestContract.endDate) : '',
    costNote: '',
    actions: [{ label: requestDate || '', detail: '' }],
    reason: '',
    createdAt: new Date().toISOString(),
  }
}

type SortMode = 'default' | 'date' | 'category'

export default function ApplicationForm({ groups, setGroups, onOpenSlide, onFocusField }: Props) {
  const { members, contracts, software, usage } = useStore()
  const optBySw = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, '')
    const { rows } = computeOptimization(members, software, contracts, usage)
    const m = new Map<string, OptRow>()
    for (const r of rows) m.set(norm(r.software), r)
    return m
  }, [members, software, contracts, usage])
  const optFor = (sw: string) => optBySw.get(sw.toLowerCase().replace(/[\s-]/g, ''))
  const breakdownFor = (slide: Slide): OptBreakdown | undefined => {
    if (slide.optBreakdown && Array.isArray(slide.optBreakdown.items)) return slide.optBreakdown
    const r = optFor(slide.software)
    return r && r.assigned > 0 ? deriveBreakdown(r) : undefined
  }
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    groups.length > 0 ? groups[0].id : null
  )
  const [printSlide, setPrintSlide] = useState<Slide | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set())
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [sortMode, setSortMode] = useState<SortMode>('default')
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'group'; groupId: string } | { kind: 'submission'; groupId: string; slideId: string } | null>(null)

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null
  const activeSlide = selectedGroup?.submissions[0] ?? null

  useEffect(() => {
    if (groups.length > 0) onOpenSlide(groups[0].submissions[0])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function selectGroup(g: ApplicationGroup) {
    setSelectedGroupId(g.id)
    onOpenSlide(g.submissions[0])
  }

  function addNewSubmission() {
    if (!selectedGroup || !activeSlide) return
    const newSlide: Slide = {
      ...activeSlide,
      id: `${activeSlide.software.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`,
      requestDate: '',
      createdAt: new Date().toISOString(),
    }
    setGroups((prev) =>
      prev.map((g) =>
        g.id === selectedGroup.id
          ? { ...g, submissions: [newSlide, ...g.submissions] }
          : g
      )
    )
    onOpenSlide(newSlide)
  }

  function toggleHistory(id: string) {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function removeGroup(groupId: string) {
    setDeleteTarget({ kind: 'group', groupId })
  }

  function removeSubmission(groupId: string, slideId: string) {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    if (group.submissions.length === 1) {
      removeGroup(groupId)
      return
    }
    setDeleteTarget({ kind: 'submission', groupId, slideId })
  }

  function confirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'group') {
      setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.groupId))
      if (selectedGroupId === deleteTarget.groupId) setSelectedGroupId(null)
    } else {
      const group = groups.find((g) => g.id === deleteTarget.groupId)
      setGroups((prev) =>
        prev.map((g) =>
          g.id === deleteTarget.groupId
            ? { ...g, submissions: g.submissions.filter((s) => s.id !== deleteTarget.slideId) }
            : g
        )
      )
      if (activeSlide?.id === deleteTarget.slideId && group) {
        const newActive = group.submissions.find((s) => s.id !== deleteTarget.slideId)
        if (newActive) onOpenSlide(newActive)
      }
    }
    setDeleteTarget(null)
  }

  // 固定カテゴリ分類
  const FILTER_CATEGORIES = ['all', 'Adobe', 'Autodesk', 'DCCツール', 'AIツール', 'API'] as const
  const FILTER_LABELS: Record<string, string> = {
    all: 'すべて', Adobe: 'Adobe', Autodesk: 'Autodesk',
    DCCツール: 'DCCツール', AIツール: 'AIツール', API: 'API',
  }

  function getFilterCategory(software: string): string {
    const n = software.toLowerCase().replace(/[\s-]/g, '')
    if (['creativecloud', 'photoshop', 'acrobat', 'adobeexpress'].includes(n)) return 'Adobe'
    if (['autocad', 'autocadlt', 'revit', '3dsmax'].includes(n)) return 'Autodesk'
    if (['sketchup', 'vray', 'twinmotion', 'solidworks', 'blender'].includes(n)) return 'DCCツール'
    if (['chatgpt', 'midjourney', 'kreaai', 'genspark', 'tripo', 'googleaistudio'].includes(n)) return 'AIツール'
    if (['api', 'apikey'].includes(n)) return 'API'
    return 'その他'
  }

  // フィルタ＆ソート
  const filteredGroups = groups
    .filter((g) => filterCategory === 'all' || getFilterCategory(g.submissions[0].software) === filterCategory)
    .slice()
    .sort((a, b) => {
      if (sortMode === 'date') {
        const da = a.submissions[0].requestDate ?? ''
        const db = b.submissions[0].requestDate ?? ''
        return da.localeCompare(db)
      }
      if (sortMode === 'category') {
        return getFilterCategory(a.submissions[0].software).localeCompare(getFilterCategory(b.submissions[0].software))
      }
      return 0
    })

  if (printSlide) {
    return <PrintSlide slide={printSlide} optRow={optFor(printSlide.software)} onClose={() => setPrintSlide(null)} />
  }

  const sortLabel: Record<SortMode, string> = { default: '登録順', date: '申請月順', category: 'カテゴリ順' }

  return (
    <div style={{ display: 'flex', gap: 20, width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* ── 左：グループ一覧 ── */}
      <div style={{
        width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
        background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        {/* ヘッダー */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
            申請一覧
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: 'var(--text-faint)' }}>
              {filterCategory !== 'all' ? `${filteredGroups.length}/` : ''}{groups.length}件
            </span>
          </span>
          <button
            onClick={() => setDialogOpen(true)}
            style={{
              width: 24, height: 24, borderRadius: '50%',
              border: '1.5px solid var(--primary)',
              background: 'var(--primary-soft)', color: 'var(--primary)',
              fontSize: 16, lineHeight: 1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
            }}
            title="申請ソフトを追加"
          >＋</button>
        </div>

        {/* フィルタ＆ソート */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* カテゴリフィルタ */}
          <div style={{ position: 'relative' }}>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                width: '100%', fontSize: 11.5, padding: '5px 24px 5px 8px',
                borderRadius: 7, border: '1px solid var(--border)',
                background: filterCategory !== 'all' ? 'var(--primary-soft)' : 'var(--surface-2)',
                color: filterCategory !== 'all' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: filterCategory !== 'all' ? 700 : 400,
                cursor: 'pointer', appearance: 'none', outline: 'none',
              }}
            >
              {FILTER_CATEGORIES.map((c) => (
                <option key={c} value={c}>{FILTER_LABELS[c]}</option>
              ))}
            </select>
            <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'var(--text-faint)', pointerEvents: 'none' }}>▼</span>
          </div>
          {/* ソート */}
          <div style={{ display: 'flex', gap: 3 }}>
            {(['default', 'date', 'category'] as SortMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                style={{
                  flex: 1, fontSize: 10, padding: '3px 0', borderRadius: 5,
                  border: 'none',
                  background: sortMode === mode ? 'var(--primary-soft)' : 'transparent',
                  color: sortMode === mode ? 'var(--primary)' : 'var(--text-faint)',
                  cursor: 'pointer', fontWeight: sortMode === mode ? 700 : 400,
                  transition: 'all 0.12s',
                }}
              >{sortLabel[mode]}</button>
            ))}
          </div>
        </div>

        {/* スクロール可能なリスト */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0, padding: '4px 0' }}>

        {/* 空状態 */}
        {groups.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '40px 16px', color: 'var(--text-faint)', fontSize: 13, textAlign: 'center' }}>
            <div>申請するツールがありません</div>
            <button className="btn primary" style={{ fontSize: 12 }} onClick={() => setDialogOpen(true)}>
              ＋ 申請するツールを選択
            </button>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>
            該当なし
          </div>
        ) : (
          filteredGroups.map((g) => {
            const s = g.submissions[0]
            const meta = metaOf(s.software)
            const isSelected = selectedGroupId === g.id
            return (
              <button
                key={g.id}
                onClick={() => selectGroup(g)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 12px', margin: '0 4px',
                  borderRadius: 8, border: 'none',
                  background: isSelected ? 'var(--primary-soft)' : 'transparent',
                  textAlign: 'left', cursor: 'pointer', transition: 'background 0.12s',
                }}
                onMouseOver={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                onMouseOut={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {meta.icon
                  ? <img src={meta.icon} alt="" style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: 5, flexShrink: 0 }} />
                  : <div style={{ width: 26, height: 26, borderRadius: 5, background: s.badgeColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>📄</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5, color: isSelected ? 'var(--primary)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.software}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ background: s.badgeColor + '20', color: s.badgeColor, padding: '0px 5px', borderRadius: 3, fontSize: 9.5, fontWeight: 700, flexShrink: 0 }}>{s.badge}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.requestDate}</span>
                  </div>
                </div>
                {s.alert && <span style={{ fontSize: 12, flexShrink: 0 }}>⚠️</span>}
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); removeGroup(g.id) }}
                  title="削除"
                  style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1, padding: '2px 3px', borderRadius: 4, cursor: 'pointer', flexShrink: 0, opacity: 0.6 }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = '#e11d48'; (e.currentTarget as HTMLElement).style.opacity = '1' }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.opacity = '0.6' }}
                >✕</span>
              </button>
            )
          })
        )}
        </div>{/* end scroll */}
      </div>

      {/* ── 右：スライド詳細 ── */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', height: '100%', paddingRight: 24 }}>
        {!selectedGroup || !activeSlide ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--text-faint)', fontSize: 14 }}>
            ← 左から申請ソフトを選んでください
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ── 新しい申請として追加ボタン ── */}
            <div style={{ marginBottom: -8 }}>
              <button
                className="btn"
                style={{ fontSize: 12 }}
                onClick={addNewSubmission}
                title="現在の申請を複製して新しい申請を作成します"
              >
                ＋ 新しい申請として追加
              </button>
            </div>

            {/* ── 現在の申請バナー ── */}
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: '8px 8px 0 0',
                background: 'var(--primary-soft)', border: '1px solid var(--primary, #2563eb)20',
                marginBottom: -1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                    ● 現在の申請 {activeSlide.requestDate ? `(${activeSlide.requestDate})` : ''}
                  </span>
                  {activeSlide.createdAt && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                      作成 {new Date(activeSlide.createdAt).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <button
                  style={{ fontSize: 11, color: '#e11d48', background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => selectedGroup && removeSubmission(selectedGroup.id, activeSlide.id)}
                >この申請を削除</button>
              </div>
              <SlideCard
                slide={activeSlide}
                optRow={optFor(activeSlide.software)}
                onExportPdf={() => setPrintSlide(activeSlide)}
                onExportPptx={() => exportAsPptx(activeSlide, breakdownFor(activeSlide), activeSlide.currentUsersOverride ?? countUsers(members, activeSlide.software))}
                onFocusField={onFocusField}
                members={members}
              />
            </div>

            {/* ── 申請履歴セクション ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>申請履歴</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {selectedGroup.submissions.length <= 1 ? (
                <div style={{ fontSize: 13, color: 'var(--text-faint)', textAlign: 'center', padding: '16px 0' }}>
                  過去の申請はありません
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    過去の申請
                  </div>
                  {selectedGroup.submissions.slice(1).map((s) => {
                    const expanded = expandedHistoryIds.has(s.id)
                    return (
                      <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <button
                          onClick={() => toggleHistory(s.id)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ background: s.badgeColor + '18', color: s.badgeColor, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{s.badge}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>申請日: {s.requestDate || '—'}</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.costNote ? (s.costNote.length > 40 ? s.costNote.slice(0, 40) + '…' : s.costNote) : '（費用概算なし）'}
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); selectedGroup && removeSubmission(selectedGroup.id, s.id) }}
                            title="この申請を削除"
                            style={{ fontSize: 13, color: 'var(--text-faint)', padding: '2px 4px', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                            onMouseOver={(ev) => { (ev.currentTarget as HTMLElement).style.color = '#e11d48' }}
                            onMouseOut={(ev) => { (ev.currentTarget as HTMLElement).style.color = 'var(--text-faint)' }}
                          >✕</span>
                        </button>
                        {expanded && (
                          <div style={{ borderTop: '1px solid var(--border)', padding: '16px' }}>
                            <SlideCard
                              slide={s}
                              optRow={optFor(s.software)}
                              onExportPdf={() => setPrintSlide(s)}
                              onExportPptx={() => exportAsPptx(s, breakdownFor(s), s.currentUsersOverride ?? countUsers(members, s.software))}
                              readOnly
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 削除確認ダイアログ ── */}
      {deleteTarget && (() => {
        const isGroup = deleteTarget.kind === 'group'
        const targetGroup = groups.find((g) => g.id === deleteTarget.groupId)
        const softwareName = targetGroup?.submissions[0]?.software ?? ''
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setDeleteTarget(null)}>
            <div style={{
              background: 'var(--surface)', borderRadius: 14, padding: '28px 28px 22px',
              width: 360, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              border: '1px solid var(--border)',
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 18, marginBottom: 10 }}>🗑️</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: 'var(--text)' }}>
                {isGroup ? 'ツールをリストから削除' : 'この申請を削除'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22, lineHeight: 1.6 }}>
                {isGroup
                  ? <><strong>{softwareName}</strong> の申請をすべて削除します。この操作は取り消せません。</>
                  : <>この申請を削除します。この操作は取り消せません。</>
                }
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDeleteTarget(null)}
                  style={{
                    padding: '7px 18px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--surface-2)', color: 'var(--text-muted)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >キャンセル</button>
                <button
                  onClick={confirmDelete}
                  style={{
                    padding: '7px 18px', borderRadius: 8, border: 'none',
                    background: '#e11d48', color: '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >削除する</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── ソフト追加ダイアログ ── */}
      {dialogOpen && (
        <SoftwareSelectDialog
          groups={groups}
          onAdd={(software) => {
            const newGroup: ApplicationGroup = {
              id: `group-${software.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`,
              software,
              submissions: [blankSlide(software, contracts, members)],
            }
            setGroups((prev) => [...prev, newGroup])
            setSelectedGroupId(newGroup.id)
            setDialogOpen(false)
          }}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  )
}

// ─── SoftwareSelectDialog ────────────────────────────────────────────────────
function SoftwareSelectDialog({
  groups,
  onAdd,
  onClose,
}: {
  groups: ApplicationGroup[]
  onAdd: (software: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const existingNames = new Set(groups.map((g) => g.software))

  const filtered = SOFTWARE_CATALOG.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.category.toLowerCase().includes(query.toLowerCase())
  )

  const byCategory: Record<string, typeof SOFTWARE_CATALOG> = {}
  for (const item of filtered) {
    if (!byCategory[item.category]) byCategory[item.category] = []
    byCategory[item.category].push(item)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 480, maxWidth: '92vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* タイトル */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>申請ソフトを追加</div>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: 4 }}
            onClick={onClose}
          >✕</button>
        </div>

        {/* 検索 */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <input
            autoFocus
            type="text"
            placeholder="ソフト名で検索…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--bg)', color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* リスト */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{cat}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map((item) => {
                  const meta = metaOf(item.name)
                  const added = existingNames.has(item.name)
                  return (
                    <button
                      key={item.name}
                      disabled={added}
                      onClick={() => !added && onAdd(item.name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                        border: '1.5px solid var(--border)',
                        background: added ? 'var(--surface-2, #f8f9fb)' : 'var(--surface)',
                        cursor: added ? 'default' : 'pointer',
                        opacity: added ? 0.6 : 1,
                        textAlign: 'left', transition: 'all 0.15s',
                      }}
                      onMouseOver={(e) => { if (!added) e.currentTarget.style.background = 'var(--primary-soft)' }}
                      onMouseOut={(e) => { if (!added) e.currentTarget.style.background = 'var(--surface)' }}
                    >
                      {meta.icon
                        ? <img src={meta.icon} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6 }} />
                        : <div style={{ width: 28, height: 28, borderRadius: 6, background: '#7c3aed22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📦</div>
                      }
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{item.category}</div>
                      </div>
                      {added && (
                        <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, flexShrink: 0 }}>✓ 追加済み</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 13, padding: '24px 0' }}>
              「{query}」に一致するソフトが見つかりません
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── スライドカード ────────────────────────────────────────────────────
function SlideCard({
  slide: s,
  optRow,
  onExportPdf,
  onExportPptx,
  onFocusField,
  readOnly,
  members,
}: {
  slide: Slide
  optRow?: OptRow
  onExportPdf: () => void
  onExportPptx: () => void
  onFocusField?: (field: string) => void
  readOnly?: boolean
  members?: Member[]
}) {
  const meta = metaOf(s.software)
  const [exportOpen, setExportOpen] = useState(false)

  const clickable = (field: string) => ({
    onClick: () => !readOnly && onFocusField?.(field),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ヘッダー */}
      <div className="card" style={{ padding: '20px 24px', borderLeft: `4px solid ${s.badgeColor}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: s.alert ? 12 : 0 }}>
          {meta.icon
            ? <img src={meta.icon} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 10 }} />
            : <div style={{ width: 48, height: 48, borderRadius: 10, background: s.badgeColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📄</div>
          }
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{s.software}</h2>
              <span style={{ background: s.badgeColor + '18', color: s.badgeColor, padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: `1px solid ${s.badgeColor}30` }}>{s.badge}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              <span {...clickable('vendor')} style={{ cursor: !readOnly && onFocusField ? 'pointer' : undefined }}>{s.vendor}</span>
              {' ／ 購入窓口：'}
              <strong {...clickable('purchaseVia')} style={{ cursor: !readOnly && onFocusField ? 'pointer' : undefined }}>{s.purchaseVia}</strong>
            </div>
          </div>

          {!readOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {s.requestDate && (
                <div
                  {...clickable('requestDate')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', cursor: 'pointer', padding: '4px 10px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)' }}
                >
                  <span style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 1 }}>申請・実施月</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{s.requestDate}</span>
                </div>
              )}
              {s.targetRenewalDate && (
                <div
                  {...clickable('targetRenewalDate')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', cursor: 'pointer', padding: '4px 10px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0' }}
                >
                  <span style={{ fontSize: 9, color: '#6b7280', marginBottom: 1 }}>目標更新月</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>{s.targetRenewalDate}</span>
                </div>
              )}
              <div style={{ position: 'relative' }}>
              <button
                className="btn primary"
                style={{ fontSize: 12 }}
                onClick={() => setExportOpen((v) => !v)}
              >
                ↗ 出力 ▾
              </button>
              {exportOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setExportOpen(false)} />
                  <div style={{
                    position: 'absolute', right: 0, top: '110%', zIndex: 20,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow)',
                    minWidth: 180, overflow: 'hidden',
                  }}>
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
                      onClick={() => { setExportOpen(false); onExportPptx() }}
                    >
                      <span style={{ fontSize: 18 }}>📊</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>PowerPoint</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>.pptx ファイルを保存</div>
                      </div>
                    </button>
                    <div style={{ height: 1, background: 'var(--border)' }} />
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
                      onClick={() => { setExportOpen(false); onExportPdf() }}
                    >
                      <span style={{ fontSize: 18 }}>📄</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>PDF</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>印刷プレビューからPDF保存</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
              </div>
            </div>
          )}
        </div>

        {s.alert && (
          <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e' }}>
            {s.alert}
          </div>
        )}
      </div>

      {/* 本数フロー：現在 → 申請後 */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <FlowNode
          label="現在の契約本数"
          value={s.currentSeats}
          unit="本"
          onClick={!readOnly && onFocusField ? () => onFocusField('currentSeats') : undefined}
        />
        <FlowArrow color={s.requestSeats > 0 ? s.badgeColor : s.requestSeats < 0 ? '#e11d48' : 'var(--text-faint)'} />
        {s.requestSeats !== 0
          ? <FlowNode
              label="増減申請本数"
              value={s.requestSeats > 0 ? `＋${s.requestSeats}` : `−${Math.abs(s.requestSeats)}`}
              unit="本"
              color={s.requestSeats > 0 ? s.badgeColor : '#e11d48'}
              onClick={!readOnly && onFocusField ? () => onFocusField('requestSeats') : undefined}
            />
          : <FlowNode
              label="増減申請本数"
              value="変更なし"
              color="var(--text-muted)"
              onClick={!readOnly && onFocusField ? () => onFocusField('requestSeats') : undefined}
            />
        }
        <FlowArrow color="#16a34a" />
        <FlowNode
          label="申請後の本数"
          value={s.currentSeats + s.requestSeats}
          unit="本"
          color="#15803d"
          hero
          onClick={!readOnly && onFocusField ? () => onFocusField('requestSeats') : undefined}
        />
      </div>

      {/* 利用人数分析 */}
      {members && sectionVisible(s, 'userAnalysis') && <UserAnalysisPanel slide={s} members={members} readOnly={readOnly} onFocusField={onFocusField} />}

      {/* 最適化内訳（利用実態より） */}
      {sectionVisible(s, 'optBreakdown') && (() => {
        const b = (s.optBreakdown && Array.isArray(s.optBreakdown.items)) ? s.optBreakdown : (optRow && optRow.assigned > 0 ? deriveBreakdown(optRow) : null)
        return b && (b.items?.length ?? 0) > 0 ? <OptimizationBreakdown b={b} currentSeats={s.currentSeats} onFocusField={onFocusField} readOnly={readOnly} /> : null
      })()}

      {/* 費用概算 */}
      {sectionVisible(s, 'cost') && (
      <div
        className="card"
        style={{ padding: '16px 20px', cursor: !readOnly && onFocusField ? 'pointer' : undefined, transition: 'background 0.15s' }}
        {...clickable('costNote')}
        onMouseOver={(e) => { if (!readOnly && onFocusField) e.currentTarget.style.background = 'var(--surface-2, #f1f3f9)' }}
        onMouseOut={(e) => { e.currentTarget.style.background = '' }}
      >
        <SectionLabel icon="💰" color="#f59e0b">費用概算</SectionLabel>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.6, paddingLeft: 33 }}>{s.costNote || '—'}</div>
      </div>
      )}

      {/* 申請理由 */}
      {sectionVisible(s, 'reason') && (
      <div
        className="card"
        style={{ padding: '16px 20px', cursor: !readOnly && onFocusField ? 'pointer' : undefined, transition: 'background 0.15s' }}
        {...clickable('reason')}
        onMouseOver={(e) => { if (!readOnly && onFocusField) e.currentTarget.style.background = 'var(--surface-2, #f1f3f9)' }}
        onMouseOut={(e) => { e.currentTarget.style.background = '' }}
      >
        <SectionLabel icon="📝" color="var(--primary)">申請理由</SectionLabel>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text)', paddingLeft: 33 }}>{s.reason || '—'}</div>
      </div>
      )}

      {/* スケジュール */}
      {sectionVisible(s, 'schedule') && (
      <div className="card" style={{ padding: '16px 20px' }}>
        <SectionLabel icon="📅" color={s.badgeColor}>実施スケジュール</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingLeft: 6 }}>
          {s.actions.map((a, i) => (
            <div
              key={i}
              style={{ display: 'flex', gap: 16, position: 'relative', cursor: !readOnly && onFocusField ? 'pointer' : undefined, borderRadius: 6, transition: 'background 0.15s' }}
              {...clickable(`action-${i}`)}
              onMouseOver={(e) => { if (!readOnly && onFocusField) e.currentTarget.style.background = 'var(--surface-2, #f1f3f9)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = '' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.badgeColor, marginTop: 4, flexShrink: 0 }} />
                {i < s.actions.length - 1 && <div style={{ width: 2, flex: 1, background: s.badgeColor + '30', marginTop: 2 }} />}
              </div>
              <div style={{ paddingBottom: i < s.actions.length - 1 ? 16 : 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.badgeColor, marginBottom: 2 }}>{a.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{a.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  )
}

function UserAnalysisPanel({ slide: s, members, readOnly, onFocusField }: { slide: Slide; members: Member[]; readOnly?: boolean; onFocusField?: (f: string) => void }) {
  const currentUsers = s.currentUsersOverride ?? countUsers(members, s.software)
  const delta = s.userDelta ?? 0
  const additionalSeats = delta  // 人数増減 = 追加本数目安（1:1）
  const pct = s.currentSeats > 0 ? Math.round(Math.abs(additionalSeats / s.currentSeats) * 100) : 0
  const isIncrease = delta > 0
  const isDecrease = delta < 0

  const cellBase: React.CSSProperties = { textAlign: 'center', padding: '10px 8px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', cursor: !readOnly && onFocusField ? 'pointer' : undefined, transition: 'background 0.15s' }

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <SectionLabel icon="👥" color="var(--primary)">利用人数分析</SectionLabel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {/* 現在の利用者数 */}
        <div
          style={cellBase}
          onClick={!readOnly && onFocusField ? () => onFocusField('currentUsersOverride') : undefined}
          onMouseOver={(e) => { if (!readOnly && onFocusField) e.currentTarget.style.background = 'var(--surface-2, #f1f3f9)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg)' }}
        >
          <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 4 }}>現在の利用者数</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{currentUsers} <span style={{ fontSize: 12, fontWeight: 400 }}>名</span></div>
        </div>

        {/* 現在の契約本数 */}
        <div
          style={cellBase}
          onClick={!readOnly && onFocusField ? () => onFocusField('currentSeats') : undefined}
          onMouseOver={(e) => { if (!readOnly && onFocusField) e.currentTarget.style.background = 'var(--surface-2, #f1f3f9)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg)' }}
        >
          <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 4 }}>現在の契約本数</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{s.currentSeats} <span style={{ fontSize: 12, fontWeight: 400 }}>本</span></div>
        </div>

        {/* 人数の増減 */}
        <div
          style={{ ...cellBase, background: isIncrease ? '#f0fdf4' : isDecrease ? '#fff1f2' : 'var(--bg)', border: `1px solid ${isIncrease ? '#bbf7d0' : isDecrease ? '#fecdd3' : 'var(--border)'}` }}
          onClick={!readOnly && onFocusField ? () => onFocusField('userDelta') : undefined}
          onMouseOver={(e) => { if (!readOnly && onFocusField) e.currentTarget.style.background = isIncrease ? '#dcfce7' : isDecrease ? '#ffe4e6' : 'var(--surface-2, #f1f3f9)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = isIncrease ? '#f0fdf4' : isDecrease ? '#fff1f2' : 'var(--bg)' }}
        >
          <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 4 }}>人数の増減</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: isIncrease ? '#15803d' : isDecrease ? '#e11d48' : 'var(--text)' }}>
            {delta === 0 ? '±0' : delta > 0 ? `＋${delta}` : delta}
            <span style={{ fontSize: 12, fontWeight: 400 }}> 名</span>
          </div>
        </div>

        {/* 追加本数目安 */}
        <div
          style={{ ...cellBase, background: additionalSeats === 0 ? 'var(--bg)' : isIncrease ? '#f0fdf4' : '#fff1f2', border: `1px solid ${additionalSeats === 0 ? 'var(--border)' : isIncrease ? '#bbf7d0' : '#fecdd3'}` }}
          onClick={!readOnly && onFocusField ? () => onFocusField('requestSeats') : undefined}
          onMouseOver={(e) => { if (!readOnly && onFocusField) e.currentTarget.style.background = isIncrease ? '#dcfce7' : isDecrease ? '#ffe4e6' : 'var(--surface-2, #f1f3f9)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = additionalSeats === 0 ? 'var(--bg)' : isIncrease ? '#f0fdf4' : '#fff1f2' }}
        >
          <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 4 }}>追加本数目安</div>
          {additionalSeats === 0
            ? <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)' }}>±0 本</div>
            : <>
                <div style={{ fontSize: 18, fontWeight: 700, color: isIncrease ? '#15803d' : '#e11d48' }}>
                  {isIncrease ? '＋' : ''}{additionalSeats} <span style={{ fontSize: 11, fontWeight: 400 }}>本</span>
                </div>
                <div style={{ fontSize: 11, color: isIncrease ? '#16a34a' : '#e11d48', marginTop: 2 }}>
                  {isIncrease ? '＋' : '−'}{pct}% {isIncrease ? '増加' : '削減'}
                </div>
              </>
          }
        </div>
      </div>
    </div>
  )
}

// ─── 最適化内訳（利用実態より自動算出 → 編集可能） ─────────────────────
function OptimizationBreakdown({ b, currentSeats, onFocusField, readOnly }: { b: OptBreakdown; currentSeats: number; onFocusField?: (f: string) => void; readOnly?: boolean }) {
  const clickable = !readOnly && onFocusField
  const items = b.items ?? []
  const after = optAfterSeats(b)            // 申請後の本数 = 需要の合計
  const needTerms = optNeedTerms(b)         // 申請後の項（需要）
  const allDelta = optDeltaTerms(b)
  const reductions = allDelta.filter((t) => t.sign === '-')   // 削減申請本数の項
  const additions = allDelta.filter((t) => t.sign === '+')    // 増加申請本数の項
  const reduceTotal = reductions.reduce((s, t) => s + t.value, 0)
  const addTotal = additions.reduce((s, t) => s + t.value, 0)

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <SectionLabel icon="💡" color="#0f6e56">最適化内訳（利用実態より）</SectionLabel>

      {/* 区分カード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 10 }}>
        {items.map((it) => {
          const color = optKindMeta(it.kind).color
          const seats = optItemSeats(it)
          const result = it.kind === 'remove' ? (it.people > 0 ? `${it.people}本 返却可` : '—')
            : it.kind === 'shared' ? `${seats}本（${it.ratio ?? 2}人で1本）`
            : `${seats}本`
          return (
            <div
              key={it.id}
              onClick={clickable ? () => onFocusField!(`opt.item.${it.id}`) : undefined}
              style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', cursor: clickable ? 'pointer' : undefined, transition: 'box-shadow .15s' }}
              onMouseOver={(e) => { if (clickable) e.currentTarget.style.boxShadow = '0 3px 12px rgba(16,24,40,0.10)' }}
              onMouseOut={(e) => { e.currentTarget.style.boxShadow = '' }}
            >
              <div style={{ background: color, color: '#fff', padding: '6px 10px', fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>{it.label}</div>
              <div style={{ padding: '10px 8px', textAlign: 'center', background: 'var(--surface)' }}>
                {it.kind === 'reserve' ? (
                  <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{seats}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}> 本</span></div>
                ) : (
                  <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{it.people}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}> 名</span></div>
                )}
                {it.note && <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4 }}>{it.note}</div>}
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginTop: 5 }}>
                  {it.kind === 'reserve' ? '→ 追加' : `→ ${result}`}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 必要本数の根拠：削減 / 増加 / 申請後 */}
      <div style={{ marginTop: 16, padding: '16px 20px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700 }}>必要本数の根拠</div>

        {/* 削減申請本数 */}
        {reductions.length > 0 && (
          <>
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 700, marginBottom: 6 }}>削減申請本数</div>
            <FormulaRow terms={reductions} resultLabel="削減" result={reduceTotal} resultColor="#e11d48" />
          </>
        )}

        {/* 増加申請本数 */}
        {additions.length > 0 && (
          <>
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 700, margin: reductions.length > 0 ? '14px 0 6px' : '0 0 6px', paddingTop: reductions.length > 0 ? 12 : 0, borderTop: reductions.length > 0 ? '1px solid var(--border)' : undefined }}>増加申請本数</div>
            <FormulaRow terms={additions} resultLabel="増加" result={addTotal} resultColor="#2563eb" />
          </>
        )}

        {reductions.length === 0 && additions.length === 0 && (
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-faint)', marginBottom: 6 }}>増減なし</div>
        )}

        {/* 申請後の本数 */}
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 700, margin: '14px 0 6px', paddingTop: 12, borderTop: '1px solid var(--border)' }}>申請後の本数（必要数の合計）</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '4px 8px', lineHeight: 1.5 }}>
          {needTerms.length === 0
            ? <span style={{ color: 'var(--text-faint)', fontSize: 18, fontWeight: 800 }}>—</span>
            : needTerms.map((t, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 4 }}>
                  {i > 0 && <span style={{ color: 'var(--text-faint)', fontWeight: 700, fontSize: 18 }}>＋</span>}
                  <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: t.color }}>{t.label}</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{t.value}</span>
                  </span>
                </span>
              ))}
          <span style={{ color: 'var(--text-faint)', fontWeight: 700, fontSize: 18 }}>＝</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#0f6e56', lineHeight: 1 }}>{after}</span>
          <span style={{ fontSize: 14, color: '#0f6e56' }}>本</span>
        </div>
      </div>
    </div>
  )
}

// 式の1行：項（ラベル小＋数字大）を ＋ で連結 → ＝ 合計本
function FormulaRow({ terms, resultLabel, result, resultColor }: { terms: { label: string; value: number; color: string }[]; resultLabel: string; result: number; resultColor: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '4px 8px', lineHeight: 1.5 }}>
      {terms.map((t, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 4 }}>
          {i > 0 && <span style={{ color: 'var(--text-faint)', fontWeight: 700, fontSize: 18 }}>＋</span>}
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: t.color }}>{t.label}</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{t.value}</span>
          </span>
        </span>
      ))}
      <span style={{ color: 'var(--text-faint)', fontWeight: 700, fontSize: 18 }}>＝</span>
      <span style={{ fontSize: 26, fontWeight: 800, color: resultColor, lineHeight: 1 }}>{result}</span>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>本 {resultLabel}</span>
    </div>
  )
}

// ─── 共通：セクション見出し ───────────────────────────────────────────
function SectionLabel({ icon, color, children }: { icon: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
      <span style={{
        width: 24, height: 24, borderRadius: 7,
        background: color + '18', color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, flexShrink: 0,
      }}>{icon}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', letterSpacing: 0.3 }}>{children}</span>
    </div>
  )
}

// ─── 本数フロー：現在 → 申請後 ────────────────────────────────────────
function FlowNode({ label, value, unit, sub, color, hero, onClick }: {
  label: string; value: string | number; unit?: string; sub?: string;
  color?: string; hero?: boolean; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0, padding: '16px 10px', borderRadius: 12, textAlign: 'center',
        background: hero ? '#f0fdf4' : 'var(--surface)',
        border: `1px solid ${hero ? '#bbf7d0' : 'var(--border)'}`,
        boxShadow: hero ? '0 2px 14px rgba(22,163,74,0.12)' : 'var(--shadow)',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseOver={(e) => { if (onClick) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = hero ? '0 6px 20px rgba(22,163,74,0.18)' : '0 4px 16px rgba(16,24,40,0.10)' } }}
      onMouseOut={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = hero ? '0 2px 14px rgba(22,163,74,0.12)' : 'var(--shadow)' }}
    >
      <div style={{ fontSize: 11, color: hero ? '#15803d' : 'var(--text-muted)', marginBottom: 7, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: typeof value === 'string' && value.length > 3 ? 18 : (hero ? 28 : 24), fontWeight: 800, color: color ?? 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}{unit && <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 3 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, marginTop: 5, fontWeight: 700, color }}>{sub}</div>}
    </div>
  )
}

function FlowArrow({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color, flexShrink: 0 }}>
      <span style={{ fontSize: 16, fontWeight: 700 }}>→</span>
    </div>
  )
}

function StatCard({ label, value, color, accent, onClick }: { label: string; value: string; color?: string; accent?: boolean; onClick?: () => void }) {
  return (
    <div
      className="card"
      style={{ padding: '14px 16px', cursor: onClick ? 'pointer' : undefined, transition: 'background 0.15s', ...(accent ? { border: '1.5px solid #bbf7d0', background: '#f0fdf4' } : {}) }}
      onClick={onClick}
      onMouseOver={(e) => { if (onClick) e.currentTarget.style.background = accent ? '#dcfce7' : 'var(--surface-2, #f1f3f9)' }}
      onMouseOut={(e) => { e.currentTarget.style.background = accent ? '#f0fdf4' : '' }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  )
}

// ─── PDF 印刷ビュー ────────────────────────────────────────────────────
function PrintSlide({ slide: s, optRow, onClose }: { slide: Slide; optRow?: OptRow; onClose: () => void }) {
  const meta = metaOf(s.software)
  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0 }}>PDF出力プレビュー：{s.software}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={() => { exportAsPdf(); onClose() }}>📄 PDFとして保存</button>
          <button className="btn" onClick={onClose}>← 戻る</button>
        </div>
      </div>
      <div className="card print-slide" style={{ padding: '32px 40px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '2px solid var(--border)', paddingBottom: 20, marginBottom: 20 }}>
          {meta.icon && <img src={meta.icon} alt="" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 12 }} />}
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{s.software} — ライセンス申請</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {s.vendor} ／ 購入窓口：{s.purchaseVia} ／ 申請月：{s.requestDate}
            </div>
          </div>
          <span style={{ marginLeft: 'auto', background: s.badgeColor + '18', color: s.badgeColor, padding: '4px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${s.badgeColor}40`, whiteSpace: 'nowrap' }}>{s.badge}</span>
        </div>
        {s.alert && (
          <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#92400e', marginBottom: 20 }}>
            {s.alert}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: '現在の契約本数', value: `${s.currentSeats} 本` },
            { label: '増減申請本数', value: s.requestSeats === 0 ? '変更なし' : `${s.requestSeats > 0 ? '＋' : '−'}${Math.abs(s.requestSeats)} 本` },
            { label: '申請・実施月', value: s.requestDate },
            { label: '目標更新月', value: s.targetRenewalDate },
          ].map((item) => (
            <div key={item.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}
        </div>
        {sectionVisible(s, 'optBreakdown') && (() => {
          const b = (s.optBreakdown && Array.isArray(s.optBreakdown.items)) ? s.optBreakdown : (optRow && optRow.assigned > 0 ? deriveBreakdown(optRow) : null)
          return b && (b.items?.length ?? 0) > 0 ? <div style={{ marginBottom: 16 }}><OptimizationBreakdown b={b} currentSeats={s.currentSeats} readOnly /></div> : null
        })()}
        {sectionVisible(s, 'cost') && (
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', marginBottom: 4 }}>費用概算</div>
          <div style={{ fontSize: 13 }}>{s.costNote}</div>
        </div>
        )}
        {sectionVisible(s, 'reason') && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', marginBottom: 8 }}>申請理由</div>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>{s.reason}</div>
        </div>
        )}
        {sectionVisible(s, 'schedule') && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', marginBottom: 12 }}>実施スケジュール</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', width: '30%', borderBottom: '1px solid var(--border)' }}>時期</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }}>内容</th>
              </tr>
            </thead>
            <tbody>
              {s.actions.map((a, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: s.badgeColor }}>{a.label}</td>
                  <td style={{ padding: '10px 12px', lineHeight: 1.6 }}>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-faint)', display: 'flex', justifyContent: 'space-between' }}>
          <span>AppManagement — ライセンス更新集約申請書</span>
          <span>作成日：2026年6月26日</span>
        </div>
      </div>
    </div>
  )
}
