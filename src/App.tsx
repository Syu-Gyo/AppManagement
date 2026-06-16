import { useState } from 'react'
import Dashboard from './components/Dashboard'
import Members from './components/Members'
import Software from './components/Software'
import Matrix from './components/Matrix'
import MemberDrawer from './components/MemberDrawer'
import { useStore } from './store'
import type { Member } from './data/types'

type View = 'dashboard' | 'members' | 'software' | 'matrix'

const NAV: { key: View; icon: string; label: string }[] = [
  { key: 'dashboard', icon: '📊', label: 'ダッシュボード' },
  { key: 'members', icon: '👥', label: 'メンバー' },
  { key: 'software', icon: '📦', label: 'ソフトウェア' },
  { key: 'matrix', icon: '🔲', label: 'ライセンス表' },
]

const TITLES: Record<View, { h: string; sub: string }> = {
  dashboard: { h: 'ダッシュボード', sub: '全社のソフトウェア利用状況をひと目で把握' },
  members: { h: 'メンバー管理', sub: '社員ごとのライセンス保有状況を一覧・編集' },
  software: { h: 'ソフトウェア一覧', sub: 'アプリごとの利用者数とコストを確認' },
  matrix: { h: 'ライセンス割り当て表', sub: 'メンバー × ソフトのマトリクスをその場で編集' },
}

export default function App() {
  const { resetDemo } = useStore()
  const [view, setView] = useState<View>('dashboard')
  const [drawer, setDrawer] = useState<{ mode: 'view' | 'new'; member: Member | null } | null>(null)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">A</div>
          <div>
            <div className="brand-name">AppManagement</div>
            <div className="brand-sub">ライセンス管理システム</div>
          </div>
        </div>
        <div className="nav-section">メニュー</div>
        {NAV.map((n) => (
          <button
            key={n.key}
            className={'nav-item' + (view === n.key ? ' active' : '')}
            onClick={() => setView(n.key)}
          >
            <span className="ico">{n.icon}</span>
            {n.label}
          </button>
        ))}
        <div className="sidebar-foot">
          デモ版 v0.1 · データはブラウザに保存されます
          <button className="nav-item" style={{ marginTop: 8, fontSize: 12 }}
            onClick={() => { if (confirm('デモデータを初期状態に戻しますか？')) resetDemo() }}>
            <span className="ico">↺</span>デモデータをリセット
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>{TITLES[view].h}</h1>
            <div className="sub">{TITLES[view].sub}</div>
          </div>
          {(view === 'members' || view === 'dashboard') && (
            <button className="btn primary" onClick={() => setDrawer({ mode: 'new', member: null })}>
              ＋ メンバーを追加
            </button>
          )}
        </div>
        <div className="content">
          {view === 'dashboard' && <Dashboard />}
          {view === 'members' && <Members onOpen={(m) => setDrawer({ mode: 'view', member: m })} />}
          {view === 'software' && <Software />}
          {view === 'matrix' && <Matrix />}
        </div>
      </main>

      {drawer && (
        <MemberDrawer member={drawer.member} mode={drawer.mode} onClose={() => setDrawer(null)} />
      )}
    </div>
  )
}
