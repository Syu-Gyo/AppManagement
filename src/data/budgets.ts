// 年度（暦年）×カテゴリ別の予算（デモ）
// 「予算はこれだけあって、これだけ払った」を購入年度ごとに把握するための定義。
// 予算額はデモ用の仮置き。支払い実績は契約/AIプラン/APIの各データから自動集計する。

import type { Contract } from './contracts'
import type { AiPlan } from './aiplans'
import type { ApiKey } from './apikeys'
import { metaOf } from './software'

export type BudgetCategory = 'CAD/3D' | 'クリエイティブ' | 'AI' | 'API' | 'その他'

export const BUDGET_CATEGORIES: BudgetCategory[] = ['CAD/3D', 'クリエイティブ', 'AI', 'API', 'その他']

export const BUDGET_CATEGORY_COLORS: Record<BudgetCategory, string> = {
  'CAD/3D': '#2563eb',
  クリエイティブ: '#db2777',
  AI: '#7c3aed',
  API: '#0891b2',
  その他: '#64748b',
}

export interface Budget {
  year: number              // 購入年度（暦年）
  category: BudgetCategory
  amount: number            // 年間予算（円）
}

// 年度×カテゴリの予算枠（デモ用の仮置き）
export const SEED_BUDGETS: Budget[] = [
  // 2024年度（実績データなし＝過去の参考値）
  { year: 2024, category: 'CAD/3D', amount: 24000000 },
  { year: 2024, category: 'クリエイティブ', amount: 4000000 },
  { year: 2024, category: 'AI', amount: 800000 },
  { year: 2024, category: 'API', amount: 500000 },
  { year: 2024, category: 'その他', amount: 700000 },
  // 2025年度
  { year: 2025, category: 'CAD/3D', amount: 26000000 },
  { year: 2025, category: 'クリエイティブ', amount: 4500000 },
  { year: 2025, category: 'AI', amount: 2000000 },
  { year: 2025, category: 'API', amount: 1000000 },
  { year: 2025, category: 'その他', amount: 800000 },
  // 2026年度
  { year: 2026, category: 'CAD/3D', amount: 5000000 },
  { year: 2026, category: 'クリエイティブ', amount: 1000000 },
  { year: 2026, category: 'AI', amount: 3000000 },
  { year: 2026, category: 'API', amount: 3000000 },
  { year: 2026, category: 'その他', amount: 500000 },
]

/** 日付文字列(YYYY-MM-DD)から購入年度（暦年）を取り出す。空なら null */
export function purchaseYear(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const y = parseInt(dateStr.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

/** 契約のカテゴリを判定（社員ライセンスと連携していればソフトのカテゴリを流用） */
export function contractCategory(c: Contract): BudgetCategory {
  if (c.licenseKey) return metaOf(c.licenseKey).category as BudgetCategory
  // licenseKey 未連携（VectorWorks / 3dsMAX / V-ray 等）はすべて CAD/3D
  return 'CAD/3D'
}

export interface SpendItem {
  year: number
  category: BudgetCategory
  source: 'ソフト契約' | 'AIツール' | 'API'
  label: string             // 表示名
  detail: string            // 補足（本数・期間など）
  amount: number            // 年額（円）
}

/**
 * 契約 / AIプラン / API から「購入年度ごと」の支払い実績（年額）を集計する。
 * - 契約: 開始日の年に、本数×年額単価を計上
 * - AIプラン: 契約日（無ければ更新日）の年に、月額概算×12 を計上
 * - API: 最終利用日の年に、今月利用額×12 を計上（月次データのため年額換算）
 */
export function computeSpend(contracts: Contract[], aiPlans: AiPlan[], apiKeys: ApiKey[]): SpendItem[] {
  const items: SpendItem[] = []

  for (const c of contracts) {
    const year = purchaseYear(c.startDate)
    if (year == null) continue
    items.push({
      year,
      category: contractCategory(c),
      source: 'ソフト契約',
      label: `${c.software}${c.edition ? ` (${c.edition})` : ''}`,
      detail: `${c.seats}本 · ${c.startDate}〜${c.endDate}`,
      amount: c.seats * c.unitAnnualCost,
    })
  }

  for (const p of aiPlans) {
    const year = purchaseYear(p.contractDate) ?? purchaseYear(p.renewalDate)
    if (year == null) continue
    items.push({
      year,
      category: 'AI',
      source: 'AIツール',
      label: `${p.model} (${p.plan})`,
      detail: `${p.seats}本 · ${p.contractDate || '継続契約'}`,
      amount: p.estMonthlyJpy * 12,
    })
  }

  for (const k of apiKeys) {
    const year = purchaseYear(k.lastUsed)
    if (year == null || k.monthlyUsage <= 0) continue
    items.push({
      year,
      category: 'API',
      source: 'API',
      label: `${k.service} (${k.label})`,
      detail: `${k.env} · 月額×12換算`,
      amount: k.monthlyUsage * 12,
    })
  }

  return items
}
