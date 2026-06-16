import { useMemo } from 'react'
import { useStore } from '../store'
import { CATEGORY_COLORS, metaOf } from '../data/software'
import { yen } from '../utils'

function Kpi({ icon, color, label, value, unit, foot }: {
  icon: string; color: string; label: string; value: string; unit?: string; foot?: string
}) {
  return (
    <div className="card kpi">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="label">{label}</div>
        <div className="kpi-ico" style={{ background: color + '1a', color }}>{icon}</div>
      </div>
      <div className="value">{value}<span className="unit">{unit}</span></div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { members, software } = useStore()

  const stats = useMemo(() => {
    const perSw = software.map((sw) => ({
      name: sw,
      count: members.filter((m) => m.licenses.includes(sw)).length,
      meta: metaOf(sw),
    }))
    const totalLicenses = perSw.reduce((s, x) => s + x.count, 0)
    const monthlyCost = perSw.reduce((s, x) => s + x.count * x.meta.monthlyCost, 0)
    const byDept = new Map<string, number>()
    for (const m of members) {
      const d = m.department || '未所属'
      byDept.set(d, (byDept.get(d) ?? 0) + 1)
    }
    const noLicense = members.filter((m) => m.licenses.length === 0).length
    return {
      perSw: [...perSw].sort((a, b) => b.count - a.count),
      totalLicenses,
      monthlyCost,
      depts: [...byDept.entries()].sort((a, b) => b[1] - a[1]),
      noLicense,
    }
  }, [members, software])

  const maxSw = Math.max(1, ...stats.perSw.map((s) => s.count))
  const maxDept = Math.max(1, ...stats.depts.map((d) => d[1]))

  return (
    <div>
      <div className="kpi-grid">
        <Kpi icon="👥" color="#3b5bfd" label="登録メンバー" value={String(members.length)} unit="名"
          foot={`${stats.depts.length} 部署にまたがる`} />
        <Kpi icon="📦" color="#7c3aed" label="管理ソフト" value={String(software.length)} unit="種"
          foot="全社で利用中のアプリ" />
        <Kpi icon="🔑" color="#16a34a" label="ライセンス付与数" value={stats.totalLicenses.toLocaleString()} unit="件"
          foot={`1人あたり平均 ${(stats.totalLicenses / Math.max(1, members.length)).toFixed(1)} 件`} />
        <Kpi icon="💴" color="#f59e0b" label="月額コスト（概算）" value={yen(stats.monthlyCost)}
          foot={`年間 約 ${yen(stats.monthlyCost * 12)}`} />
      </div>

      <div className="grid-2">
        <div className="card" style={{ padding: 20 }}>
          <h2 className="section-title">📊 ソフト別ライセンス数</h2>
          {stats.perSw.map((s) => {
            const c = CATEGORY_COLORS[s.meta.category]
            return (
              <div className="bar-row" key={s.name}>
                <div className="bar-label">
                  <span className="sw-dot" style={{ background: c, width: 11, height: 11, borderRadius: 3, display: 'inline-block' }} />
                  {s.name}
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(s.count / maxSw) * 100}%`, background: c }} />
                </div>
                <div className="bar-val"><b>{s.count}</b> 件 · {yen(s.count * s.meta.monthlyCost)}</div>
              </div>
            )
          })}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h2 className="section-title">🏢 部署別メンバー数</h2>
          {stats.depts.slice(0, 8).map(([d, n]) => (
            <div className="bar-row" key={d} style={{ gridTemplateColumns: '150px 1fr 50px' }}>
              <div className="bar-label" style={{ fontSize: 12.5 }}>{d}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(n / maxDept) * 100}%`, background: '#3b5bfd' }} />
              </div>
              <div className="bar-val"><b>{n}</b></div>
            </div>
          ))}
          {stats.noLicense > 0 && (
            <div style={{ marginTop: 16, padding: '12px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 9, fontSize: 12.5, color: '#9a3412' }}>
              ⚠️ ライセンス未付与のメンバーが <b>{stats.noLicense}</b> 名います
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
