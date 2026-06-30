import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { FREQUENCY_META, NEEDED_META, type SurveyRound } from '../data/usage'
import { metaOf } from '../data/software'
import { avatarColor, initials } from '../utils'

// --- Microsoft Forms テンプレート ---
const FORMS_TEMPLATE = `【アンケートタイトル】
{ソフト名}の利用頻度調査

【説明文】
ライセンス管理のため、以下のアンケートへのご協力をお願いします。
所要時間：約1分

---

Q1. {ソフト名}の利用頻度を教えてください ※必須・1つ選択

○ 毎日
○ 週2〜3日程度
○ 週1日程度
○ 月1日程度
○ ほとんど使っていない（数ヶ月に1回以下）
○ 使っていない（不要のため返却可）

---

Q2. 今後も{ソフト名}のライセンスが必要ですか？ ※必須・1つ選択

○ 必須（業務上不可欠）
○ あれば便利（なくても困らない）
○ 不要（返却してよい）

---

【取込方法】
1. Formsの回答を「Excelで開く」でダウンロード
2. このアプリのソフトウェア一覧で対象ソフトのアップロードボタン（↑）をクリック
3. ダウンロードしたExcelファイルを選択して取り込み`

const FREQ_ORDER: Array<import('../data/usage').UsageFrequency> = ['daily', 'weekly', 'monthly', 'rare', 'never']

export default function SurveyRounds() {
  const { surveyRounds, usage, members } = useStore()
  const [templateOpen, setTemplateOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const rounds = useMemo(() =>
    [...surveyRounds].sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
    [surveyRounds]
  )

  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  function recordsForRound(round: SurveyRound) {
    return usage.filter(u =>
      u.surveyedAt === round.sentAt &&
      (round.software ? u.software === round.software : true)
    )
  }

  function copyTemplate() {
    navigator.clipboard.writeText(FORMS_TEMPLATE).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div>
      {/* Microsoft Forms テンプレート */}
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <div
          style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setTemplateOpen(v => !v)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Microsoft Forms テンプレート</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                アンケート作成時にコピペで使えるテンプレート・取込方法
              </div>
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{templateOpen ? '▲ 閉じる' : '▼ 開く'}</span>
        </div>

        {templateOpen && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button className="btn primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={copyTemplate}>
                {copied ? '✓ コピーしました' : '📋 クリップボードにコピー'}
              </button>
            </div>
            <pre style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 16px', fontSize: 12.5, lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
              color: 'var(--text)', fontFamily: 'inherit',
            }}>
              {FORMS_TEMPLATE}
            </pre>
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 9, fontSize: 12 }}>
              <strong>💡 取込時の注意：</strong>
              {' '}Excelエクスポート後、列順は自動検出されます。メールアドレス列（Email）があると精度が上がります。
              「利用頻度」列の回答がこのテンプレートのとおりであれば自動マッピングされます。
            </div>
          </div>
        )}
      </div>

      {/* 回答履歴 */}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>取り込み済みアンケート履歴</h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rounds.length} 件</span>
      </div>

      {rounds.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
          まだアンケートが取り込まれていません。<br />
          ソフトウェア一覧の↑ボタンからCSV/Excelをアップロードしてください。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rounds.map(round => {
          const recs = recordsForRound(round)
          const isExpanded = expandedId === round.id
          const meta = round.software ? metaOf(round.software) : null
          const isAutodesk = recs.some(r => r.source === 'autodesk')
          const freqCounts: Record<string, number> = {}
          for (const r of recs) freqCounts[r.frequency] = (freqCounts[r.frequency] ?? 0) + 1
          const maxCount = Math.max(...Object.values(freqCounts), 1)

          return (
            <div key={round.id} className="card" style={{ overflow: 'hidden' }}>
              {/* ラウンドヘッダー */}
              <div
                style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : round.id)}
              >
                {meta?.icon ? (
                  <div style={{ width: 36, height: 36, background: 'var(--surface-2)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img src={meta.icon} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div style={{ width: 36, height: 36, background: isAutodesk ? '#185fa5' : 'var(--primary)', borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0, color: '#fff', fontSize: 13, fontWeight: 700 }}>
                    {isAutodesk ? 'AD' : '📊'}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{round.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {round.sentAt}
                    {round.closedAt && round.closedAt !== round.sentAt ? ` 〜 ${round.closedAt}` : ''}
                    {' · '}
                    {recs.length} 件取込
                    {isAutodesk && <span style={{ marginLeft: 6, color: '#185fa5', fontWeight: 600 }}>Autodesk実測</span>}
                  </div>
                </div>

                {/* 頻度ミニバー */}
                <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 28, flexShrink: 0 }}>
                  {FREQ_ORDER.filter(f => freqCounts[f]).map(f => (
                    <div key={f} title={`${FREQUENCY_META[f].label}: ${freqCounts[f]}名`} style={{
                      width: 12, borderRadius: 3,
                      height: `${Math.round((freqCounts[f] / maxCount) * 28)}px`,
                      background: FREQUENCY_META[f].color,
                    }} />
                  ))}
                </div>

                <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* 展開: 回答テーブル */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {/* 頻度サマリー */}
                  <div style={{ padding: '10px 18px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
                    {FREQ_ORDER.filter(f => freqCounts[f]).map(f => (
                      <span key={f} style={{
                        fontSize: 12, padding: '3px 10px', borderRadius: 999,
                        background: FREQUENCY_META[f].color + '22',
                        color: FREQUENCY_META[f].color,
                        border: `1px solid ${FREQUENCY_META[f].color}44`,
                        fontWeight: 600,
                      }}>
                        {FREQUENCY_META[f].short}: {freqCounts[f]}名
                      </span>
                    ))}
                  </div>

                  {/* 個別回答 */}
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['メンバー', 'ソフトウェア', '利用頻度', '今後の要否'].map(h => (
                            <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '8px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recs.sort((a, b) => FREQ_ORDER.indexOf(a.frequency) - FREQ_ORDER.indexOf(b.frequency)).map((r, i) => {
                          const member = memberById.get(r.memberId)
                          const fm = FREQUENCY_META[r.frequency]
                          const nm = r.stillNeeded ? NEEDED_META[r.stillNeeded] : null
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px 14px' }}>
                                {member ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: avatarColor(member.name), display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                                      {initials(member.name)}
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{member.name}</div>
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{member.department}</div>
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID:{r.memberId}</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 14px', fontSize: 12.5 }}>{r.software}</td>
                              <td style={{ padding: '8px 14px' }}>
                                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: fm.color + '22', color: fm.color, fontWeight: 600 }}>
                                  {fm.label}
                                </span>
                              </td>
                              <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                                {nm ? nm.label : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
