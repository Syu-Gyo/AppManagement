export interface ActionItem {
  label: string
  detail: string
}

/** 最適化内訳の区分種別 */
export type OptItemKind = 'remove' | 'dedicated' | 'shared' | 'reserve'

export const OPT_KIND_META: Record<OptItemKind, { label: string; color: string; hint: string }> = {
  remove:    { label: '削除（返却）',   color: '#9b2c2c', hint: '0本' },
  shared:    { label: '共有',           color: '#2f7a4f', hint: '⌈人数÷N⌉本' },
  dedicated: { label: '専有（1人1本）', color: '#2d5d8a', hint: '人数=本数' },
  reserve:   { label: '予備',           color: '#b45309', hint: '本数を直接指定' },
}
const DEFAULT_KIND_META = { label: '区分', color: '#6b7280', hint: '' }
export function optKindMeta(kind: string) {
  return OPT_KIND_META[kind as OptItemKind] ?? DEFAULT_KIND_META
}

/** 最適化内訳の1区分 */
export interface OptItem {
  id: string
  label: string            // 例「削除対象」「2人で1ライセンス」「予備」
  kind: OptItemKind
  people: number           // 対象人数（名）
  ratio?: number           // kind='shared' のとき：N人で1ライセンス
  fixedSeats?: number      // kind='reserve' のとき：本数を直接指定
  note?: string            // 補足（例「毎日5・週数回38」）
}

/** 区分1件の必要ライセンス本数（削除=0／その他は需要分） */
export function optItemSeats(it: OptItem): number {
  switch (it.kind) {
    case 'remove': return 0
    case 'dedicated': return Math.max(0, it.people)
    case 'shared': return Math.ceil(Math.max(0, it.people) / Math.max(1, it.ratio ?? 2))
    case 'reserve': return Math.max(0, it.fixedSeats ?? 0)
    default: return Math.max(0, it.fixedSeats ?? 0) // 旧データ（fixed等）の保険
  }
}

/** 最適化内訳（利用実態より自動算出 → 申請ごとに編集可能） */
export interface OptBreakdown {
  show: boolean
  items: OptItem[]
}

/** 区分1件の本数増減（現在からの変化分）。削減はマイナス、追加はプラス。 */
export function optItemDelta(it: OptItem): number {
  switch (it.kind) {
    case 'remove': return -Math.max(0, it.people)                                          // 返却 → 減
    case 'shared': return -(Math.max(0, it.people) - optItemSeats(it))                      // 共有による削減 → 減
    case 'dedicated': return 0                                                              // 現状維持 → 変化なし
    case 'reserve': return Math.max(0, it.fixedSeats ?? 0)                                  // 予備・新入 → 増
    default: return Math.max(0, it.fixedSeats ?? 0)
  }
}

/** 増減式の項（0以外の区分のみ） */
export interface OptDeltaTerm { label: string; sign: '+' | '-'; value: number; color: string }
export function optDeltaTerms(b: OptBreakdown): OptDeltaTerm[] {
  const out: OptDeltaTerm[] = []
  for (const it of b.items ?? []) {
    const color = optKindMeta(it.kind).color
    const people = Math.max(0, it.people)
    if (it.kind === 'remove') {
      if (people > 0) out.push({ label: it.label, sign: '-', value: people, color })
    } else if (it.kind === 'shared') {
      const save = people - optItemSeats(it)
      if (save > 0) out.push({ label: `${it.label}（${people}→${optItemSeats(it)}）`, sign: '-', value: save, color })
    } else if (it.kind === 'reserve') {
      const seats = Math.max(0, it.fixedSeats ?? 0)
      if (seats > 0) out.push({ label: it.label, sign: '+', value: seats, color })
    }
    // dedicated（現状維持）は変化なしのため式に出さない
  }
  return out
}

/** 増減申請本数（全区分の増減合計） */
export function optDelta(b: OptBreakdown): number {
  return (b.items ?? []).reduce((s, it) => s + optItemDelta(it), 0)
}

/** 申請後の必要本数（需要の合計＝削除以外の各区分の本数） */
export function optAfterSeats(b: OptBreakdown): number {
  return (b.items ?? []).reduce((s, it) => s + optItemSeats(it), 0)
}

/** 申請後の本数を構成する需要項目（本数>0の区分） */
export function optNeedTerms(b: OptBreakdown): { label: string; value: number; color: string }[] {
  return (b.items ?? [])
    .filter((it) => optItemSeats(it) > 0)
    .map((it) => ({ label: it.label, value: optItemSeats(it), color: optKindMeta(it.kind).color }))
}

/** 申請書の表示セクション */
export type SlideSectionKey = 'userAnalysis' | 'optBreakdown' | 'cost' | 'reason' | 'schedule'
export const SLIDE_SECTIONS: { key: SlideSectionKey; label: string; icon: string }[] = [
  { key: 'userAnalysis', label: '利用人数分析', icon: '👥' },
  { key: 'optBreakdown', label: '最適化内訳', icon: '💡' },
  { key: 'cost', label: '費用概算', icon: '💰' },
  { key: 'reason', label: '申請理由', icon: '📝' },
  { key: 'schedule', label: '実施スケジュール', icon: '📅' },
]

export interface Slide {
  id: string
  software: string
  category: 'CAD/3D' | 'AI' | 'クリエイティブ' | 'その他'
  badge: '追加購入' | '新規申請' | '現状維持' | '更新集約'
  badgeColor: string
  vendor: string
  purchaseVia: string
  currentSeats: number
  requestSeats: number
  requestDate: string
  targetRenewalDate: string
  costNote: string
  actions: ActionItem[]
  reason: string
  alert?: string
  userDelta?: number
  currentUsersOverride?: number
  optBreakdown?: OptBreakdown
  sections?: Partial<Record<SlideSectionKey, boolean>>  // 未指定=表示
  createdAt?: string  // ISO8601
}

/** セクションが表示対象か（未指定は表示） */
export function sectionVisible(slide: Slide, key: SlideSectionKey): boolean {
  return slide.sections?.[key] !== false
}

export interface ApplicationGroup {
  id: string
  software: string
  submissions: Slide[]
}

export const SOFTWARE_CATALOG: { name: string; category: string }[] = [
  { name: 'Autocad', category: 'CAD/3D' },
  { name: 'AutocadLT', category: 'CAD/3D' },
  { name: 'Revit', category: 'CAD/3D' },
  { name: 'sketchup', category: 'CAD/3D' },
  { name: '3dsMAX', category: 'CAD/3D' },
  { name: 'V-ray', category: 'CAD/3D' },
  { name: 'Twinmotion', category: 'CAD/3D' },
  { name: 'SolidWorks', category: 'CAD/3D' },
  { name: 'CreativeCloud', category: 'クリエイティブ' },
  { name: 'Photoshop', category: 'クリエイティブ' },
  { name: 'Acrobat', category: 'クリエイティブ' },
  { name: 'AdobeExpress', category: 'クリエイティブ' },
  { name: 'chatGPT', category: 'AI' },
  { name: 'Midjourney', category: 'AI' },
  { name: 'KreaAI', category: 'AI' },
  { name: 'Genspark', category: 'AI' },
  { name: 'Tripo', category: 'AI' },
  { name: 'Google AI Studio', category: 'AI' },
]

export const INITIAL_SLIDES: Slide[] = [
  {
    id: 'autocad',
    software: 'Autocad',
    category: 'CAD/3D',
    badge: '更新集約',
    badgeColor: '#2563eb',
    vendor: 'Autodesk',
    purchaseVia: 'ボーンデジタル',
    currentSeats: 35,
    requestSeats: 35,
    requestDate: '2026年9月',
    targetRenewalDate: '2027年1月以降',
    costNote: '35本 × 月額概算 × 4ヶ月分（端数調整）',
    reason: '更新月を1月に統一するため、現在の契約（2026/08/31終了）から1月まで4ヶ月分のつなぎ契約を購入する。次回からは毎年1月更新とし、社内の予算編成サイクル（9〜10月）に合わせる。',
    actions: [
      { label: '2026年9月', detail: '現契約終了（2026/08/31）後、4ヶ月分（2026/09〜12）を購入' },
      { label: '2026年12月', detail: '終了後、2027/01 更新分を予算申請' },
      { label: '2027年1月〜', detail: '以降は毎年1月を更新月として固定' },
    ],
  },
  {
    id: 'sketchup',
    software: 'sketchup',
    category: 'CAD/3D',
    badge: '追加購入',
    badgeColor: '#0891b2',
    vendor: 'Trimble',
    purchaseVia: 'ボーンデジタル',
    currentSeats: 25,
    requestSeats: 1,
    requestDate: '2026年7月〜2027年1月',
    targetRenewalDate: '2027年1月以降（全本数統合）',
    costNote: '7/30 更新：25本分年額 ＋ 1月：1本追加（裏技で全本数を1月起点に集約）',
    reason: '現契約（2026/07/30 終了）を通常通り7/30に更新しつつ、1月に1本追加購入することで全ライセンスの更新月を2027年1月に統合できる。以降は1月一括更新が可能になる。',
    actions: [
      { label: '2026年7月30日', detail: '現契約 25本を通常更新（2026/07/30〜2027/07/29）' },
      { label: '2027年1月', detail: '1本追加購入（2027/01起点）→ 全本数の更新月を1月に統合' },
      { label: '2028年1月〜', detail: '26本を毎年1月一括更新' },
    ],
  },
  {
    id: '3dsmax',
    software: '3dsMAX',
    category: 'CAD/3D',
    badge: '更新集約',
    badgeColor: '#2563eb',
    vendor: 'Autodesk',
    purchaseVia: 'ボーンデジタル',
    currentSeats: 2,
    requestSeats: 2,
    requestDate: '2026年6月（期限切れ中）→ 7月対応',
    targetRenewalDate: '2027年1月以降',
    costNote: '2本 × 月額概算 × 4ヶ月分（AutoCadと同様の対応）',
    reason: 'AutoCadと同様に、現在の契約（2026/04/21 終了・期限切れ）から1月まで4ヶ月分のつなぎ契約を購入する。次回から毎年1月更新とする。',
    actions: [
      { label: '至急・2026年7月', detail: '現契約は 2026/04/21 で期限切れ済み。4ヶ月分（〜2026/09または〜2026/10）を即時購入' },
      { label: '2026年10月', detail: '終了後、2027/01 更新分を予算申請' },
      { label: '2027年1月〜', detail: '以降は毎年1月を更新月として固定' },
    ],
    alert: '⚠️ 3dsMAX は現在 期限切れ（2026/04/21 終了・約2ヶ月経過）です。至急対応が必要です。',
  },
  {
    id: 'vray',
    software: 'V-ray',
    category: 'CAD/3D',
    badge: '追加購入',
    badgeColor: '#7c3aed',
    vendor: 'Chaos',
    purchaseVia: 'ボーンデジタル',
    currentSeats: 4,
    requestSeats: 4,
    requestDate: '2027年1月（継続更新）',
    targetRenewalDate: '2027年1月以降（既に1月更新）',
    costNote: '4本 × 年額90,000円 = 360,000円（現契約: 2026/01/24〜2027/01/23）',
    reason: 'V-rayは既に1月更新（2026/01/24〜2027/01/23）になっているため、2027年1月にそのまま継続更新する。ダブりは発生しない。4本の利用状況を確認して本数が適切か判断する。',
    actions: [
      { label: '2027年1月23日', detail: '現契約 4本が終了' },
      { label: '2027年1月', detail: '4本を年単位で継続更新（2027/01〜2028/01）' },
      { label: '2028年1月〜', detail: '毎年1月一括更新として継続' },
    ],
    alert: '💡 V-rayは既に1月更新サイクルです。ダブりなしで継続可能。本数の過不足のみ確認してください。',
  },
  {
    id: 'twinmotion',
    software: 'Twinmotion',
    category: 'CAD/3D',
    badge: '追加購入',
    badgeColor: '#0891b2',
    vendor: 'Epic Games',
    purchaseVia: 'ボーンデジタル',
    currentSeats: 10,
    requestSeats: 1,
    requestDate: '2026年8月 ＋ 2027年1月',
    targetRenewalDate: '2027年1月以降',
    costNote: '8月：1本追加（年額60,000円）＋ 1月：全本数購入（現契約 2026/04/01 終了済み、ダブりなし）',
    reason: '現契約（2026/04/01 終了・期限切れ）のため至急対応が必要。8月頃1本追加購入しつつ、2027年1月に全本数をまとめて購入することで更新月を1月に統合する。',
    actions: [
      { label: '至急・2026年7月', detail: '現契約は 2026/04/01 で期限切れ。業務に影響がないか確認し、必要な本数を購入' },
      { label: '2026年8月頃', detail: '1本追加購入（需要増への対応）' },
      { label: '2027年1月', detail: '全本数分を年単位で一括購入（2027/01起点）' },
      { label: '2028年1月〜', detail: '毎年1月一括更新として固定' },
    ],
    alert: '⚠️ Twinmotionは現在 期限切れ（2026/04/01 終了・約3ヶ月経過）です。至急確認が必要です。',
  },
  {
    id: 'adobe',
    software: 'CreativeCloud',
    category: 'クリエイティブ',
    badge: '現状維持',
    badgeColor: '#db2777',
    vendor: 'Adobe',
    purchaseVia: 'ボーンデジタル',
    currentSeats: 40,
    requestSeats: 0,
    requestDate: '2026年10月（現行通り）',
    targetRenewalDate: '10月（変更なし）',
    costNote: '変更なし',
    reason: 'Adobe製品群（CC・Photoshop・Acrobat・Adobe Express）は現在10月更新のまま維持する。1月への集約は今期は行わない。',
    actions: [
      { label: '2026年10月11日', detail: 'Adobe CC / Photoshop / Acrobat / Express — 全4製品 終了 → 通常更新' },
      { label: '2026年10月', detail: '更新本数・プランを再確認して継続申請' },
      { label: '以降', detail: '引き続き10月更新。9〜10月の予算編成に計上' },
    ],
    alert: '📌 Adobe製品は引き続き10月更新。9〜10月の予算編成に計上が必要です。',
  },
  {
    id: 'ai-tools',
    software: 'chatGPT',
    category: 'AI',
    badge: '新規申請',
    badgeColor: '#7c3aed',
    vendor: '各AIベンダー',
    purchaseVia: '各ベンダー直販',
    currentSeats: 0,
    requestSeats: 0,
    requestDate: '2027年1月',
    targetRenewalDate: '2027年1月以降',
    costNote: '月次契約のため、1月分から申請',
    reason: 'AIツール（ChatGPT・KreaAI・Genspark・Tripo・GoogleAI等）は現在12月末までのプランが多い。月ごとの契約のため、2027年1月分から申請する形に統一する。1月更新への集約が容易。',
    actions: [
      { label: '2026年12月', detail: '全AIツールの継続要否を確認・利用状況レポート作成' },
      { label: '2027年1月', detail: '必要なAIツールを2027年1月分から申請・継続契約' },
      { label: '以降', detail: '毎年1月に一括で翌年度分を申請（月次契約のためいつでも調整可）' },
    ],
  },
]

export const INITIAL_GROUPS: ApplicationGroup[] = INITIAL_SLIDES.map((s) => ({
  id: `group-${s.id}`,
  software: s.software,
  submissions: [s],
}))
