import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { SEED_AI_PLANS } from '../data/aiplans'
import {
  BUDGET_CATEGORIES, BUDGET_CATEGORY_COLORS, computeSpend,
  type BudgetCategory, type SpendItem,
} from '../data/budgets'
import { yen } from '../utils'

const SOURCE_COLORS: Record<SpendItem['source'], string> = {
  ソフト契約: '#2563eb',
  AIツール: '#7c3aed',
  API: '#0891b2',
}

export default function BudgetView() {
  const { contracts, apiKeys, budgets, setBudget } = useStore()

  // 購入年度ごとの支払い実績
  const spend = useMemo(
    () => computeSpend(contracts, SEED_AI_PLANS, apiKeys),
    [contracts, apiKeys],
  )

  // 表示対象の年度（予算・実績どちらかに存在する年）を新しい順に
  const years = useMemo(() => {
    const set = new Set<number>()
    for (const b of budgets) set.add(b.year)
    for (const s of spend) set.add(s.year)
    return [...set].sort((a, b) => b - a)
  }, [budgets, spend])

  const [year, setYear] = useState<number>(() => {
    const withSpend = [...new Set(spend.map((s) => s.year))].sort((a, b) => b - a)
    return withSpend[0] ?? new Date('2026-06-16').getFullYear()
  })

  // 選択年度のカテゴリ別 予算 / 実績
  const rows = useMemo(() => {
    return BUDGET_CATEGORIES.map((cat) => {
      const budget = budgets.find((b) => b.year === year && b.category === cat)?.amount ?? 0
      const actual = spend
        .filter((s) => s.year === year && s.category === cat)
        .reduce((sum, s) => sum + s.amount, 0)
      return { cat, budget, actual, diff: budget - actual }
    })
  }, [budgets, spend, year])

  const totals = useMemo(() => {
    const budget = rows.reduce((s, r) => s + r.budget, 0)
    const actual = rows.reduce((s, r) => s + r.actual, 0)
    return { budget, actual, diff: budget - actual, rate: budget ? actual / budget : 0 }
  }, [rows])

  const items = useMemo(
    () => spend.filter((s) => s.year === year).sort((a, b) => b.amount - a.amount),
    [spend, year],
  )

  // 全年度サマリー（年度ごとの予算 vs 実績）
  const yearSummary = useMemo(() => {
    return years.map((y) => {
      const budget = budgets.filter((b) => b.year === y).reduce((s, b) => s + b.amount, 0)
      const actual = spend.filter((s) => s.year === y).reduce((s, x) => s + x.amount, 0)
      return { y, budget, actual }
    })
  }, [years, budgets, spend])
  const maxSummary = Math.max(1, ...yearSummary.flatMap((s) => [s.budget, s.actual]))

  return (
    <div>
      {/* 年度タブ（このページ全体の対象年度） */}
      <div className="budget-yearbar">
        <span className="budget-yearbar-label">対象年度</span>
        <div className="seg-tabs" style={{ marginBottom: 0 }}>
          {years.map((y) => (
            <button key={y} className={'seg' + (y === year ? ' active' : '')} onClick={() => setYear(y)}>
              {y}年
            </button>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-grid">
        <div className="card kpi">
          <div className="label">💴 {year}年 予算合計</div>
          <div className="value" style={{ fontSize: 26 }}>{yen(totals.budget)}</div>
          <div className="foot">年度×カテゴリの合算</div>
        </div>
        <div className="card kpi">
          <div className="label">💸 支払い実績（年額）</div>
          <div className="value" style={{ fontSize: 26 }}>{yen(totals.actual)}</div>
          <div className="foot">契約・AI・API を購入年度で集計</div>
        </div>
        <div className="card kpi" style={{ borderColor: totals.diff < 0 ? '#fecdd3' : undefined }}>
          <div className="label">{totals.diff < 0 ? '🚨 予算超過' : '✅ 予算残'}</div>
          <div className="value" style={{ fontSize: 26, color: totals.diff < 0 ? '#e11d48' : '#16a34a' }}>
            {totals.diff < 0 ? '-' : ''}{yen(Math.abs(totals.diff))}
          </div>
          <div className="foot">予算 − 実績</div>
        </div>
        <div className="card kpi" style={{ borderColor: totals.rate > 1 ? '#fecdd3' : undefined }}>
          <div className="label">📊 予算消化率</div>
          <div className="value" style={{ color: totals.rate > 1 ? '#e11d48' : totals.rate > 0.9 ? '#f59e0b' : undefined }}>
            {(totals.rate * 100).toFixed(0)}<span className="unit">%</span>
          </div>
          <div className="foot">実績 ÷ 予算</div>
        </div>
      </div>

      {/* 年度別サマリー（全年度の予算 vs 実績） */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 className="section-title">📅 年度別 予算/実績</h2>
        {yearSummary.map((s) => {
          const over = s.actual > s.budget
          const diff = s.budget - s.actual
          const rate = s.budget ? (s.actual / s.budget) * 100 : 0
          return (
            <div
              className={'bar-row' + (s.y === year ? ' budget-row-active' : '')}
              key={s.y}
              style={{ gridTemplateColumns: '120px 1fr 160px', alignItems: 'center' }}
            >
              <button
                className="bar-label"
                onClick={() => setYear(s.y)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontWeight: s.y === year ? 800 : 600,
                  color: s.y === year ? 'var(--accent, #3b5bfd)' : 'var(--text)',
                }}
              >
                {s.y}年{s.y === year ? ' ◀' : ''}
              </button>
              <div className="tip-wrap" style={{ position: 'relative' }}>
                {/* 予算＝グレーのゲージ。その中に実績（緑）が溜まる */}
                <div
                  className="bar-track"
                  style={{ height: 18, width: `${(s.budget / maxSummary) * 100}%`, minWidth: 4, background: '#cbd5e1', borderColor: '#cbd5e1' }}
                >
                  <div
                    className="bar-fill"
                    style={{
                      width: `${Math.min(100, s.budget ? (s.actual / s.budget) * 100 : 0)}%`,
                      background: over ? '#e11d48' : '#16a34a',
                    }}
                  />
                </div>
                {/* 超過分はゲージの外に赤くはみ出す */}
                {over && (
                  <div
                    style={{
                      position: 'absolute', top: 0,
                      left: `${(s.budget / maxSummary) * 100}%`,
                      height: 18,
                      width: `${((s.actual - s.budget) / maxSummary) * 100}%`,
                      background: '#e11d48', opacity: 0.55,
                      borderRadius: '0 999px 999px 0',
                    }}
                  />
                )}
                <div className="tip">
                  <div className="tip-title">{s.y}年</div>
                  <div className="tip-row"><span>予算</span><b>{yen(s.budget)}</b></div>
                  <div className="tip-row"><span>実績</span><b>{yen(s.actual)}</b></div>
                  <div className="tip-row"><span>{over ? '超過' : '残'}</span><b style={{ color: over ? '#fca5a5' : '#86efac' }}>{yen(Math.abs(diff))}</b></div>
                  <div className="tip-row"><span>消化率</span><b>{rate.toFixed(0)}%</b></div>
                </div>
              </div>
              <div className="bar-val">
                <b>{yen(s.actual)}</b><br />
                <span style={{ fontSize: 11 }}>予算 {yen(s.budget)}</span>
              </div>
            </div>
          )
        })}
        <div className="legend" style={{ marginTop: 12 }}>
          <span><span className="sw-dot" style={{ background: '#cbd5e1' }} />予算</span>
          <span><span className="sw-dot" style={{ background: '#16a34a' }} />実績（予算内）</span>
          <span><span className="sw-dot" style={{ background: '#e11d48' }} />実績（超過）</span>
        </div>
      </div>

      {/* カテゴリ別 予算 vs 実績 */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 className="section-title">📂 {year}年 カテゴリ別 内訳</h2>
        {rows.map((r) => {
          const c = BUDGET_CATEGORY_COLORS[r.cat]
          const rate = r.budget ? r.actual / r.budget : 0
          const over = r.actual > r.budget
          const catItems = items.filter((it) => it.category === r.cat)
          return (
            <div key={r.cat} className="bar-row" style={{ gridTemplateColumns: '130px 1fr 220px', alignItems: 'start' }}>
              <div className="bar-label" style={{ paddingTop: 1 }}>
                <span className="sw-dot" style={{ background: c, width: 11, height: 11, borderRadius: 3, display: 'inline-block' }} />
                {r.cat}
              </div>
              <div className="tip-wrap">
                <div className="bar-track" style={{ height: 14 }}>
                  <div className="bar-fill" style={{ width: `${Math.min(100, rate * 100)}%`, background: over ? '#e11d48' : c }} />
                </div>
                {/* 該当ソフト/AI を常時チップ表示（瞬時に把握） */}
                <div className="cat-chips">
                  {catItems.length === 0 ? (
                    <span className="cat-chip cat-chip-empty">該当なし</span>
                  ) : (
                    catItems.map((it, i) => (
                      <span
                        key={i}
                        className="cat-chip"
                        style={{ background: c + '14', color: c, borderColor: c + '33' }}
                        title={`${it.source} · ${it.detail} · ${yen(it.amount)}`}
                      >
                        {it.label}
                      </span>
                    ))
                  )}
                </div>
                <div className="tip">
                  <div className="tip-title"><span className="sw-dot" style={{ background: c }} />{r.cat}（{catItems.length}件）</div>
                  <div className="tip-row"><span>予算</span><b>{yen(r.budget)}</b></div>
                  <div className="tip-row"><span>実績</span><b>{yen(r.actual)}</b></div>
                  <div className="tip-row"><span>{over ? '超過' : '残'}</span><b style={{ color: over ? '#fca5a5' : '#86efac' }}>{yen(Math.abs(r.diff))}</b></div>
                  <div className="tip-row"><span>消化率</span><b>{(rate * 100).toFixed(0)}%</b></div>
                  {catItems.length > 0 && (
                    <div className="tip-items">
                      {catItems.map((it, i) => (
                        <div className="tip-row" key={i}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{it.label}</span>
                          <b>{yen(it.amount)}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="bar-val" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                <span>実績 <b>{yen(r.actual)}</b></span>
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <span className="budget-edit">
                  ¥<input
                    type="number"
                    value={r.budget}
                    min={0}
                    step={100000}
                    onChange={(e) => setBudget(year, r.cat as BudgetCategory, Math.max(0, Number(e.target.value) || 0))}
                  />
                </span>
              </div>
            </div>
          )
        })}
        <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
          ※ 予算額は直接編集できます。実績は契約・AI・API データから自動集計（年額換算）。
        </div>
      </div>

      {/* 実績明細 */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>カテゴリ</th>
              <th>区分</th>
              <th>名称</th>
              <th>明細</th>
              <th style={{ textAlign: 'right' }}>年額</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>この年度の支払い実績データはありません</td></tr>
            ) : (
              items.map((s, i) => (
                <tr key={i}>
                  <td>
                    <span className="tag" style={{
                      background: BUDGET_CATEGORY_COLORS[s.category] + '18',
                      color: BUDGET_CATEGORY_COLORS[s.category],
                      borderColor: BUDGET_CATEGORY_COLORS[s.category] + '40',
                    }}>{s.category}</span>
                  </td>
                  <td><span className="muted" style={{ color: SOURCE_COLORS[s.source] }}>{s.source}</span></td>
                  <td><div className="person-name">{s.label}</div></td>
                  <td><span className="muted" style={{ fontSize: 12 }}>{s.detail}</span></td>
                  <td style={{ textAlign: 'right' }}>{yen(s.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
