import { useMemo } from 'react'
import { useStore } from '../store'
import { CATEGORY_COLORS, metaOf } from '../data/software'
import { yen } from '../utils'

export default function Software({ onOpen }: { onOpen: (sw: string) => void }) {
  const { members, software } = useStore()

  const cards = useMemo(
    () =>
      software
        .map((sw) => {
          const meta = metaOf(sw)
          const users = members.filter((m) => m.licenses.includes(sw))
          return { sw, meta, count: users.length, cost: users.length * meta.monthlyCost }
        })
        .sort((a, b) => b.count - a.count),
    [members, software],
  )

  const cats = [...new Set(cards.map((c) => c.meta.category))]

  return (
    <div>
      <div className="legend">
        <span>カテゴリ:</span>
        {cats.map((c) => (
          <span key={c}><span className="sw-dot" style={{ background: CATEGORY_COLORS[c] }} />{c}</span>
        ))}
      </div>
      <div className="sw-grid">
        {cards.map(({ sw, meta, count, cost }) => {
          const c = CATEGORY_COLORS[meta.category]
          return (
            <div className="card sw-card" key={sw} onClick={() => onOpen(sw)} style={{ cursor: 'pointer' }}>
              <div className="sw-head">
                <div className="sw-icon" style={{ background: c }}>{sw.slice(0, 1).toUpperCase()}</div>
                <div>
                  <div className="sw-name">{sw}</div>
                  <div className="sw-vendor">{meta.vendor} · {meta.category}</div>
                </div>
              </div>
              <div className="sw-stats">
                <div className="sw-stat">
                  <div className="n">{count}</div>
                  <div className="l">利用者数</div>
                </div>
                <div className="sw-stat" style={{ textAlign: 'right' }}>
                  <div className="n" style={{ fontSize: 16 }}>{yen(cost)}</div>
                  <div className="l">月額（概算）</div>
                </div>
              </div>
              {meta.url && (
                <a className="sw-link" href={meta.url} target="_blank" rel="noopener noreferrer" style={{ color: c }} onClick={(e) => e.stopPropagation()}>
                  🔗 管理画面で状況を確認
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
