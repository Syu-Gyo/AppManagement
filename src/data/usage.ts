// ソフトの「実利用」レイヤー（デモ）
// 実利用データは Microsoft Forms の定期アンケート（自己申告）で収集する想定。
// 1メンバー×1ソフトにつき「利用頻度」と「今後の要否」を持つ。レコードが無い組み合わせ＝未回答。
import type { Member } from './types'
import type { Contract } from './contracts'
import { metaOf } from './software'
import { SEED_AI_PLANS } from './aiplans'

export type UsageFrequency = 'daily' | 'weekly' | 'monthly' | 'rare' | 'never'
export type StillNeeded = 'must' | 'nice' | 'no'
/** 実利用データの出どころ。survey=Formsアンケート（自己申告）／autodesk=Autodesk使用状況レポート（実測） */
export type UsageSource = 'survey' | 'autodesk'

export interface UsageRecord {
  memberId: number
  software: string
  frequency: UsageFrequency
  /** Autodesk実測など、要否回答が無いデータ源では null */
  stillNeeded: StillNeeded | null
  /** このデータを取得した日 (YYYY-MM-DD) */
  surveyedAt: string
  /** データの出どころ（未指定は survey 扱い） */
  source?: UsageSource
}

export const SOURCE_META: Record<UsageSource, { label: string; short: string; color: string }> = {
  autodesk: { label: 'Autodesk 使用状況レポート（実測）', short: 'Autodesk実測', color: '#185fa5' },
  survey: { label: 'Forms アンケート（自己申告）', short: 'アンケート', color: '#854f0b' },
}

export const AUTODESK_USAGE_URL = 'https://manage.autodesk.com/usage-report'
export const AUTODESK_SEATS_URL = 'https://manage.autodesk.com/seats/products'

export interface SurveyRound {
  id: string
  name: string
  sentAt: string
  closedAt: string | null
  /** 配信対象者数 */
  targetCount: number
  software?: string  // single-software survey indicator
}

export const FREQUENCY_META: Record<
  UsageFrequency,
  { label: string; short: string; active: boolean; color: string }
> = {
  daily: { label: '毎日', short: '毎日', active: true, color: '#0f6e56' },
  weekly: { label: '週に数回', short: '週数回', active: true, color: '#1d9e75' },
  monthly: { label: '月に数回', short: '月数回', active: true, color: '#97c459' },
  rare: { label: 'ほぼ使わない', short: 'ほぼ無', active: false, color: '#ef9f27' },
  never: { label: '全く使わない', short: '不使用', active: false, color: '#e24b4a' },
}

export const NEEDED_META: Record<StillNeeded, { label: string }> = {
  must: { label: '必須' },
  nice: { label: 'あれば便利' },
  no: { label: '不要（返却可）' },
}

/** アンケート回答ラベル → enum（CSV取り込み用。表記ゆれも吸収） */
export const FREQ_BY_LABEL: Record<string, UsageFrequency> = {
  毎日: 'daily',
  週に数回: 'weekly',
  週数回: 'weekly',
  '週2,3日程度': 'weekly',
  '週2～3日程度': 'weekly',
  '週2〜3日程度': 'weekly',
  週1日程度: 'weekly',
  月に数回: 'monthly',
  月数回: 'monthly',
  月1日程度: 'monthly',
  ほぼ使わない: 'rare',
  あまり使わない: 'rare',
  ほとんど使っていない: 'rare',
  数ヶ月に1回以下: 'rare',
  全く使わない: 'never',
  使っていない: 'never',
}
export const NEED_BY_LABEL: Record<string, StillNeeded> = {
  必須: 'must',
  あれば便利: 'nice',
  不要: 'no',
  '不要（返却可）': 'no',
  返却可: 'no',
  '必須（業務上不可欠）': 'must',
  'あれば便利（なくても困らない）': 'nice',
  '不要（返却してよい）': 'no',
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/**
 * デモ用の実利用シードを保有ライセンスから決定的に生成する。
 * 約14%は「未回答」（レコード無し）として残し、鮮度・回答率UIを意味のあるものにする。
 */
export function generateUsageSeed(members: Member[]): UsageRecord[] {
  const out: UsageRecord[] = []
  for (const m of members) {
    for (const sw of m.licenses) {
      const h = hash(`${m.id}:${sw}`)
      if (h % 100 < 14) continue // 未回答
      const r = (h >> 7) % 100
      let frequency: UsageFrequency
      if (r < 38) frequency = 'daily'
      else if (r < 60) frequency = 'weekly'
      else if (r < 74) frequency = 'monthly'
      else if (r < 88) frequency = 'rare'
      else frequency = 'never'
      const active = frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly'
      // Autodesk製品は実測レポート由来（要否回答は持たない）、その他はアンケート由来
      const isAutodesk = metaOf(sw).vendor === 'Autodesk'
      const nr = (h >> 13) % 100
      const stillNeeded: StillNeeded | null = isAutodesk
        ? null
        : active
          ? nr < 72
            ? 'must'
            : 'nice'
          : nr < 55
            ? 'no'
            : 'nice'
      out.push({
        memberId: m.id,
        software: sw,
        frequency,
        stillNeeded,
        surveyedAt: isAutodesk ? '2026-06-22' : '2026-06-10',
        source: isAutodesk ? 'autodesk' : 'survey',
      })
    }
  }
  return out
}

export const SEED_SURVEY_ROUNDS: SurveyRound[] = [
  { id: 'r1', name: '2026年Q1 ソフト利用調査', sentAt: '2026-03-09', closedAt: '2026-03-20', targetCount: 187 },
  { id: 'r2', name: '2026年Q2 ソフト利用調査', sentAt: '2026-06-08', closedAt: '2026-06-13', targetCount: 187 },
]

// ---------- 最適化サマリーの計算 ----------

export interface OptRow {
  software: string
  category: string
  seats: number // 契約本数（契約＋AI配布プラン）
  assigned: number // 付与数（ライセンス保有者）
  active: number // 実利用（毎日/週/月）
  dormant: number // 死蔵候補（ほぼ/全く使わない）
  unknown: number // 未回答
  responded: number // 回答済み（active + dormant）
  noNeed: number // 「不要（返却可）」回答数
  freq: Record<UsageFrequency, number> // 保有者の利用頻度別 人数
  // --- 必要ライセンス数モデル ---
  dedicated: number // 専有が要る人数（毎日・週）
  shared: number // 共有でまかなえる人数（月1・ほぼ）
  removable: number // 全く使わない人数（削除対象）
  required: number // 必要ライセンス数 = 専有 + ⌈共有/2⌉ + 未回答(暫定専有)
  delta: number // 契約 − 必要（＋=減らせる / −=増やす）
  shortage: number // 不足本数 = max(0, 必要 − 契約)
  surplus: number // 減らせる本数 = max(0, 契約 − 必要)
  annualUnit: number // 1本あたり年額（概算・円）
  utilRate: number // active / assigned
  savings: number // 年間削減余地（円）= surplus × annualUnit
  source: UsageSource // 実利用データの主な出どころ
  dataDate: string | null // そのソフトの実利用データ取得日（最新）
  usageUrl?: string // 実測レポートへの直リンク（Autodesk等）
  rec: { kind: 'ok' | 'reduce' | 'surplus' | 'shortage'; label: string; detail: string }
}

export interface OptTotals {
  savings: number
  surplus: number // 全社で減らせる本数
  shortage: number // 全社で追加すべき本数
  dormant: number
  reduceSoftware: number // 減らせるソフト数
  shortageSoftware: number // 追加すべきソフト数
  responded: number
  holderPairs: number
  lastSurveyedAt: string | null
}

// 共有ライセンスの割当比率：月1・ほぼ使わない層は「2人で1本」使い回す前提
export const SHARE_PER_LICENSE = 2

function yenShort(n: number): string {
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `¥${Math.round(n / 1000)}k`
  return `¥${Math.round(n)}`
}

export function computeOptimization(
  members: Member[],
  software: string[],
  contracts: Contract[],
  usage: UsageRecord[],
): { rows: OptRow[]; totals: OptTotals } {
  // sw -> 保有メンバーID集合
  const holders = new Map<string, Set<number>>()
  for (const sw of software) holders.set(sw, new Set())
  for (const m of members) for (const sw of m.licenses) holders.get(sw)?.add(m.id)

  // sw -> (memberId -> record)
  const usageBySw = new Map<string, Map<number, UsageRecord>>()
  for (const u of usage) {
    if (!usageBySw.has(u.software)) usageBySw.set(u.software, new Map())
    usageBySw.get(u.software)!.set(u.memberId, u)
  }

  const rows: OptRow[] = software.map((sw) => {
    const meta = metaOf(sw)
    const holderSet = holders.get(sw) ?? new Set<number>()
    const assigned = holderSet.size

    // 契約本数：通常契約＋AI配布プランの席数を合算
    const cs = contracts.filter((c) => c.licenseKey === sw)
    const aiPlans = SEED_AI_PLANS.filter((p) => p.model === sw)
    const contractSeats = cs.reduce((s, c) => s + c.seats, 0)
    const aiSeats = aiPlans.reduce((s, p) => s + p.seats, 0)
    const seats = contractSeats + aiSeats

    const annualUnit =
      contractSeats > 0
        ? cs.reduce((s, c) => s + c.seats * c.unitAnnualCost, 0) / contractSeats
        : meta.monthlyCost * 12

    // 保有者の利用頻度を集計
    const recs = usageBySw.get(sw)
    const freq: Record<UsageFrequency, number> = { daily: 0, weekly: 0, monthly: 0, rare: 0, never: 0 }
    let noNeed = 0
    let autoCount = 0
    let surveyCount = 0
    let dataDate: string | null = null
    for (const id of holderSet) {
      const u = recs?.get(id)
      if (!u) continue
      freq[u.frequency]++
      if (u.stillNeeded === 'no') noNeed++
      if ((u.source ?? 'survey') === 'autodesk') autoCount++
      else surveyCount++
      if (!dataDate || u.surveyedAt > dataDate) dataDate = u.surveyedAt
    }
    const active = freq.daily + freq.weekly + freq.monthly
    const dormant = freq.rare + freq.never
    const responded = active + dormant
    const unknown = assigned - responded

    // --- 必要ライセンス数の算定 ---
    // 専有（毎日・週）＝1人1本／共有（月1・ほぼ）＝SHARE_PER_LICENSE人で1本／全く使わない＝0本
    // 未回答は判定材料が無いため暫定で専有扱い（むやみに減らさない）
    const dedicated = freq.daily + freq.weekly
    const shared = freq.monthly + freq.rare
    const removable = freq.never
    const required = dedicated + Math.ceil(shared / SHARE_PER_LICENSE) + unknown

    const shortage = Math.max(0, required - seats)
    const surplus = Math.max(0, seats - required)
    const delta = seats - required
    const utilRate = assigned > 0 ? active / assigned : 0
    const savings = surplus * annualUnit

    // 主なデータ源：実データが無ければベンダーから推定（Autodesk製品はレポート前提）
    const source: UsageSource =
      autoCount + surveyCount === 0
        ? meta.vendor === 'Autodesk'
          ? 'autodesk'
          : 'survey'
        : autoCount >= surveyCount
          ? 'autodesk'
          : 'survey'
    const usageUrl = meta.vendor === 'Autodesk' ? AUTODESK_USAGE_URL : undefined

    let rec: OptRow['rec']
    if (shortage > 0) {
      rec = { kind: 'shortage', label: '増やす', detail: `+${shortage}本` }
    } else if (surplus > 0) {
      rec = { kind: 'reduce', label: '減らせる', detail: `−${surplus}本` }
    } else {
      rec = { kind: 'ok', label: '適正', detail: '' }
    }

    return {
      software: sw,
      category: meta.category,
      seats,
      assigned,
      active,
      dormant,
      unknown,
      responded,
      noNeed,
      freq,
      dedicated,
      shared,
      removable,
      required,
      delta,
      shortage,
      surplus,
      annualUnit,
      utilRate,
      savings,
      source,
      dataDate,
      usageUrl,
      rec,
    }
  })

  const holderPairs = rows.reduce((s, r) => s + r.assigned, 0)
  const totals: OptTotals = {
    savings: rows.reduce((s, r) => s + r.savings, 0),
    surplus: rows.reduce((s, r) => s + r.surplus, 0),
    shortage: rows.reduce((s, r) => s + r.shortage, 0),
    dormant: rows.reduce((s, r) => s + r.dormant, 0),
    reduceSoftware: rows.filter((r) => r.surplus > 0).length,
    shortageSoftware: rows.filter((r) => r.shortage > 0).length,
    responded: rows.reduce((s, r) => s + r.responded, 0),
    holderPairs,
    lastSurveyedAt: usage.reduce<string | null>(
      (max, u) => (!max || u.surveyedAt > max ? u.surveyedAt : max),
      null,
    ),
  }
  return { rows, totals }
}

export { yenShort }

// OptRow → 編集可能な内訳の初期値（利用実態より）
import type { OptBreakdown, OptItem } from './application'
export function deriveBreakdown(r: OptRow): OptBreakdown {
  const items: OptItem[] = [
    { id: 'remove', label: '削除対象', kind: 'remove', people: r.removable, note: '全く使わない' },
    { id: 'share2', label: '2人で1ライセンス', kind: 'shared', people: r.shared, ratio: SHARE_PER_LICENSE, note: '月数回・ほぼ使わない' },
    { id: 'keep', label: '現状維持（専有）', kind: 'dedicated', people: r.dedicated, note: `毎日${r.freq.daily}・週数回${r.freq.weekly}` },
  ]
  if (r.unknown > 0) items.push({ id: 'unknown', label: '未回答', kind: 'dedicated', people: r.unknown, note: '暫定で専有計上' })
  return { show: true, items }
}

// ---------- CSVインポート（Formsアンケート結果の取り込み） ----------

export interface ImportResult {
  records: UsageRecord[]
  matched: number
  unmatchedNames: string[]
  unknownSoftware: string[]
  skipped: number
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/**
 * 縦持ちCSV（氏名, ソフト, 利用頻度, 今後の要否）を取り込む。
 * 氏名はメンバー名と完全一致で突合。ソフトは SOFTWARE_LIST に含まれるもののみ採用。
 */
export function parseUsageCsv(
  text: string,
  members: Member[],
  software: string[],
  surveyedAt: string,
): ImportResult {
  const idByName = new Map(members.map((m) => [m.name, m.id]))
  const swSet = new Set(software)
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const records: UsageRecord[] = []
  const unmatchedNames = new Set<string>()
  const unknownSoftware = new Set<string>()
  let skipped = 0
  let matched = 0

  for (let i = 0; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    // ヘッダー行をスキップ
    if (i === 0 && (cells[0].includes('氏名') || cells[0].includes('名前'))) continue
    const [name, sw, freqLabel, needLabel] = cells
    if (!name || !sw) {
      skipped++
      continue
    }
    const id = idByName.get(name)
    if (id === undefined) {
      unmatchedNames.add(name)
      continue
    }
    if (!swSet.has(sw)) {
      unknownSoftware.add(sw)
      continue
    }
    const frequency = FREQ_BY_LABEL[(freqLabel ?? '').replace(/\s/g, '')]
    if (!frequency) {
      skipped++
      continue
    }
    const stillNeeded = NEED_BY_LABEL[(needLabel ?? '').replace(/\s/g, '')] ?? 'nice'
    records.push({ memberId: id, software: sw, frequency, stillNeeded, surveyedAt, source: 'survey' })
    matched++
  }

  return {
    records,
    matched,
    unmatchedNames: [...unmatchedNames],
    unknownSoftware: [...unknownSoftware],
    skipped,
  }
}


const FORMS_FREQ_BY_LABEL: Array<[RegExp, UsageFrequency]> = [
  [/毎日|daily/i, 'daily'],
  [/週|weekly/i, 'weekly'],
  [/月|monthly/i, 'monthly'],
  [/ほとんど|年|数回|ほぼ|あまり|rare/i, 'rare'],
  [/全く|使わない|使っていない|未使用|never/i, 'never'],
]

function normalizeSurveyLabel(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/\s/g, '')
    .replace(/,/g, '、')
    .replace(/３/g, '3')
    .replace(/２/g, '2')
    .replace(/１/g, '1')
}

function frequencyFromSurveyLabel(value: string): UsageFrequency | null {
  const normalized = normalizeSurveyLabel(value)
  if (FREQ_BY_LABEL[normalized]) return FREQ_BY_LABEL[normalized]
  for (const [pattern, frequency] of FORMS_FREQ_BY_LABEL) {
    if (pattern.test(normalized)) return frequency
  }
  return null
}

function findHeaderIndex(headers: string[], patterns: RegExp[]): number {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)))
}

export function parseUsageRows(
  rows: string[][],
  members: Member[],
  software: string[],
  surveyedAt: string,
  targetSoftware?: string,
): ImportResult {
  const records: UsageRecord[] = []
  const unmatchedNames = new Set<string>()
  const unknownSoftware = new Set<string>()
  const idByName = new Map(members.map((m) => [m.name.replace(/\s/g, ''), m.id]))
  const idByEmail = new Map(members.map((m) => [m.email.trim().toLowerCase(), m.id]))
  const swSet = new Set(software)
  let skipped = 0
  let matched = 0

  if (rows.length === 0) {
    return { records, matched, unmatchedNames: [], unknownSoftware: [], skipped: 0 }
  }

  const detectedHeaderRowIndex = rows.findIndex((row) => row.some((cell) => {
    const value = String(cell ?? '')
    return /name|email|frequency/i.test(value) || value.includes('名前') || value.includes('氏名') || value.includes('メール') || value.includes('利用頻度') || value.includes('使用頻度')
  }))
  const headerRowIndex = detectedHeaderRowIndex >= 0 ? detectedHeaderRowIndex : 0

  const headers = rows[headerRowIndex].map((cell) => String(cell ?? '').trim())
  const nameIdx = findHeaderIndex(headers, [/^name$/i, /名前/, /氏名/])
  const emailIdx = findHeaderIndex(headers, [/email/i, /メール/])
  const swIdx = findHeaderIndex(headers, [/software/i, /ソフト/, /ツール/])
  const freqIdx = findHeaderIndex(headers, [/frequency/i, /利用頻度/, /使用頻度/])
  const needIdx = findHeaderIndex(headers, [/必要/, /要否/, /今後/])

  const formsNameIdx = nameIdx >= 0 ? nameIdx : 4
  const formsEmailIdx = emailIdx >= 0 ? emailIdx : 3
  const formsFreqIdx = freqIdx >= 0 ? freqIdx : 6

  if (formsFreqIdx < 0 || (!targetSoftware && swIdx < 0)) {
    return { records, matched, unmatchedNames: [], unknownSoftware: [], skipped: rows.length - headerRowIndex - 1 }
  }

  for (const row of rows.slice(headerRowIndex + 1)) {
    const name = String(row[formsNameIdx] ?? '').trim()
    const email = String(row[formsEmailIdx] ?? '').trim().toLowerCase()
    const sw = targetSoftware ?? String(row[swIdx] ?? '').trim()
    const freqLabel = String(row[formsFreqIdx] ?? '').trim()
    const needLabel = needIdx >= 0 ? String(row[needIdx] ?? '').trim() : ''

    if (!sw || !freqLabel || (!name && !email)) {
      skipped++
      continue
    }

    const memberId = (email ? idByEmail.get(email) : undefined) ?? idByName.get(name.replace(/\s/g, ''))
    if (memberId === undefined) {
      unmatchedNames.add(name || email)
      continue
    }
    if (!swSet.has(sw)) {
      unknownSoftware.add(sw)
      continue
    }

    const frequency = frequencyFromSurveyLabel(freqLabel)
    if (!frequency) {
      skipped++
      continue
    }

    const stillNeeded = NEED_BY_LABEL[normalizeSurveyLabel(needLabel)] ?? 'nice'
    records.push({ memberId, software: sw, frequency, stillNeeded, surveyedAt, source: 'survey' })
    matched++
  }

  return {
    records,
    matched,
    unmatchedNames: [...unmatchedNames],
    unknownSoftware: [...unknownSoftware],
    skipped,
  }
}

// ---------- Autodesk 使用状況レポートの取り込み ----------

// Autodesk製品/オファリング名 → このアプリのソフトキー（LTを先に判定）。
// AEC Collection には Revit が含まれるため Revit に寄せる。
const AUTODESK_PRODUCT_MAP: [RegExp, string][] = [
  [/autocad\s*lt/i, 'AutocadLT'],
  [/autocad/i, 'Autocad'],
  [/revit|architecture.*construction.*collection|aec\s*collection/i, 'Revit'],
]

function matchAutodeskProduct(product: string): string | null {
  for (const [re, sw] of AUTODESK_PRODUCT_MAP) if (re.test(product)) return sw
  return null
}

const FREQ_WEIGHT: UsageFrequency[] = ['never', 'rare', 'monthly', 'weekly', 'daily']

// 月あたり平均使用日数 → 利用頻度
function freqFromMonthlyAvg(avg: number): UsageFrequency {
  if (avg >= 15) return 'daily'
  if (avg >= 5) return 'weekly'
  if (avg >= 1) return 'monthly'
  if (avg > 0) return 'rare'
  return 'never'
}

// 最終使用日からの経過日数 → 利用頻度（使用日数列が無い場合のフォールバック）
function freqFromLastUsed(lastUsed: string, asOf: string): UsageFrequency | null {
  const a = Date.parse(lastUsed)
  const b = Date.parse(asOf)
  if (isNaN(a) || isNaN(b)) return null
  const days = Math.floor((b - a) / 86400000)
  if (days <= 7) return 'daily'
  if (days <= 30) return 'weekly'
  if (days <= 90) return 'monthly'
  if (days <= 180) return 'rare'
  return 'never'
}

function findCol(headers: string[], include: RegExp, exclude?: RegExp): number {
  return headers.findIndex((h) => include.test(h) && !(exclude && exclude.test(h)))
}

function parseMDY(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (!m) return null
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

function monthKey(iso: string): string { return iso.slice(0, 7) }

/**
 * Autodesk "seat_usage" 日次ログ形式（Day used 列あり）の取り込み。
 * 各行は「1人が1日1機能を使った」ログ。
 * (email, product) ごとにユニーク日数を集計し月平均に変換して利用頻度を算定する。
 */
export function parseAutodeskDayLog(
  text: string,
  members: Member[],
  software: string[],
  asOf: string,
): ImportResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { records: [], matched: 0, unmatchedNames: [], unknownSoftware: [], skipped: 0 }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim())
  const emailIdx = headers.findIndex((h) => /e-?mail/.test(h))
  const productIdx = headers.findIndex((h) => h === 'product')
  const firstIdx = headers.findIndex((h) => /first.?name/.test(h))
  const lastIdx = headers.findIndex((h) => /last.?name/.test(h))
  const dayIdx = headers.findIndex((h) => /day.?used/.test(h))

  if (productIdx < 0 || dayIdx < 0) {
    return { records: [], matched: 0, unmatchedNames: [], unknownSoftware: [], skipped: lines.length - 1 }
  }

  const idByEmail = new Map(members.map((m) => [m.email.trim().toLowerCase(), m.id]))
  const idByName = new Map(members.map((m) => [m.name.replace(/\s/g, ''), m.id]))
  const swSet = new Set(software)
  const daysByKey = new Map<string, { memberId: number; sw: string; days: Set<string> }>()
  const allMonths = new Set<string>()
  const unmatchedNames = new Set<string>()
  const unknownSoftware = new Set<string>()
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const email = emailIdx >= 0 ? (cells[emailIdx] ?? '').trim().toLowerCase() : ''
    const product = (cells[productIdx] ?? '').trim()
    const dayRaw = (cells[dayIdx] ?? '').trim()

    if (!product || !dayRaw) { skipped++; continue }

    const sw = matchAutodeskProduct(product)
    if (!sw || !swSet.has(sw)) { unknownSoftware.add(product); continue }

    const day = parseMDY(dayRaw)
    if (!day) { skipped++; continue }

    let memberId: number | undefined
    if (email && !/^\*+$/.test(email)) memberId = idByEmail.get(email)
    if (memberId === undefined && firstIdx >= 0) {
      const first = (cells[firstIdx] ?? '').trim()
      const last = lastIdx >= 0 ? (cells[lastIdx] ?? '').trim() : ''
      memberId = idByName.get((last + first).replace(/\s/g, '')) ?? idByName.get((first + last).replace(/\s/g, ''))
    }
    if (memberId === undefined) { unmatchedNames.add(email || product); continue }

    allMonths.add(monthKey(day))
    const key = `${memberId}::${sw}`
    if (!daysByKey.has(key)) daysByKey.set(key, { memberId, sw, days: new Set() })
    daysByKey.get(key)!.days.add(day)
  }

  const numMonths = Math.max(allMonths.size, 1)
  const records: UsageRecord[] = []
  for (const { memberId, sw, days } of daysByKey.values()) {
    const frequency = freqFromMonthlyAvg(days.size / numMonths)
    records.push({ memberId, software: sw, frequency, stillNeeded: null, surveyedAt: asOf, source: 'autodesk' })
  }

  return { records, matched: records.length, unmatchedNames: [...unmatchedNames], unknownSoftware: [...unknownSoftware], skipped }
}

/**
 * Autodesk アカウントの「使用状況レポート」エクスポート（user_details.csv 等）を取り込む。
 * 列見出しはキーワードで自動検出。突合は email を優先（first_name/last_name は順序ゆれ・和洋混在のため）。
 * 利用頻度は monthly_average（月平均使用日数）を優先し、無ければ days_used / last_accessed で推定。
 * seat_assignment が 'assigned' 以外（解約済み席）の行は除外。同一 (member, ソフト) は最も高い頻度を採用。
 * 取り込んだレコードは source='autodesk' でタグ付けし、アンケートより優先（同一 memberId×software を上書き）。
 */
export function parseAutodeskCsv(
  text: string,
  members: Member[],
  software: string[],
  asOf: string,
): ImportResult {
  // Detect "Day used" daily log format (new Autodesk export style)
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/)[0] ?? ''
  if (/day.?used/i.test(firstLine)) {
    return parseAutodeskDayLog(text, members, software, asOf)
  }

  const idByEmail = new Map(members.map((m) => [m.email.trim().toLowerCase(), m.id]))
  const idByName = new Map(members.map((m) => [m.name.replace(/\s/g, ''), m.id]))
  const swSet = new Set(software)
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const byKey = new Map<string, UsageRecord>() // memberId::sw -> 最も高い頻度を保持
  const unmatchedNames = new Set<string>()
  const unknownSoftware = new Set<string>()
  let skipped = 0

  if (lines.length < 2) return { records: [], matched: 0, unmatchedNames: [], unknownSoftware: [], skipped: 0 }

  const headers = parseCsvLine(lines[0])
  const emailIdx = findCol(headers, /e-?mail|メール/i, /hashed/i)
  const productIdx = findCol(headers, /offering|product|製品|アプリ/i)
  const firstIdx = findCol(headers, /first.?name|given/i)
  const lastIdx = findCol(headers, /last.?name|family|surname|姓/i)
  const fullNameIdx = findCol(headers, /氏名|フルネーム|full.?name/i)
  const avgIdx = findCol(headers, /monthly.?average|月.?平均|average|平均/i)
  const daysIdx = findCol(headers, /days.?used|使用日数/i)
  const lastUsedIdx = findCol(headers, /last.?access|last.?used|最終(使用|利用|アクセス)/i)
  const assignIdx = findCol(headers, /seat.?assignment|割当|状態/i)

  // 製品列と、突合の手がかり（email か 氏名）が無ければ想定外フォーマット
  if (productIdx === -1 || (emailIdx === -1 && fullNameIdx === -1 && firstIdx === -1)) {
    return { records: [], matched: 0, unmatchedNames: [], unknownSoftware: [], skipped: lines.length - 1 }
  }

  const nameOf = (cells: string[]) => {
    if (fullNameIdx !== -1) return (cells[fullNameIdx] ?? '').replace(/\s/g, '')
    const f = (cells[firstIdx] ?? '').trim()
    const l = (cells[lastIdx] ?? '').trim()
    return { lastFirst: (l + f).replace(/\s/g, ''), firstLast: (f + l).replace(/\s/g, '') }
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])

    // 解約済み（unassigned）席は対象外
    if (assignIdx !== -1) {
      const a = (cells[assignIdx] ?? '').trim().toLowerCase()
      if (a && a !== 'assigned') continue
    }

    const product = (cells[productIdx] ?? '').trim()
    if (!product) {
      skipped++
      continue
    }
    const sw = matchAutodeskProduct(product)
    if (!sw || !swSet.has(sw)) {
      unknownSoftware.add(product)
      continue
    }

    // メンバー突合：email 優先、ダメなら氏名（姓名・名姓の両方を試す）
    let id: number | undefined
    const email = emailIdx !== -1 ? (cells[emailIdx] ?? '').trim().toLowerCase() : ''
    if (email && !/^\*+$/.test(email)) id = idByEmail.get(email)
    if (id === undefined) {
      const nm = nameOf(cells)
      if (typeof nm === 'string') id = idByName.get(nm)
      else id = idByName.get(nm.lastFirst) ?? idByName.get(nm.firstLast)
    }
    if (id === undefined) {
      unmatchedNames.add(email || product)
      continue
    }

    // 利用頻度：月平均 → 累計使用日数 → 最終使用日 の順で算定
    let frequency: UsageFrequency | null = null
    const avgStr = avgIdx !== -1 ? cells[avgIdx] : ''
    const avg = parseFloat(String(avgStr).replace(/[^\d.]/g, ''))
    if (avgStr && !isNaN(avg)) frequency = freqFromMonthlyAvg(avg)
    else if (daysIdx !== -1 && cells[daysIdx]) {
      const d = parseFloat(String(cells[daysIdx]).replace(/[^\d.]/g, ''))
      if (!isNaN(d)) frequency = freqFromMonthlyAvg(d)
    } else if (lastUsedIdx !== -1 && cells[lastUsedIdx]) {
      frequency = freqFromLastUsed(cells[lastUsedIdx], asOf)
    }
    if (!frequency) {
      skipped++
      continue
    }

    // 同一 (member, ソフト) が複数行 → 最も高い頻度を採用
    const key = `${id}::${sw}`
    const prev = byKey.get(key)
    if (!prev || FREQ_WEIGHT.indexOf(frequency) > FREQ_WEIGHT.indexOf(prev.frequency)) {
      byKey.set(key, { memberId: id, software: sw, frequency, stillNeeded: null, surveyedAt: asOf, source: 'autodesk' })
    }
  }

  const records = [...byKey.values()]
  return {
    records,
    matched: records.length,
    unmatchedNames: [...unmatchedNames],
    unknownSoftware: [...unknownSoftware],
    skipped,
  }
}
