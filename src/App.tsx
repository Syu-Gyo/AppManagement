import { useState } from 'react'
import Dashboard from './components/Dashboard'
import Members from './components/Members'
import Software from './components/Software'
import AITools from './components/AITools'
import ApiKeys from './components/ApiKeys'
import Matrix from './components/Matrix'
import Analytics from './components/Analytics'
import Contracts from './components/Contracts'
import BudgetView from './components/BudgetView'
import RightPanel, { type Selection } from './components/RightPanel'
import { useStore } from './store'

type View = 'dashboard' | 'members' | 'software' | 'aitools' | 'api' | 'analytics' | 'matrix' | 'contracts' | 'budget'

const NAV: { key: View; icon: string; label: string }[] = [
  { key: 'dashboard', icon: '📊', label: 'ダッシュボード' },
  { key: 'members', icon: '👥', label: 'メンバー' },
  { key: 'software', icon: '📦', label: 'ソフトウェア' },
  { key: 'aitools', icon: '🤖', label: 'AIツール' },
  { key: 'api', icon: '🔑', label: 'API' },
  { key: 'analytics', icon: '📈', label: '利用分析' },
  { key: 'matrix', icon: '🔲', label: 'ライセンス表' },
  { key: 'contracts', icon: '📅', label: '契約スケジュール' },
  { key: 'budget', icon: '💰', label: '予算管理' },
]

const TITLES: Record<View, { h: string; sub: string }> = {
  dashboard: { h: 'ダッシュボード', sub: '全社のソフトウェア利用状況をひと目で把握' },
  members: { h: 'メンバー管理', sub: '社員ごとのライセンス保有状況を一覧・編集' },
  software: { h: 'ソフトウェア一覧', sub: 'アプリごとの利用者数とコストを確認' },
  aitools: { h: 'AIツール', sub: 'AI配布プランの契約本数・配布先・コスト・更新時期を管理' },
  api: { h: 'API 管理', sub: 'APIキーの利用量・予算・状態を管理' },
  analytics: { h: '利用分析', sub: 'ツール別の使用率と、ユーザーごとの利用／未利用をグラフで可視化' },
  matrix: { h: 'ライセンス割り当て表', sub: 'メンバー × ソフトのマトリクスをその場で編集' },
  contracts: { h: '契約スケジュール', sub: '契約の更新時期・本数・コストを管理し、実利用者と突合' },
  budget: { h: '予算管理', sub: '購入年度ごとの予算と支払い実績を、カテゴリ別に把握' },
}

export default function App() {
  const { resetDemo } = useStore()
  const [view, setView] = useState<View>('dashboard')
  // 右サイドバーに表示する選択中の項目（null = 概要モード）
  const [sel, setSel] = useState<Selection | null>(null)
  // 左サイドバー / 右パネルの開閉
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)

  // ページ遷移時は詳細表示を閉じる
  const go = (v: View) => { setView(v); setSel(null) }

  // 詳細を開いたら右パネルは自動で開く
  const openSel = (s: Selection) => { setSel(s); setRightOpen(true) }

  // マウントする列に合わせてグリッド幅を組み立てる
  const cols = [leftOpen && '248px', '1fr', rightOpen && '360px'].filter(Boolean).join(' ')

  return (
    <div className="app">
      {/* 全ページ共通ヘッダー */}
      <header className="app-header">
        <button
          className={'hdr-toggle' + (leftOpen ? ' active' : '')}
          onClick={() => setLeftOpen((v) => !v)}
          title={leftOpen ? '左メニューを閉じる' : '左メニューを開く'}
          aria-label="左メニューの開閉"
        >☰</button>
        <div className="hdr-brand">
          <div className="brand-logo">A</div>
          <span className="hdr-brand-name">AppManagement</span>
        </div>
        <div className="hdr-divider" />
        <div className="hdr-title">
          <h1>{TITLES[view].h}</h1>
          <div className="sub">{TITLES[view].sub}</div>
        </div>
        <div className="hdr-actions">
          {(view === 'members' || view === 'dashboard') && (
            <button className="btn primary" onClick={() => openSel({ kind: 'member', mode: 'new', item: null })}>
              ＋ メンバーを追加
            </button>
          )}
          {view === 'contracts' && (
            <button className="btn primary" onClick={() => openSel({ kind: 'contract', mode: 'new', item: null })}>
              ＋ 契約を追加
            </button>
          )}
          {view === 'api' && (
            <button className="btn primary" onClick={() => openSel({ kind: 'apikey', mode: 'new', item: null })}>
              ＋ APIキーを追加
            </button>
          )}
          <button
            className={'hdr-toggle' + (rightOpen ? ' active' : '')}
            onClick={() => setRightOpen((v) => !v)}
            title={rightOpen ? '右パネルを閉じる' : '右パネルを開く'}
            aria-label="右パネルの開閉"
          >▦</button>
        </div>
      </header>

      <div className="app-body" style={{ gridTemplateColumns: cols }}>
        {leftOpen && (
          <aside className="sidebar">
            <div className="nav-section">メニュー</div>
            {NAV.map((n) => (
              <button
                key={n.key}
                className={'nav-item' + (view === n.key ? ' active' : '')}
                onClick={() => go(n.key)}
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
        )}

        <main className="main">
          <div className="content">
            {view === 'dashboard' && <Dashboard />}
            {view === 'members' && <Members onOpen={(m) => openSel({ kind: 'member', mode: 'view', item: m })} />}
            {view === 'software' && <Software onOpen={(sw) => openSel({ kind: 'software', mode: 'view', item: sw })} />}
            {view === 'aitools' && <AITools onOpen={(p) => openSel({ kind: 'aiplan', mode: 'view', item: p })} />}
            {view === 'api' && <ApiKeys onOpen={(k) => openSel({ kind: 'apikey', mode: 'view', item: k })} />}
            {view === 'analytics' && <Analytics />}
            {view === 'matrix' && <Matrix />}
            {view === 'contracts' && <Contracts onOpen={(c) => openSel({ kind: 'contract', mode: 'view', item: c })} />}
            {view === 'budget' && <BudgetView />}
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
          />
        )}
      </div>
    </div>
  )
}
