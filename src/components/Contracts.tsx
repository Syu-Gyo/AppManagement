import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import {
  renewalStatus, STATUS_COLORS, type Contract,
} from '../data/contracts'
import { contractCategory, BUDGET_CATEGORY_COLORS } from '../data/budgets'

// デモの基準日（添付スケジュールが2026年のため固定）
const TODAY = new Date('2026-06-16T00:00:00')

/* ---------------- 週次ガントカレンダー ---------------- */
const WG_YEAR = 2026
const WG_YS = new Date(`${WG_YEAR}-01-01T00:00:00`).getTime()
const WG_YE = new Date(`${WG_YEAR}-12-31T00:00:00`).getTime()
const WG_SPAN = WG_YE - WG_YS
const N_WEEKS = 52
const LABEL_W = 200
const QUARTERS = [
  { label: 'Q1', m0: 0, m1: 3, color: '#1e293b' },
  { label: 'Q2', m0: 3, m1: 6, color: '#4ca64c' },
  { label: 'Q3', m0: 6, m1: 9, color: '#2e7d32' },
  { label: 'Q4', m0: 9, m1: 12, color: '#3f86c4' },
]

function makeXOf(trackW: number) {
  return (t: number) => Math.max(0, Math.min(trackW, ((t - WG_YS) / WG_SPAN) * trackW))
}
function ms(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').getTime()
}
function monthStart(m: number) {
  return new Date(WG_YEAR, m, 1).getTime()
}
function fmtMD(t: number) {
  const dt = new Date(t)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}
function twoMonthsBefore(dateStr: string) {
  const dt = new Date(dateStr + 'T00:00:00')
  dt.setMonth(dt.getMonth() - 2)
  return dt.getTime()
}

function WgChip({ x, color, label, align = 'center' }: { x: number; color: string; label: string; align?: 'center' | 'left' }) {
  return (
    <div
      className="wg-chip"
      style={{
        left: x,
        background: color,
        transform: align === 'left' ? 'translate(0, -50%)' : 'translate(-50%, -50%)',
      }}
    >
      {label}
    </div>
  )
}

// ホーム画面のSOFTWARE_LISTに準じた表示順
const SW_ORDER = [
  'adobe photoshop', 'adobe Express', 'adobe acrobat', 'adobe Creative Cloud',
  'Autocad', 'AutocadLT', 'Revit', '3dsMAX',
  'Sketchup', 'Solidworks', 'Twinmotion', 'V-ray',
]

function WeekGantt({ contracts, onOpen }: { contracts: Contract[]; onOpen: (c: Contract) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [trackW, setTrackW] = useState(N_WEEKS * 30)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setTrackW(Math.max(N_WEEKS * 14, el.clientWidth - LABEL_W))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const weekW = trackW / N_WEEKS
  const xOf = useMemo(() => makeXOf(trackW), [trackW])

  const groups = useMemo(() => {
    const map = new Map<string, Contract[]>()
    for (const c of contracts) {
      const arr = map.get(c.software)
      if (arr) arr.push(c)
      else map.set(c.software, [c])
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ai = SW_ORDER.indexOf(a)
      const bi = SW_ORDER.indexOf(b)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return a.localeCompare(b, 'ja')
    })
  }, [contracts])

  const todayX = xOf(TODAY.getTime())
  const weeks = Array.from({ length: N_WEEKS }, (_, i) => WG_YS + i * 7 * 86400000)

  return (
    <div className="wg-wrap" ref={wrapRef}>
      <div className="wg" style={{ width: LABEL_W + trackW }}>
        {/* ヘッダー: 四半期 */}
        <div className="wg-row">
          <div className="wg-label wg-corner" style={{ width: LABEL_W }} />
          <div className="wg-track wg-qrow" style={{ width: trackW }}>
            {QUARTERS.map((q) => {
              const left = xOf(monthStart(q.m0))
              const right = q.m1 >= 12 ? trackW : xOf(monthStart(q.m1))
              return (
                <div key={q.label} className="wg-q" style={{ left, width: right - left, background: q.color }}>{q.label}</div>
              )
            })}
            <div className="wg-today-flag" style={{ left: todayX }}>TODAY</div>
          </div>
        </div>
        {/* ヘッダー: 月 */}
        <div className="wg-row">
          <div className="wg-label" style={{ width: LABEL_W }} />
          <div className="wg-track wg-mrow" style={{ width: trackW }}>
            {Array.from({ length: 12 }, (_, m) => {
              const left = xOf(monthStart(m))
              const right = m === 11 ? trackW : xOf(monthStart(m + 1))
              return <div key={m} className="wg-m" style={{ left, width: right - left }}>{m + 1}月</div>
            })}
          </div>
        </div>
        {/* ヘッダー: 週の開始日 + 週番号 */}
        <div className="wg-row">
          <div className="wg-label wg-week-lbl" style={{ width: LABEL_W }}>Week</div>
          <div className="wg-track wg-wrow" style={{ width: trackW }}>
            {weeks.map((w, i) => (
              <div key={i} className="wg-w" style={{ left: i * weekW, width: weekW }}>
                <span className="wg-w-date">{new Date(w).getDate()}</span>
                <span className="wg-w-num">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 本体: ソフトごとにグループ */}
        {groups.map(([sw, list]) => (
          <div key={sw}>
            <div className="wg-row wg-grouprow">
              <div className="wg-label wg-glabel" style={{ width: LABEL_W }}>{sw}</div>
              <div className="wg-track" style={{ width: trackW }}>
                <div className="wg-today-line" style={{ left: todayX }} />
              </div>
            </div>
            {list.map((c) => {
              const sX = xOf(ms(c.startDate))
              const eX = xOf(ms(c.endDate))
              const cat = contractCategory(c)
              const color = BUDGET_CATEGORY_COLORS[cat]
              const startsInYear = ms(c.startDate) >= WG_YS
              const endsInYear = ms(c.endDate) <= WG_YE
              const m2 = twoMonthsBefore(c.endDate)
              const m2InYear = m2 >= WG_YS && m2 <= WG_YE
              const startDt = new Date(c.startDate + 'T00:00:00')
              return (
                <div className="wg-row wg-barrow" key={c.id} onClick={() => onOpen(c)} title={`${c.software} ${c.edition}`}>
                  <div className="wg-label wg-sublabel" style={{ width: LABEL_W }}>
                    <span className="wg-dot" style={{ background: color }} />
                    {c.edition || c.vendor} · {c.seats}本
                  </div>
                  <div className="wg-track" style={{ width: trackW }}>
                    <div className="wg-today-line" style={{ left: todayX }} />
                    {/* 契約期間バー（矢印） */}
                    <div className="wg-bar" style={{ left: sX, width: Math.max(2, eX - sX), color }}>
                      {endsInYear && <span className="wg-arrow" style={{ borderLeftColor: color }} />}
                    </div>
                    {/* 開始マーカー */}
                    {startsInYear ? (
                      <WgChip x={sX} color="#4ca64c" label={`${fmtMD(ms(c.startDate))} ${c.autoRenew ? '契約更新' : '契約'}`} align="left" />
                    ) : (
                      <WgChip x={2} color="#4ca64c" align="left"
                        label={`${startDt.getFullYear()}/${startDt.getMonth() + 1}/${startDt.getDate()} ${c.autoRenew ? '契約更新' : '契約'}`} />
                    )}
                    {/* 2ヶ月前リマインド */}
                    {m2InYear && <WgChip x={xOf(m2)} color="#0e9f6e" label={`${fmtMD(m2)} 2ヶ月前`} />}
                    {/* 終了マーカー */}
                    {endsInYear && <WgChip x={eX} color="#274b6d" label={`${fmtMD(ms(c.endDate))} ${c.autoRenew ? '更新満了日' : '契約満了'}`} />}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- メイン ---------------- */
export default function Contracts({ onOpen }: { onOpen: (c: Contract) => void }) {
  const { contracts } = useStore()
  return <WeekGantt contracts={contracts} onOpen={onOpen} />
}
