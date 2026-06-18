import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { CATEGORY_COLORS, metaOf } from '../data/software'
import { avatarColor, initials, yen } from '../utils'
import type { Member } from '../data/types'

type Draft = Omit<Member, 'id'>
const EMPTY: Draft = { name: '', department: '', section: '', email: '', licenses: [] }

export default function MemberDrawer({
  member,
  mode,
  onClose,
  inline = false,
}: {
  member: Member | null
  mode: 'view' | 'new'
  onClose: () => void
  inline?: boolean
}) {
  const { software, updateMember, addMember, removeMember } = useStore()
  const [draft, setDraft] = useState<Draft>(EMPTY)

  useEffect(() => {
    if (mode === 'new') setDraft(EMPTY)
    else if (member) {
      const { id, ...rest } = member
      setDraft(rest)
    }
  }, [member, mode])

  const monthly = draft.licenses.reduce((s, l) => s + metaOf(l).monthlyCost, 0)

  function toggle(sw: string) {
    setDraft((d) => ({
      ...d,
      licenses: d.licenses.includes(sw) ? d.licenses.filter((s) => s !== sw) : [...d.licenses, sw],
    }))
  }

  function save() {
    if (!draft.name.trim()) return
    if (mode === 'new') addMember(draft)
    else if (member) updateMember(member.id, draft)
    onClose()
  }

  const content = (
    <>
        <div className="drawer-head">
          <div className="avatar" style={{ background: avatarColor(draft.name || '新'), width: 46, height: 46, fontSize: 18 }}>
            {draft.name ? initials(draft.name) : '＋'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{mode === 'new' ? '新規メンバー追加' : draft.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {mode === 'new' ? 'ライセンスを割り当てて登録' : `${draft.licenses.length} 件のライセンス · 月額 ${yen(monthly)}`}
            </div>
          </div>
          <button className="btn ghost" onClick={onClose} style={{ fontSize: 18 }}>✕</button>
        </div>

        <div className="drawer-body">
          <div className="field">
            <label>氏名</label>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="山田 太郎" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>部署</label>
              <input value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} placeholder="東日本デザイン部" />
            </div>
            <div className="field">
              <label>課</label>
              <input value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} placeholder="東京第1" />
            </div>
          </div>

          <div className="subhead">ライセンス割り当て</div>
          <div className="lic-toggle-grid">
            {software.map((sw) => {
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
          {mode === 'view' && member ? (
            <button className="btn" style={{ color: 'var(--danger)', borderColor: '#fecdd3' }}
              onClick={() => { removeMember(member.id); onClose() }}>削除</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={onClose}>キャンセル</button>
            <button className="btn primary" onClick={save}>{mode === 'new' ? '登録する' : '保存する'}</button>
          </div>
        </div>
    </>
  )

  if (inline) return <div className="rb-detail">{content}</div>
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer">{content}</div>
    </>
  )
}
