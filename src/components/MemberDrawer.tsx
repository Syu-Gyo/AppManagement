import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { CATEGORY_COLORS, metaOf } from '../data/software'
import { avatarColor, initials, yen } from '../utils'
import type { Member } from '../data/types'
import type { UsageFrequency } from '../data/usage'

type Draft = Omit<Member, 'id'>
const EMPTY: Draft = { name: '', department: '', section: '', email: '', licenses: [] }

// frequency → estimated daily usage (approximation for visualization)
const FREQ_H: Record<UsageFrequency, number> = {
  daily: 5.5, weekly: 1.8, monthly: 0.4, rare: 0.08, never: 0,
}
const FREQ_C: Record<UsageFrequency, number> = {
  daily: 15, weekly: 5, monthly: 1.5, rare: 0.3, never: 0,
}
const PERIOD: Record<string, { factor: number; label: string; unit: string }> = {
  day:   { factor: 1,  label: '1日あたり', unit: '日' },
  week:  { factor: 5,  label: '週あたり',  unit: '週' },
  month: { factor: 21, label: '月あたり',  unit: '月' },
}

function TabBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
      fontWeight: 700, padding: '5px 12px', borderRadius: 8,
      color: active ? '#1c1a18' : '#8a847d',
      background: active ? '#ffffff' : 'transparent',
      boxShadow: active ? '0 1px 3px rgba(30,25,20,.16)' : 'none',
      transition: 'all .15s',
    }}>{label}</button>
  )
}

export default function MemberDrawer({
  member,
  mode,
  onClose,
  inline = false,
  onSelectMember,
}: {
  member: Member | null
  mode: 'view' | 'new'
  onClose: () => void
  inline?: boolean
  onSelectMember?: (m: Member) => void
}) {
  const { software, usage, members, updateMember, addMember, removeMember } = useStore()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [localEdit, setLocalEdit] = useState(false)
  const [metric, setMetric] = useState<'time' | 'count'>('time')
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [thr, setThr] = useState(2) // threshold in per-day units

  useEffect(() => {
    if (mode === 'new') { setDraft(EMPTY); setLocalEdit(false) }
    else if (member) {
      const { id, ...rest } = member
      setDraft(rest)
      setLocalEdit(false)
    }
  }, [member, mode])

  const memberIdx = member ? members.findIndex(m => m.id === member.id) : -1
  const prevMember = memberIdx > 0 ? members[memberIdx - 1] : null
  const nextMember = memberIdx < members.length - 1 ? members[memberIdx + 1] : null

  const memberUsage = useMemo(() => {
    if (!member) return new Map<string, UsageFrequency>()
    const m = new Map<string, UsageFrequency>()
    for (const u of usage) {
      if (u.memberId === member.id) m.set(u.software, u.frequency)
    }
    return m
  }, [usage, member])

  const hasUsage = memberUsage.size > 0

  const pdef = PERIOD[period]

  const chartRows = useMemo(() => {
    if (!member) return []
    return member.licenses.map(sw => {
      const freq = memberUsage.get(sw)
      const meta = metaOf(sw)
      const color = CATEGORY_COLORS[meta.category] ?? '#64748b'
      const factor = pdef.factor
      const decimals = period === 'day' ? 1 : 0
      const hours = freq ? Math.round(FREQ_H[freq] * factor * Math.pow(10, decimals)) / Math.pow(10, decimals) : 0
      const count = freq ? Math.round(FREQ_C[freq] * factor) : 0
      const thrDisp = metric === 'time'
        ? Math.round(thr * factor * Math.pow(10, decimals)) / Math.pow(10, decimals)
        : Math.round(thr * factor)
      const val = metric === 'time' ? hours : count
      const flagged = !!freq && val < thrDisp && thr > 0
      return { sw, color, hours, count, val, flagged, unknown: !freq }
    })
  }, [member, memberUsage, metric, period, thr, pdef])

  const thrDisp = metric === 'time'
    ? Math.round(thr * pdef.factor * (period === 'day' ? 10 : 1)) / (period === 'day' ? 10 : 1)
    : Math.round(thr * pdef.factor)
  const maxVal = Math.max(0.1, thrDisp, ...chartRows.map(r => r.val))
  const flaggedRows = chartRows.filter(r => r.flagged)

  const monthly = draft.licenses.reduce((s, l) => s + metaOf(l).monthlyCost, 0)

  function toggle(sw: string) {
    setDraft(d => ({
      ...d,
      licenses: d.licenses.includes(sw) ? d.licenses.filter(s => s !== sw) : [...d.licenses, sw],
    }))
  }

  function save() {
    if (!draft.name.trim()) return
    if (mode === 'new') addMember(draft)
    else if (member) updateMember(member.id, draft)
    onClose()
  }

  // ── FORM (new or localEdit) ─────────────────────────────────────────────
  const formContent = (
    <>
      <div className="drawer-head">
        <div className="avatar" style={{ background: avatarColor(draft.name || '新'), width: 46, height: 46, fontSize: 18 }}>
          {draft.name ? initials(draft.name) : '＋'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{mode === 'new' ? '新規メンバー追加' : draft.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            {mode === 'new' ? 'ライセンスを割り当てて登録' : `${draft.licenses.length} 件 · 月額 ${yen(monthly)}`}
          </div>
        </div>
        {localEdit
          ? <button className="btn ghost" onClick={() => setLocalEdit(false)} style={{ fontSize: 12, padding: '4px 10px' }}>← キャンセル</button>
          : <button className="btn ghost" onClick={onClose} style={{ fontSize: 18, padding: '4px 8px' }}>✕</button>
        }
      </div>
      <div className="drawer-body">
        <div className="field">
          <label>氏名</label>
          <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="山田 太郎" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>部署</label>
            <input value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value })} placeholder="東日本デザイン部" />
          </div>
          <div className="field">
            <label>課</label>
            <input value={draft.section} onChange={e => setDraft({ ...draft, section: e.target.value })} placeholder="東京第1" />
          </div>
        </div>
        <div className="field">
          <label>メール</label>
          <input value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="example@oliverinc.co.jp" />
        </div>
        <div className="subhead">ライセンス割り当て</div>
        <div className="lic-toggle-grid">
          {software.map(sw => {
            const on = draft.licenses.includes(sw)
            const c = CATEGORY_COLORS[metaOf(sw).category]
            return (
              <button key={sw} className={'lic-toggle' + (on ? ' on' : '')} onClick={() => toggle(sw)} type="button">
                <span className="box" style={on ? { background: c, borderColor: c } : undefined}>{on ? '✓' : ''}</span>
                {sw}
              </button>
            )
          })}
        </div>
      </div>
      <div className="drawer-foot">
        {(mode === 'view' || localEdit) && member ? (
          <button className="btn" style={{ color: 'var(--danger)', borderColor: '#fecdd3' }}
            onClick={() => { removeMember(member.id); onClose() }}>削除</button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={localEdit ? () => setLocalEdit(false) : onClose}>キャンセル</button>
          <button className="btn primary" onClick={save}>{mode === 'new' ? '登録する' : '保存する'}</button>
        </div>
      </div>
    </>
  )

  // ── CHART view (view mode, not localEdit) ──────────────────────────────
  const chartView = member && (
    <>
      {/* Header */}
      <div className="drawer-head" style={{ gap: 8, alignItems: 'flex-start', paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
          <div className="avatar" style={{ background: avatarColor(member.name), width: 40, height: 40, fontSize: 16, flexShrink: 0, marginTop: 2 }}>
            {initials(member.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, background: '#f0eef8', marginBottom: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: '#6d5de6', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#6d5de6', letterSpacing: '.02em' }}>ユーザー</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
              {[member.department, member.section].filter(Boolean).join(' · ')}
              {member.licenses.length > 0 && ` · ${member.licenses.length}ライセンス`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          {/* Prev / Next nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button
              onClick={() => prevMember && onSelectMember?.(prevMember)}
              disabled={!prevMember || !onSelectMember}
              style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: prevMember ? '#3a3631' : '#ccc', fontSize: 15, cursor: prevMember ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >‹</button>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1c1a18', minWidth: 40, textAlign: 'center' }}>
              {memberIdx + 1}<span style={{ color: '#bdb7af', fontWeight: 600 }}> / {members.length}</span>
            </span>
            <button
              onClick={() => nextMember && onSelectMember?.(nextMember)}
              disabled={!nextMember || !onSelectMember}
              style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: nextMember ? '#3a3631' : '#ccc', fontSize: 15, cursor: nextMember ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >›</button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" style={{ fontSize: 11, padding: '3px 9px' }} onClick={() => setLocalEdit(true)}>✏️ 編集</button>
            <button className="btn ghost" onClick={onClose} style={{ fontSize: 14, padding: '3px 7px' }}>✕</button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', padding: '10px 20px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: '#fafaf9' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#aaa49c' }}>指標</span>
          <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: '#f0ede9', borderRadius: 10 }}>
            <TabBtn active={metric === 'time'} label="利用時間" onClick={() => setMetric('time')} />
            <TabBtn active={metric === 'count'} label="利用回数" onClick={() => setMetric('count')} />
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#aaa49c' }}>期間</span>
          <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: '#f0ede9', borderRadius: 10 }}>
            <TabBtn active={period === 'day'} label="日" onClick={() => setPeriod('day')} />
            <TabBtn active={period === 'week'} label="週" onClick={() => setPeriod('week')} />
            <TabBtn active={period === 'month'} label="月" onClick={() => setPeriod('month')} />
          </div>
        </div>
      </div>

      {/* Threshold row */}
      <div style={{ padding: '10px 20px', background: '#fbfaf9', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#d23b3f', whiteSpace: 'nowrap' }}>
            <span style={{ width: 13, borderTop: '2px dashed #e5484d', display: 'inline-block' }} />
            損切ライン
          </span>
          <input
            type="range"
            min={0}
            max={metric === 'count' ? 20 : 8}
            step={metric === 'count' ? 1 : 0.5}
            value={thr}
            onChange={e => setThr(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#e5484d', cursor: 'pointer', minWidth: 70 }}
          />
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1c1a18', whiteSpace: 'nowrap', minWidth: 52, textAlign: 'right' }}>
            {metric === 'count' ? String(thrDisp) : thrDisp.toFixed(period === 'day' ? 1 : 0)}&thinsp;{metric === 'time' ? 'h' : '回'}/{pdef.unit}
          </span>
        </div>
        {flaggedRows.length > 0 ? (
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#8a847d' }}>
            <span style={{ fontWeight: 800, color: '#d23b3f' }}>{flaggedRows.length}ツール</span>が未達
          </div>
        ) : hasUsage ? (
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#3f9a5a' }}>全ツールが基準クリア</div>
        ) : null}
      </div>

      {/* Chart area */}
      <div style={{ padding: '14px 20px 18px', flex: 1 }}>
        {/* No usage data */}
        {!hasUsage && (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)', marginBottom: 4 }}>アンケート未実施</div>
            <div style={{ fontSize: 11.5 }}>CSVを取り込むと利用状況が表示されます</div>
          </div>
        )}

        {/* No licenses */}
        {hasUsage && member.licenses.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>
            ライセンスが割り当てられていません
          </div>
        )}

        {/* Bar chart */}
        {hasUsage && member.licenses.length > 0 && (
          <div style={{ position: 'relative' }}>
            {/* Threshold line overlay */}
            {thr > 0 && (
              <div style={{ position: 'absolute', left: 104, right: 0, top: 0, bottom: 22, pointerEvents: 'none', zIndex: 2 }}>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0,
                  borderLeft: '2px dashed #e5484d',
                  left: `${Math.min((thrDisp / maxVal) * 100, 100)}%`,
                }} />
                <div style={{
                  position: 'absolute', top: -9, transform: 'translateX(-50%)',
                  background: '#e5484d', color: '#fff', fontSize: 9, fontWeight: 700,
                  lineHeight: 1, padding: '2px 5px', borderRadius: 5, whiteSpace: 'nowrap',
                  left: `${Math.min((thrDisp / maxVal) * 100, 100)}%`,
                }}>
                  {metric === 'count' ? String(thrDisp) : thrDisp.toFixed(period === 'day' ? 1 : 0)}{metric === 'time' ? 'h' : '回'}
                </div>
              </div>
            )}

            {/* Rows */}
            {chartRows.map(r => {
              const widthPct = maxVal > 0 ? Math.max(0, (r.val / maxVal) * 100) : 0
              const opacity = r.val > 0 ? (r.flagged ? 0.45 : 1) : 0.2
              const nameColor = r.flagged ? '#d23b3f' : r.unknown ? '#b8b2aa' : '#2c2925'
              const valColor = r.flagged ? '#d23b3f' : r.val > 0 ? '#1c1a18' : '#b8b2aa'
              const decimals = period === 'day' ? 1 : 0
              return (
                <div key={r.sw} style={{ display: 'grid', gridTemplateColumns: '104px 1fr', alignItems: 'center', height: 38 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingRight: 12, minWidth: 0 }}>
                    {r.flagged && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#e5484d', flexShrink: 0 }} />}
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: nameColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.sw}>{r.sw}</span>
                  </div>
                  <div style={{ height: 22, display: 'flex', alignItems: 'center', paddingRight: 4 }}>
                    {r.unknown ? (
                      <span style={{ fontSize: 10.5, color: '#c0bab2', fontWeight: 600, fontStyle: 'italic' }}>未回答</span>
                    ) : (
                      <div style={{ display: 'flex', height: '100%', width: '100%', alignItems: 'center' }}>
                        <div style={{
                          height: '100%', borderRadius: 5, background: r.color,
                          transition: 'width .3s cubic-bezier(.4,0,.2,1)',
                          minWidth: r.val > 0 ? 3 : 0,
                          opacity, width: `${widthPct}%`,
                        }} />
                        <div style={{ whiteSpace: 'nowrap', paddingLeft: 6, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: valColor }}>
                            {metric === 'time' ? r.hours.toFixed(decimals) + 'h' : r.count + '回'}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#b0aaa1' }}>
                            {metric === 'time' ? r.count + '回' : r.hours.toFixed(decimals) + 'h'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* X-axis label */}
            <div style={{ textAlign: 'center', marginTop: 10, paddingLeft: 104 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#6f6a63' }}>
                {metric === 'count' ? `利用回数（回 / ${pdef.unit}）` : `利用時間（時間 / ${pdef.unit}）`}
              </span>
              <span style={{ fontSize: 10, color: '#b0aaa1', marginLeft: 6 }}>※アンケート回答から推算</span>
            </div>
          </div>
        )}
      </div>
    </>
  )

  const showChart = mode === 'view' && member && !localEdit
  const content = showChart ? chartView : formContent

  if (inline) return <div className="rb-detail" style={showChart ? { padding: 0, display: 'flex', flexDirection: 'column' } : undefined}>{content}</div>
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer">{content}</div>
    </>
  )
}
