import { useEffect, useMemo, useRef, useState } from 'react'
import Dashboard from './components/Dashboard'
import Members from './components/Members'
import Software from './components/Software'
import AITools from './components/AITools'
import ApiKeys from './components/ApiKeys'
import Analytics from './components/Analytics'
import Optimize from './components/Optimize'
import Contracts from './components/Contracts'
import BudgetView from './components/BudgetView'
import ApplicationForm from './components/ApplicationForm'
import SurveyRounds from './components/SurveyRounds'
import EditView, { isEditable } from './components/EditView'
import RightPanel, { AlertBell, type Selection } from './components/RightPanel'
import { useStore } from './store'
import { computeSpend } from './data/budgets'
import { SEED_AI_PLANS } from './data/aiplans'
import type { ApplicationGroup, Slide } from './data/application'
import { parseUsageRows, parseAutodeskCsv } from './data/usage'
import { parseSpreadsheetFile } from './spreadsheetImport'

// ソフト名キーワード→swキー のマッピング（長い/具体的なものを先に）
const SW_KEYWORD_MAP: Array<[RegExp, string]> = [
  [/autocad.?lt|autocadlt/i, 'AutocadLT'],
  [/autocad/i, 'Autocad'],
  [/sketchup/i, 'sketchup'],
  [/revit/i, 'Revit'],
  [/creative.?cloud|creativecloud/i, 'CreativeCloud'],
  [/adobe.?express/i, 'Adobe Express'],
  [/acrobat/i, 'acrobat'],
  [/photoshop/i, 'photoshop'],
  [/solidworks/i, 'solidworks'],
  [/twinmotion/i, 'Twinmotion'],
  [/midjourney/i, 'Midjourney'],
  [/chatgpt.?pro/i, 'chatGPTPro'],
  [/chatgpt/i, 'chatGPTBusiness'],
  [/krea/i, 'KreaAI'],
  [/genspark/i, 'Genspark'],
  [/tripo/i, 'Tripo'],
  [/google.?ai/i, 'GoogleAI'],
]

function detectSwFromText(text: string): string | null {
  for (const [pattern, sw] of SW_KEYWORD_MAP) {
    if (pattern.test(text)) return sw
  }
  return null
}

const SW_DISPLAY: Record<string, string> = {
  Autocad: 'AutoCAD', AutocadLT: 'AutoCAD LT', acrobat: 'Acrobat',
  photoshop: 'Photoshop', sketchup: 'SketchUp', solidworks: 'SolidWorks',
  CreativeCloud: 'Creative Cloud', 'Adobe Express': 'Adobe Express',
  Midjourney: 'Midjourney', Twinmotion: 'Twinmotion', Revit: 'Revit',
  KreaAI: 'Krea AI', Genspark: 'Genspark', Tripo: 'Tripo', GoogleAI: 'Google AI',
  chatGPTBusiness: 'ChatGPT Business', chatGPTPro: 'ChatGPT Pro',
}
function swDisplayName(sw: string): string { return SW_DISPLAY[sw] ?? sw }

type View = 'optimize' | 'analytics' | 'dashboard' | 'members' | 'software' | 'aitools' | 'contracts' | 'budget' | 'api' | 'application' | 'survey'

const GROUPS: { key: string; icon: string; label: string; views: View[] }[] = [
  { key: 'software', icon: '🏠', label: 'ホーム', views: ['software', 'survey'] },
  { key: 'members', icon: '👥', label: 'メンバー', views: ['members'] },
  { key: 'contracts', icon: '📅', label: '契約スケジュール', views: ['contracts'] },
  { key: 'cost', icon: '💰', label: 'コスト', views: ['budget', 'api'] },
  { key: 'application', icon: '📋', label: '申請書', views: ['application'] },
]

const SUBTABS: Record<View, string> = {
  optimize: '判断・最適化',
  analytics: '利用状況',
  dashboard: '全社概要',
  members: 'メンバー',
  software: 'ソフトウェア',
  survey: 'アンケート',
  aitools: 'AIツール',
  contracts: '契約スケジュール',
  budget: '予算',
  api: 'API',
  application: '申請書',
}

export default function App() {
  const { resetDemo, contracts, apiKeys, budgets, initFromSupabase, members, software, importUsage, applicationGroups: groups, saveApplicationGroups, setApplicationGroups } = useStore()

  useEffect(() => { initFromSupabase() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState<View>('software')
  const [sel, setSel] = useState<Selection | null>(null)
  const [rightOpen, setRightOpen] = useState(true)
  const [editMode, setEditMode] = useState(false)

  const spend = useMemo(() => computeSpend(contracts, SEED_AI_PLANS, apiKeys), [contracts, apiKeys])
  const years = useMemo(() => {
    const set = new Set<number>()
    for (const b of budgets) set.add(b.year)
    for (const s of spend) set.add(s.year)
    return [...set].sort((a, b) => b - a)
  }, [budgets, spend])
  const [year, setYear] = useState<number>(() => years[0] ?? 2026)

  function setGroups(updater: ApplicationGroup[] | ((prev: ApplicationGroup[]) => ApplicationGroup[])) {
    const next = typeof updater === 'function' ? updater(groups) : updater
    saveApplicationGroups(next)
  }
  const applySlide = (updated: Slide) =>
    groups.map((g) =>
      g.submissions[0]?.id === updated.id
        ? { ...g, submissions: [updated, ...g.submissions.slice(1)] }
        : g
    )
  // 編集中：状態のみ即時反映（表示画面にライブ反映、localStorageへも自動保存）
  const updateSlideLive = (updated: Slide) => setApplicationGroups(applySlide(updated))
  // 明示保存：Supabaseへ永続化
  const updateSlide = (updated: Slide) => { saveApplicationGroups(applySlide(updated)) }

  const [appFocusField, setAppFocusField] = useState<string | null>(null)

  // 統合アップロード
  type UploadResult = {
    ok: boolean
    swName: string        // 'Autodesk（複数製品）' or specific sw display name
    matched: number
    unmatchedNames: string[]
    unknownSoftware: string[]
    skipped: number
    freqBreakdown: Record<string, number>
    error?: string
  }
  const uploadRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    const today = new Date().toISOString().slice(0, 10)
    try {
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text()
        const firstLine = text.replace(/^﻿/, '').split(/\r?\n/)[0] ?? ''
        if (/day.?used/i.test(firstLine)) {
          const res = parseAutodeskCsv(text, members, software, today)
          if (res.records.length > 0) {
            importUsage(res.records, { name: 'Autodesk 使用状況取込 ' + today, sentAt: today, closedAt: today, targetCount: members.length })
          }
          const freq: Record<string, number> = {}
          for (const r of res.records) freq[r.frequency] = (freq[r.frequency] ?? 0) + 1
          setUploadResult({ ok: res.matched > 0, swName: 'Autodesk（複数製品）', matched: res.matched, unmatchedNames: res.unmatchedNames, unknownSoftware: res.unknownSoftware, skipped: res.skipped, freqBreakdown: freq })
        } else {
          const rows = text.split(/\r?\n/).map(l => l.split(','))
          const headerText = rows.slice(0, 3).flat().join(' ')
          const sw = detectSwFromText(headerText) ?? detectSwFromText(file.name)
          if (!sw) { setUploadResult({ ok: false, swName: '（ソフト名を検出できません）', matched: 0, unmatchedNames: [], unknownSoftware: [], skipped: 0, freqBreakdown: {}, error: 'ファイルのヘッダーまたはファイル名にソフト名が含まれていません。' }); return }
          const res = parseUsageRows(rows, members, software, today, sw)
          if (res.records.length > 0) {
            importUsage(res.records, { name: swDisplayName(sw) + ' アンケート取込 ' + today, sentAt: today, closedAt: today, targetCount: members.length, software: sw })
          }
          const freq: Record<string, number> = {}
          for (const r of res.records) freq[r.frequency] = (freq[r.frequency] ?? 0) + 1
          setUploadResult({ ok: res.matched > 0, swName: swDisplayName(sw), matched: res.matched, unmatchedNames: res.unmatchedNames, unknownSoftware: res.unknownSoftware, skipped: res.skipped, freqBreakdown: freq })
        }
      } else {
        const rows = await parseSpreadsheetFile(file)
        const headerText = rows.slice(0, 3).flat().join(' ')
        const sw = detectSwFromText(headerText) ?? detectSwFromText(file.name)
        if (!sw) { setUploadResult({ ok: false, swName: '（ソフト名を検出できません）', matched: 0, unmatchedNames: [], unknownSoftware: [], skipped: 0, freqBreakdown: {}, error: 'ファイルのヘッダーまたはファイル名にソフト名が含まれていません。' }); return }
        const res = parseUsageRows(rows, members, software, today, sw)
        if (res.records.length > 0) {
          importUsage(res.records, { name: swDisplayName(sw) + ' アンケート取込 ' + today, sentAt: today, closedAt: today, targetCount: members.length, software: sw })
        }
        const freq: Record<string, number> = {}
        for (const r of res.records) freq[r.frequency] = (freq[r.frequency] ?? 0) + 1
        setUploadResult({ ok: res.matched > 0, swName: swDisplayName(sw), matched: res.matched, unmatchedNames: res.unmatchedNames, unknownSoftware: res.unknownSoftware, skipped: res.skipped, freqBreakdown: freq })
      }
    } catch (err) {
      setUploadResult({ ok: false, swName: file.name, matched: 0, unmatchedNames: [], unknownSoftware: [], skipped: 0, freqBreakdown: {}, error: err instanceof Error ? err.message : '取り込みに失敗しました' })
    } finally {
      setUploading(false)
    }
  }

  const editable = isEditable(view)
  const editing = editMode && editable

  const go = (v: View) => { setView(v); setSel(null); setEditMode(false) }
  const openSel = (s: Selection) => { setSel(s); setRightOpen(true) }
  const selectedSw = sel?.kind === 'software' ? sel.item : null
  const selectedMemberId = sel?.kind === 'member' ? sel.item?.id ?? null : null
  const group = GROUPS.find((g) => g.views.includes(view)) ?? GROUPS[0]

  const rbWidth = '500px'
  const cols = ['1fr', rightOpen && rbWidth].filter(Boolean).join(' ')

  return (
    <div className="app">
      <header className="app-header">
        <div className="hdr-brand">
          <div className="brand-logo">A</div>
          <span className="hdr-brand-name">AppManagement</span>
        </div>
        <div className="hdr-divider" />
        <nav className="hdr-nav">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              className={'hdr-nav-tab' + (group.key === g.key ? ' active' : '')}
              onClick={() => go(g.views[0])}
            >
              <span>{g.icon}</span>
              {g.label}
            </button>
          ))}
        </nav>
        <div className="hdr-actions">
          <button
            className="btn"
            disabled={uploading}
            onClick={() => uploadRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, padding: '6px 12px', color: 'var(--text)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {uploading ? '取込中…' : 'アンケート取込'}
          </button>
          <input ref={uploadRef} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: 'none' }} onChange={handleUpload} />
          {view === 'software' && (
            <select
              className="year-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}年度</option>
              ))}
            </select>
          )}
          {!editing && view === 'members' && (
            <button className="btn primary" onClick={() => openSel({ kind: 'member', mode: 'new', item: null })}>
              ＋ メンバーを追加
            </button>
          )}
          {!editing && view === 'contracts' && (
            <button className="btn primary" onClick={() => openSel({ kind: 'contract', mode: 'new', item: null })}>
              ＋ 契約を追加
            </button>
          )}
          {!editing && view === 'api' && (
            <button className="btn primary" onClick={() => openSel({ kind: 'apikey', mode: 'new', item: null })}>
              ＋ APIキーを追加
            </button>
          )}
          <AlertBell onNavigate={go} />
          {editable && (
            <button
              className={'btn' + (editing ? ' primary' : '')}
              onClick={() => {
                const next = !editMode
                setEditMode(next)
                setSel(null)
                if (next) setRightOpen(false)
              }}
            >
              {editing ? '✓ 編集を終了' : '✎ 編集'}
            </button>
          )}
          <button
            className={'hdr-toggle' + (rightOpen ? ' active' : '')}
            onClick={() => setRightOpen((v) => !v)}
            title={rightOpen ? '右パネルを閉じる' : '右パネルを開く'}
          >▦</button>
          <button
            className="hdr-toggle"
            onClick={() => { if (confirm('デモデータを初期状態に戻しますか？')) resetDemo() }}
            title="デモデータをリセット"
          >↺</button>
        </div>
      </header>

      {uploadResult && (() => {
        const r = uploadResult
        const FREQ_ORDER = ['daily', 'weekly', 'monthly', 'rare', 'never'] as const
        const FREQ_META: Record<string, { label: string; color: string }> = {
          daily:   { label: '毎日',             color: '#16a34a' },
          weekly:  { label: '週数回',            color: '#2563eb' },
          monthly: { label: '月1回程度',         color: '#7c3aed' },
          rare:    { label: 'ほとんど使わない',  color: '#d97706' },
          never:   { label: '使っていない',      color: '#dc2626' },
        }
        const maxCount = Math.max(...Object.values(r.freqBreakdown), 1)
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setUploadResult(null)}
          >
            <div
              className="card"
              style={{ width: 420, maxWidth: '92vw', padding: 0, overflow: 'hidden' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ヘッダー */}
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', background: r.ok ? '#f0fdf4' : r.error ? '#fef3c7' : '#fff7ed' }}>
                <span style={{ fontSize: 22 }}>{r.ok ? '✅' : r.error ? '⚠️' : '📭'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.ok ? '取込完了' : r.error ? '取込エラー' : '取込結果'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{r.swName}</div>
                </div>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: 4 }} onClick={() => setUploadResult(null)}>✕</button>
              </div>

              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* 件数サマリー */}
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', background: 'var(--surface-2)', borderRadius: 10 }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: r.matched > 0 ? '#16a34a' : 'var(--text-muted)' }}>{r.matched}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>取込件数</div>
                  </div>
                  {r.unmatchedNames.length > 0 && (
                    <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', background: 'var(--surface-2)', borderRadius: 10 }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: '#d97706' }}>{r.unmatchedNames.length}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>メンバー不一致</div>
                    </div>
                  )}
                  {r.skipped > 0 && (
                    <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', background: 'var(--surface-2)', borderRadius: 10 }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-muted)' }}>{r.skipped}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>スキップ</div>
                    </div>
                  )}
                </div>

                {/* エラーメッセージ */}
                {r.error && (
                  <div style={{ padding: '10px 12px', background: '#fef3c7', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
                    {r.error}
                  </div>
                )}

                {/* 利用頻度の内訳 */}
                {Object.keys(r.freqBreakdown).length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>利用頻度の内訳</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {FREQ_ORDER.filter(f => r.freqBreakdown[f]).map(f => (
                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 80, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{FREQ_META[f].label}</div>
                          <div style={{ flex: 1, height: 16, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.round(r.freqBreakdown[f] / maxCount * 100)}%`, height: '100%', background: FREQ_META[f].color, borderRadius: 4, transition: 'width 0.3s' }} />
                          </div>
                          <div style={{ width: 32, fontSize: 12, fontWeight: 700, color: FREQ_META[f].color, flexShrink: 0 }}>{r.freqBreakdown[f]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 不一致メンバー */}
                {r.unmatchedNames.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#d97706', marginBottom: 6 }}>⚠ メンバー一覧と一致しなかった名前・メール</div>
                    <div style={{ maxHeight: 80, overflowY: 'auto', padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                      {r.unmatchedNames.slice(0, 20).join(' / ')}{r.unmatchedNames.length > 20 ? ` 他 ${r.unmatchedNames.length - 20}件` : ''}
                    </div>
                  </div>
                )}

                {/* アクションボタン */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                  {r.matched > 0 && (
                    <button className="btn primary" style={{ fontSize: 13 }} onClick={() => { go('survey'); setUploadResult(null) }}>
                      アンケートタブで確認 →
                    </button>
                  )}
                  <button className="btn" style={{ fontSize: 13 }} onClick={() => setUploadResult(null)}>閉じる</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="app-body" style={{ gridTemplateColumns: cols }}>
        <main className={view === 'application' ? 'main main--application' : 'main'}>
          <div className="content" style={view === 'application' ? { padding: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' } : undefined}>
            {!editing && group.views.length > 1 && (
              <div className="subnav">
                {group.views.map((v) => (
                  <button
                    key={v}
                    className={'subtab' + (v === view ? ' active' : '')}
                    onClick={() => go(v)}
                  >
                    {SUBTABS[v]}
                  </button>
                ))}
              </div>
            )}

            {editing && isEditable(view) && <EditView view={view} />}
            {!editing && view === 'optimize' && (
              <Optimize
                onSoftwareClick={(sw) => openSel({ kind: 'software', mode: 'view', item: sw })}
                selectedSw={selectedSw}
              />
            )}
            {!editing && view === 'analytics' && <Analytics />}
            {!editing && view === 'dashboard' && <Dashboard />}
            {!editing && view === 'members' && (
              <Members
                onOpen={(m) => openSel({ kind: 'member', mode: 'view', item: m })}
                selectedMemberId={selectedMemberId}
              />
            )}
            {!editing && view === 'software' && (
              <Software
                onOpen={(sw) => openSel({ kind: 'software', mode: 'view', item: sw })}
                onOpenAiPlan={(p) => openSel({ kind: 'aiplan', mode: 'view', item: p })}
                onOpenApiService={(service) => openSel({ kind: 'apiservice', mode: 'view', item: service })}
                selectedSw={selectedSw}
                onClose={() => setSel(null)}
                year={year}
              />
            )}
            {!editing && view === 'aitools' && <AITools onOpen={(p) => openSel({ kind: 'aiplan', mode: 'view', item: p })} />}
            {!editing && view === 'survey' && <SurveyRounds />}
            {!editing && view === 'contracts' && <Contracts onOpen={(c) => openSel({ kind: 'contract', mode: 'view', item: c })} />}
            {!editing && view === 'budget' && <BudgetView />}
            {!editing && view === 'api' && <ApiKeys onOpen={(k) => openSel({ kind: 'apikey', mode: 'view', item: k })} />}
            {!editing && view === 'application' && (
              <div style={{ flex: 1, minHeight: 0, padding: '20px 0 20px 24px', overflow: 'hidden', display: 'flex' }}>
                <ApplicationForm
                  groups={groups}
                  setGroups={setGroups}
                  onOpenSlide={(slide) => { setAppFocusField(null); openSel({ kind: 'application', mode: 'edit', item: slide }) }}
                  onFocusField={setAppFocusField}
                />
              </div>
            )}
          </div>
        </main>

        {rightOpen && (
          <RightPanel
            view={view}
            selection={sel}
            onClose={() => setSel(null)}
            onNavigate={go}
            onAddMember={() => openSel({ kind: 'member', mode: 'new', item: null })}
            onAddContract={() => openSel({ kind: 'contract', mode: 'new', item: null })}
            onAddApiKey={() => openSel({ kind: 'apikey', mode: 'new', item: null })}
            onSelectMember={(m) => openSel({ kind: 'member', mode: 'view', item: m })}
            onUpdateSlide={updateSlide}
            onUpdateSlideLive={updateSlideLive}
            applicationFocusField={appFocusField}
          />
        )}
      </div>
    </div>
  )
}
