import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { CONTRACT_VENDORS, type Contract } from '../data/contracts'
import { yen } from '../utils'

type Draft = Omit<Contract, 'id'>
const EMPTY: Draft = {
  software: '', edition: '', vendor: 'その他', licenseKey: null, seats: 1,
  unitAnnualCost: 0, startDate: '2026-01-01', endDate: '2026-12-31', autoRenew: true, note: '',
}

export default function ContractDrawer({
  contract,
  mode,
  onClose,
}: {
  contract: Contract | null
  mode: 'view' | 'new'
  onClose: () => void
}) {
  const { software, updateContract, addContract, removeContract } = useStore()
  const [draft, setDraft] = useState<Draft>(EMPTY)

  useEffect(() => {
    if (mode === 'new') setDraft(EMPTY)
    else if (contract) {
      const { id, ...rest } = contract
      setDraft(rest)
    }
  }, [contract, mode])

  const annual = draft.seats * draft.unitAnnualCost

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }))
  }

  function save() {
    if (!draft.software.trim()) return
    if (mode === 'new') addContract(draft)
    else if (contract) updateContract(contract.id, draft)
    onClose()
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div className="sw-icon" style={{ background: '#3b5bfd', width: 46, height: 46 }}>
            {(draft.software || '契').slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{mode === 'new' ? '新規契約を追加' : draft.software}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {draft.seats} 本 · 年額 {yen(annual)}
            </div>
          </div>
          <button className="btn ghost" onClick={onClose} style={{ fontSize: 18 }}>✕</button>
        </div>

        <div className="drawer-body">
          <div className="field">
            <label>ソフト名</label>
            <input value={draft.software} onChange={(e) => set('software', e.target.value)} placeholder="Autocad" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>エディション / 補足</label>
              <input value={draft.edition} onChange={(e) => set('edition', e.target.value)} placeholder="正規版" />
            </div>
            <div className="field">
              <label>ベンダー</label>
              <select value={draft.vendor} onChange={(e) => set('vendor', e.target.value)}>
                {CONTRACT_VENDORS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>契約本数（席数）</label>
              <input type="number" min={0} value={draft.seats}
                onChange={(e) => set('seats', Number(e.target.value))} />
            </div>
            <div className="field">
              <label>1本あたり年額（円）</label>
              <input type="number" min={0} step={1000} value={draft.unitAnnualCost}
                onChange={(e) => set('unitAnnualCost', Number(e.target.value))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>契約開始日</label>
              <input type="date" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="field">
              <label>契約終了 / 更新日</label>
              <input type="date" value={draft.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>利用者突合キー（社員別ライセンスと連携）</label>
            <select value={draft.licenseKey ?? ''} onChange={(e) => set('licenseKey', e.target.value || null)}>
              <option value="">連携しない</option>
              {software.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <label className="lic-toggle" style={{ width: 'fit-content', cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.autoRenew} onChange={(e) => set('autoRenew', e.target.checked)} />
            自動更新
          </label>

          <div className="field" style={{ marginTop: 16 }}>
            <label>メモ</label>
            <input value={draft.note} onChange={(e) => set('note', e.target.value)} placeholder="更新時に本数見直し 等" />
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 9, fontSize: 13 }}>
            年額合計（{draft.seats}本 × {yen(draft.unitAnnualCost)}）= <b>{yen(annual)}</b>
            <span className="muted"> / 月額換算 {yen(Math.round(annual / 12))}</span>
          </div>
        </div>

        <div className="drawer-foot">
          {mode === 'view' && contract ? (
            <button className="btn" style={{ color: 'var(--danger)', borderColor: '#fecdd3' }}
              onClick={() => { removeContract(contract.id); onClose() }}>削除</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={onClose}>キャンセル</button>
            <button className="btn primary" onClick={save}>{mode === 'new' ? '追加する' : '保存する'}</button>
          </div>
        </div>
      </div>
    </>
  )
}
