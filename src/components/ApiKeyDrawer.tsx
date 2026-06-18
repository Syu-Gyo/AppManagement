import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { API_ENVS, type ApiKey } from '../data/apikeys'
import { yen } from '../utils'

type Draft = Omit<ApiKey, 'id'>
const EMPTY: Draft = {
  service: '', label: '', keyMasked: 'sk-••••••', owner: '', env: '開発',
  status: '有効', monthlyUsage: 0, monthlyBudget: 10000, lastUsed: '2026-06-16',
  consoleUrl: '',
}

export default function ApiKeyDrawer({
  apiKey,
  mode,
  onClose,
  inline = false,
}: {
  apiKey: ApiKey | null
  mode: 'view' | 'new'
  onClose: () => void
  inline?: boolean
}) {
  const { updateApiKey, addApiKey, removeApiKey } = useStore()
  const [draft, setDraft] = useState<Draft>(EMPTY)

  useEffect(() => {
    if (mode === 'new') setDraft(EMPTY)
    else if (apiKey) {
      const { id, ...rest } = apiKey
      setDraft(rest)
    }
  }, [apiKey, mode])

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }))
  }

  function save() {
    if (!draft.service.trim()) return
    if (mode === 'new') addApiKey(draft)
    else if (apiKey) updateApiKey(apiKey.id, draft)
    onClose()
  }

  const content = (
    <>
        <div className="drawer-head">
          <div className="sw-icon" style={{ background: '#0891b2', width: 46, height: 46 }}>🔑</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{mode === 'new' ? '新規APIキーを追加' : draft.service}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{draft.label || 'APIキー管理'}</div>
          </div>
          <button className="btn ghost" onClick={onClose} style={{ fontSize: 18 }}>✕</button>
        </div>

        <div className="drawer-body">
          <div className="field">
            <label>サービス名</label>
            <input value={draft.service} onChange={(e) => set('service', e.target.value)} placeholder="OpenAI API" />
          </div>
          <div className="field">
            <label>用途 / プロジェクト名</label>
            <input value={draft.label} onChange={(e) => set('label', e.target.value)} placeholder="社内チャットボット" />
          </div>
          <div className="field">
            <label>APIキー（マスク表記）</label>
            <input value={draft.keyMasked} onChange={(e) => set('keyMasked', e.target.value)} placeholder="sk-••••••" />
          </div>
          <div className="field">
            <label>管理コンソールURL（利用状況の確認先）</label>
            <input value={draft.consoleUrl ?? ''} onChange={(e) => set('consoleUrl', e.target.value)} placeholder="https://platform.openai.com/usage" />
            {draft.consoleUrl && (
              <a className="sw-link" href={draft.consoleUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 4 }}>
                🔗 コンソールを開く
              </a>
            )}
          </div>
          <div className="field">
            <label>管理者</label>
            <input value={draft.owner.split('@')[0]} onChange={(e) => set('owner', e.target.value)} placeholder="担当者名" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>環境</label>
              <select value={draft.env} onChange={(e) => set('env', e.target.value as ApiKey['env'])}>
                {API_ENVS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label>状態</label>
              <select value={draft.status} onChange={(e) => set('status', e.target.value as ApiKey['status'])}>
                <option value="有効">有効</option>
                <option value="無効">無効</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>今月の利用額（円）</label>
              <input type="number" min={0} step={1000} value={draft.monthlyUsage}
                onChange={(e) => set('monthlyUsage', Number(e.target.value))} />
            </div>
            <div className="field">
              <label>月予算（円）</label>
              <input type="number" min={0} step={1000} value={draft.monthlyBudget}
                onChange={(e) => set('monthlyBudget', Number(e.target.value))} />
            </div>
          </div>

          <div className="field">
            <label>最終利用日</label>
            <input type="date" value={draft.lastUsed} onChange={(e) => set('lastUsed', e.target.value)} />
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 9, fontSize: 13 }}>
            予算消化率 <b>{draft.monthlyBudget ? ((draft.monthlyUsage / draft.monthlyBudget) * 100).toFixed(0) : 0}%</b>
            <span className="muted"> （{yen(draft.monthlyUsage)} / {yen(draft.monthlyBudget)}）</span>
          </div>
        </div>

        <div className="drawer-foot">
          {mode === 'view' && apiKey ? (
            <button className="btn" style={{ color: 'var(--danger)', borderColor: '#fecdd3' }}
              onClick={() => { removeApiKey(apiKey.id); onClose() }}>削除</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={onClose}>キャンセル</button>
            <button className="btn primary" onClick={save}>{mode === 'new' ? '追加する' : '保存する'}</button>
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
