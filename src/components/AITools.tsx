import { useMemo, useState } from 'react'
import { SEED_AI_PLANS, type AiPlan } from '../data/aiplans'
import { avatarColor, initials, yen } from '../utils'

const TODAY = new Date('2026-06-16T00:00:00')

// モデルごとの色
const MODEL_COLORS: Record<string, string> = {
  Midjourney: '#7c3aed', chatGPT: '#10a37f', KreaAI: '#db2777',
  Genspark: '#2563eb', Tripo: '#0891b2', Adobeexpress: '#e11d48', 'Google AI': '#f59e0b',
}
const colorOf = (m: string) => MODEL_COLORS[m] ?? '#64748b'

function renewBadge(renewalDate: string) {
  if (!renewalDate) return null
  const d = new Date(renewalDate + 'T00:00:00')
  const days = Math.floor((d.getTime() - TODAY.getTime()) / 86400000)
  if (days >= 0 && days <= 60) return <span className="tag" style={{ background: '#fffbeb', color: '#b45309', borderColor: '#fde68a' }}>更新間近 あと{days}日</span>
  if (days < 0) return <span className="tag" style={{ background: '#f8fafc', color: '#94a3b8' }}>更新日 経過</span>
  return <span className="tag" style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>契約中</span>
}

export default function AITools() {
  const plans = SEED_AI_PLANS
  const [sel, setSel] = useState<AiPlan | null>(null)

  const stats = useMemo(() => {
    const models = new Set(plans.map((p) => p.model))
    const seats = plans.reduce((s, p) => s + p.seats, 0)
    const members = new Set<string>()
    plans.forEach((p) => p.members.forEach((m) => members.add(m)))
    const monthly = plans.reduce((s, p) => s + p.estMonthlyJpy, 0)
    const soon = plans.filter((p) => {
      if (!p.renewalDate) return false
      const days = Math.floor((new Date(p.renewalDate + 'T00:00:00').getTime() - TODAY.getTime()) / 86400000)
      return days >= 0 && days <= 60
    }).length
    return { modelCount: models.size, seats, memberCount: members.size, monthly, soon }
  }, [plans])

  return (
    <div>
      <div className="kpi-grid">
        <div className="card kpi">
          <div className="label">🤖 AIツール</div>
          <div className="value">{stats.modelCount}<span className="unit">種</span></div>
          <div className="foot">{plans.length} プラン契約中</div>
        </div>
        <div className="card kpi">
          <div className="label">🔑 契約本数 合計</div>
          <div className="value">{stats.seats}<span className="unit">本</span></div>
          <div className="foot">配布人数（実数）{stats.memberCount} 名</div>
        </div>
        <div className="card kpi">
          <div className="label">💴 月額コスト（概算）</div>
          <div className="value" style={{ fontSize: 24 }}>{yen(stats.monthly)}</div>
          <div className="foot">年間 約 {yen(stats.monthly * 12)}</div>
        </div>
        <div className="card kpi" style={{ borderColor: stats.soon ? '#fed7aa' : undefined }}>
          <div className="label">⏰ 更新間近（60日以内）</div>
          <div className="value" style={{ color: stats.soon ? '#f59e0b' : undefined }}>{stats.soon}<span className="unit">件</span></div>
          <div className="foot">更新可否の判断が必要</div>
        </div>
      </div>

      <div className="sw-grid">
        {plans.map((p) => {
          const c = colorOf(p.model)
          const over = p.members.length > p.seats
          return (
            <div className="card sw-card" key={p.id} style={{ cursor: 'pointer', borderColor: sel?.id === p.id ? c : undefined }}
              onClick={() => setSel(sel?.id === p.id ? null : p)}>
              <div className="sw-head">
                <div className="sw-icon" style={{ background: c }}>{p.model.slice(0, 1).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div className="sw-name">{p.model}</div>
                  <div className="sw-vendor">プラン: {p.plan} · {p.billing}</div>
                </div>
                {renewBadge(p.renewalDate)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5 }}>
                <div><span className="muted">契約本数</span><div style={{ fontWeight: 700, fontSize: 16 }}>{p.seats} 本</div></div>
                <div><span className="muted">配布人数</span>
                  <div style={{ fontWeight: 700, fontSize: 16, color: over ? '#e11d48' : undefined }}>
                    {p.members.length} 名{over ? ' ⚠' : ''}
                  </div>
                </div>
                <div><span className="muted">金額</span><div>{p.amountText || '—'}</div></div>
                <div><span className="muted">月額概算</span><div>{yen(p.estMonthlyJpy)}</div></div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: 12 }}>
                <div className="muted">契約日: {p.contractText || '—'}</div>
                <div className="muted">更新日: {p.renewalText || '—'}（期間 {p.termText}）</div>
                {p.admins.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <span className="muted">管理者: </span>
                    {p.admins.map((a) => (
                      <span key={a} className="tag" style={{ marginRight: 4, background: c + '14', color: c, borderColor: c + '33' }}>★ {a}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {sel && (
        <div className="card" style={{ padding: 20, marginTop: 20 }}>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              👥 {sel.model}（{sel.plan}）の配布メンバー
            </h2>
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-muted)' }}>
              {sel.members.length} 名 / 契約 {sel.seats} 本
            </span>
            <button className="btn ghost" onClick={() => setSel(null)}>閉じる</button>
          </div>
          {sel.members.length === 0 ? (
            <div className="empty">この資料には個別の配布先リストがありません（{sel.seats}本契約）</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sel.members.map((m) => {
                const admin = sel.admins.includes(m)
                return (
                  <div key={m} className="person-cell" style={{ background: 'var(--surface-2)', padding: '6px 12px 6px 6px', borderRadius: 999 }}>
                    <div className="avatar" style={{ background: avatarColor(m), width: 26, height: 26, fontSize: 11 }}>{initials(m)}</div>
                    <span style={{ fontSize: 12.5, fontWeight: admin ? 700 : 500 }}>{m}{admin ? ' ★' : ''}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
