import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { daysUntil, renewalStatus } from '../data/contracts'
import type { Contract } from '../data/contracts'
import { usageRatio } from '../data/apikeys'
import type { ApiKey } from '../data/apikeys'
import { SEED_AI_PLANS } from '../data/aiplans'
import type { AiPlan } from '../data/aiplans'
import { computeSpend } from '../data/budgets'
import type { Member } from '../data/types'
import { metaOf } from '../data/software'
import { avatarColor, initials, yen } from '../utils'
import MemberDrawer from './MemberDrawer'
import ContractDrawer from './ContractDrawer'
import ApiKeyDrawer from './ApiKeyDrawer'

const TODAY = new Date('2026-06-16T00:00:00')

export type View = 'dashboard' | 'members' | 'software' | 'aitools' | 'api' | 'analytics' | 'matrix' | 'contracts' | 'budget'

export type Selection =
  | { kind: 'member'; mode: 'view' | 'new'; item: Member | null }
  | { kind: 'contract'; mode: 'view' | 'new'; item: Contract | null }
  | { kind: 'apikey'; mode: 'view' | 'new'; item: ApiKey | null }
  | { kind: 'aiplan'; mode: 'view'; item: AiPlan }
  | { kind: 'software'; mode: 'view'; item: string }

interface Props {
  view: View
  selection: Selection | null
  onClose: () => void
  onNavigate: (v: View) => void
  onAddMember: () => void
  onAddContract: () => void
  onAddApiKey: () => void
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

function SoftwareDetail({ name }: { name: string }) {
  const { members } = useStore()
  const meta = metaOf(name)
  const c = metaOf(name).category
  const color = ({ 'CAD/3D': '#2563eb', AI: '#7c3aed', クリエイティブ: '#db2777', その他: '#64748b' } as Record<string, string>)[c] ?? '#64748b'
  const users = members.filter((m) => m.licenses.includes(name))
  const monthly = users.length * meta.monthlyCost
  return (
    <div className="rb-detail">
      <div className="drawer-head">
        <div className="sw-icon" style={{ background: color, width: 38, height: 38 }}>{name.slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{meta.vendor} · {meta.category}</div>
        </div>
      </div>
      <div className="drawer-body">
        <div className="rb-stat-row"><span className="l">利用者数</span><span className="v">{users.length} 名</span></div>
        <div className="rb-stat-row"><span className="l">1ライセンス月額</span><span className="v">{yen(meta.monthlyCost)}</span></div>
        <div className="rb-stat-row"><span className="l">月額（概算）</span><span className="v">{yen(monthly)}</span></div>
        <div className="rb-stat-row"><span className="l">年額（概算）</span><span className="v">{yen(monthly * 12)}</span></div>
        {meta.url && (
          <a className="sw-link" href={meta.url} target="_blank" rel="noopener noreferrer" style={{ color, display: 'inline-block', marginTop: 12 }}>
            🔗 管理画面で状況を確認
          </a>
        )}
        <div className="subhead" style={{ marginTop: 14 }}>利用者（{users.length}）</div>
        {users.length === 0 ? (
          <div className="rb-empty">このソフトの利用者はいません</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {users.map((m) => (
              <div key={m.id} className="person-cell" style={{ background: 'var(--surface-2)', padding: '4px 10px 4px 4px', borderRadius: 999 }}>
                <div className="avatar" style={{ background: avatarColor(m.name), width: 22, height: 22, fontSize: 10 }}>{initials(m.name)}</div>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{m.name}</span>
              </div>
            ))}
          </div>
        )}
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

export default function RightPanel({ view, selection, onClose, onNavigate, onAddMember, onAddContract, onAddApiKey }: Props) {
  const { members, software, contracts, apiKeys, budgets } = useStore()
  // 右サイドバーのアラートは既定で閉じておく
  const [alertsOpen, setAlertsOpen] = useState(false)

  // ---- 実利用者数（突合） ----
  const actualUsers = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of members) for (const l of p.licenses) m.set(l, (m.get(l) ?? 0) + 1)
    return m
  }, [members])

  // ---- 全社アラート ----
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
    // ページ関連のアラートを上位へ
    const order = (a: Alert) => (a.target === view ? 0 : 1)
    return list.sort((a, b) => order(a) - order(b))
  }, [contracts, apiKeys, actualUsers, view])

  // ---- ページ別クイック統計 ----
  const stats = useMemo<{ l: string; v: string }[]>(() => {
    const depts = new Set(members.map((m) => m.department).filter(Boolean))
    const noLic = members.filter((m) => m.licenses.length === 0).length
    const totalLic = members.reduce((s, m) => s + m.licenses.length, 0)
    const swMonthly = software.reduce((s, sw) => s + (actualUsers.get(sw) ?? 0) * metaOf(sw).monthlyCost, 0)
    const aiSeats = SEED_AI_PLANS.reduce((s, p) => s + p.seats, 0)
    const aiMonthly = SEED_AI_PLANS.reduce((s, p) => s + p.estMonthlyJpy, 0)
    const cAnnual = contracts.reduce((s, c) => s + c.seats * c.unitAnnualCost, 0)
    const apiUsage = apiKeys.reduce((s, k) => s + k.monthlyUsage, 0)
    const apiBudget = apiKeys.reduce((s, k) => s + k.monthlyBudget, 0)
    switch (view) {
      case 'members':
        return [{ l: '登録メンバー', v: `${members.length} 名` }, { l: '部署数', v: `${depts.size}` }, { l: 'ライセンス付与', v: `${totalLic} 件` }, { l: '未付与メンバー', v: `${noLic} 名` }]
      case 'software':
        return [{ l: '管理ソフト', v: `${software.length} 種` }, { l: '付与合計', v: `${[...actualUsers.values()].reduce((a, b) => a + b, 0)} 件` }, { l: '月額概算', v: yen(swMonthly) }]
      case 'aitools':
        return [{ l: 'AIツール', v: `${new Set(SEED_AI_PLANS.map((p) => p.model)).size} 種` }, { l: '契約本数', v: `${aiSeats} 本` }, { l: '月額概算', v: yen(aiMonthly) }]
      case 'api':
        return [{ l: 'APIキー', v: `${apiKeys.length} 件` }, { l: '今月利用額', v: yen(apiUsage) }, { l: '予算消化率', v: `${apiBudget ? ((apiUsage / apiBudget) * 100).toFixed(0) : 0}%` }]
      case 'contracts':
        return [{ l: '契約数', v: `${contracts.length} 件` }, { l: '契約本数', v: `${contracts.reduce((s, c) => s + c.seats, 0)} 本` }, { l: '年額概算', v: yen(cAnnual) }]
      case 'budget': {
        const spend = computeSpend(contracts, SEED_AI_PLANS, apiKeys)
        const latestYear = Math.max(...spend.map((s) => s.year), ...budgets.map((b) => b.year))
        const yBudget = budgets.filter((b) => b.year === latestYear).reduce((s, b) => s + b.amount, 0)
        const yActual = spend.filter((s) => s.year === latestYear).reduce((s, x) => s + x.amount, 0)
        return [
          { l: `${latestYear}年 予算`, v: yen(yBudget) },
          { l: `${latestYear}年 実績`, v: yen(yActual) },
          { l: '消化率', v: `${yBudget ? ((yActual / yBudget) * 100).toFixed(0) : 0}%` },
          { l: '予算残', v: yen(yBudget - yActual) },
        ]
      }
      case 'analytics':
      case 'matrix':
        return [{ l: 'メンバー', v: `${members.length} 名` }, { l: 'ツール', v: `${software.length} 種` }, { l: '付与合計', v: `${totalLic} 件` }]
      default:
        return [{ l: 'メンバー', v: `${members.length} 名` }, { l: 'ソフト', v: `${software.length} 種` }, { l: 'AI契約本数', v: `${aiSeats} 本` }, { l: 'API今月', v: yen(apiUsage) }]
    }
  }, [view, members, software, contracts, apiKeys, actualUsers, budgets])

  // ---- ページ別クイックアクション ----
  function exportCurrent() {
    if (view === 'contracts') {
      downloadCsv('contracts.csv', ['ソフト', 'エディション', 'ベンダー', '本数', '年額', '開始', '終了'],
        contracts.map((c) => [c.software, c.edition, c.vendor, c.seats, c.seats * c.unitAnnualCost, c.startDate, c.endDate]))
    } else if (view === 'api') {
      downloadCsv('apikeys.csv', ['サービス', '用途', '環境', '管理者', '今月利用', '月予算', '状態'],
        apiKeys.map((k) => [k.service, k.label, k.env, k.owner.split('@')[0], k.monthlyUsage, k.monthlyBudget, k.status]))
    } else if (view === 'aitools') {
      downloadCsv('ai_plans.csv', ['モデル', 'プラン', '本数', '配布人数', '月額概算', '更新日'],
        SEED_AI_PLANS.map((p) => [p.model, p.plan, p.seats, p.members.length, p.estMonthlyJpy, p.renewalDate]))
    } else {
      downloadCsv('members.csv', ['名前', '部署', '課', 'ライセンス'],
        members.map((m) => [m.name, m.department, m.section, m.licenses.join(' / ')]))
    }
  }

  // ===== 詳細モード（クリックした項目を右サイドバー内に表示）=====
  if (selection) {
    const backLabel = selection.kind === 'member' ? 'メンバー一覧'
      : selection.kind === 'contract' ? '契約一覧'
      : selection.kind === 'apikey' ? 'APIキー一覧'
      : selection.kind === 'software' ? 'ソフトウェア一覧' : 'AIツール一覧'
    return (
      <aside className="rightbar detail">
        <button className="rb-back" onClick={onClose}>← {backLabel}に戻る</button>
        {selection.kind === 'member' && <MemberDrawer inline member={selection.item} mode={selection.mode} onClose={onClose} />}
        {selection.kind === 'contract' && <ContractDrawer inline contract={selection.item} mode={selection.mode} onClose={onClose} />}
        {selection.kind === 'apikey' && <ApiKeyDrawer inline apiKey={selection.item} mode={selection.mode} onClose={onClose} />}
        {selection.kind === 'aiplan' && <AiPlanDetail p={selection.item} />}
        {selection.kind === 'software' && <SoftwareDetail name={selection.item} />}
      </aside>
    )
  }

  // ===== 概要モード =====
  return (
    <aside className="rightbar">
      {/* アラート（既定は折りたたみ） */}
      <div>
        <button
          className="rb-section-title rb-toggle"
          onClick={() => setAlertsOpen((v) => !v)}
          aria-expanded={alertsOpen}
        >
          <span>🔔 アラート <span className="rb-count">{alerts.length}</span></span>
          <span className={'rb-chevron' + (alertsOpen ? ' open' : '')}>▾</span>
        </button>
        {alertsOpen && (
          alerts.length === 0 ? (
            <div className="rb-empty">対応が必要な項目はありません 🎉</div>
          ) : (
            <>
              {alerts.slice(0, 8).map((a, i) => (
                <div className="rb-alert" key={i} onClick={() => onNavigate(a.target)}>
                  <span className="rb-dot" style={{ background: a.sev }} />
                  <div>
                    <div className="rb-alert-title">{a.title}</div>
                    <div className="rb-alert-sub">{a.sub}</div>
                  </div>
                </div>
              ))}
              {alerts.length > 8 && <div className="rb-empty">ほか {alerts.length - 8} 件</div>}
            </>
          )
        )}
      </div>

      {/* クイック統計 */}
      <div>
        <div className="rb-section-title">📊 このページの概要</div>
        {stats.map((s) => (
          <div className="rb-stat-row" key={s.l}><span className="l">{s.l}</span><span className="v">{s.v}</span></div>
        ))}
      </div>

      {/* クイックアクション（右サイドバー下部に固定） */}
      <div className="rb-actions">
        <div className="rb-section-title">⚡ クイックアクション</div>
        {view === 'members' && <button className="rb-action primary" onClick={onAddMember}><span className="rb-ico">＋</span>メンバーを追加</button>}
        {view === 'contracts' && <button className="rb-action primary" onClick={onAddContract}><span className="rb-ico">＋</span>契約を追加</button>}
        {view === 'api' && <button className="rb-action primary" onClick={onAddApiKey}><span className="rb-ico">＋</span>APIキーを追加</button>}
        <button className="rb-action" onClick={exportCurrent}><span className="rb-ico">⬇</span>このページをCSV出力</button>
        {view !== 'contracts' && <button className="rb-action" onClick={() => onNavigate('contracts')}><span className="rb-ico">📅</span>更新スケジュールを見る</button>}
        {view !== 'members' && <button className="rb-action" onClick={() => onNavigate('members')}><span className="rb-ico">👥</span>メンバー一覧へ</button>}
      </div>
    </aside>
  )
}
