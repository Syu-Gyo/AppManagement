// ソフトウェア契約スケジュール（デモ）
// 元データ: 2026ソフト-AI契約スケジュール.xlsx（ソフト名・本数）。
// 契約期間/更新日/単価は Excel が色塗り運用で日付を持たないため、デモ用の編集可能な値です。

export interface Contract {
  id: number
  software: string        // ソフト名（表示用）
  edition: string         // エディション / 補足（任意）
  vendor: string
  /** 「2026全社員」の社員別ライセンス名に対応するキー。利用者突合に使用。未連携なら null */
  licenseKey: string | null
  seats: number           // 契約本数（席数）
  unitAnnualCost: number  // 1本あたり年額（円・概算）
  startDate: string       // 契約開始日 (YYYY-MM-DD)
  endDate: string         // 契約終了日 (YYYY-MM-DD)
  autoRenew: boolean      // 自動更新
  note: string
}

export const CONTRACT_VENDORS = ['Autodesk', 'Adobe', 'A&A (Vectorworks)', 'Trimble', 'Dassault', 'Chaos', 'Epic Games', 'その他'] as const

export const SEED_CONTRACTS: Contract[] = [
  { id: 1, software: 'VectorWorks', edition: '2024 Fundamental', vendor: 'A&A (Vectorworks)', licenseKey: null, seats: 64, unitAnnualCost: 60000, startDate: '2025-12-21', endDate: '2026-12-20', autoRenew: true, note: '' },
  { id: 2, software: 'VectorWorks', edition: '2024 Architect', vendor: 'A&A (Vectorworks)', licenseKey: null, seats: 15, unitAnnualCost: 120000, startDate: '2025-12-21', endDate: '2026-12-20', autoRenew: true, note: '' },
  { id: 3, software: 'Autocad', edition: '正規版', vendor: 'Autodesk', licenseKey: 'Autocad', seats: 35, unitAnnualCost: 280000, startDate: '2025-07-13', endDate: '2026-07-12', autoRenew: false, note: '更新時に本数見直し予定' },
  { id: 4, software: 'AutocadLT', edition: '', vendor: 'Autodesk', licenseKey: 'AutocadLT', seats: 94, unitAnnualCost: 60000, startDate: '2025-09-01', endDate: '2026-08-31', autoRenew: true, note: '' },
  { id: 5, software: 'adobe Creative Cloud', edition: 'コンプリート', vendor: 'Adobe', licenseKey: 'CreativeCloud', seats: 40, unitAnnualCost: 94000, startDate: '2025-07-01', endDate: '2026-06-30', autoRenew: true, note: '' },
  { id: 6, software: 'adobe photoshop', edition: '単体', vendor: 'Adobe', licenseKey: 'photoshop', seats: 20, unitAnnualCost: 40000, startDate: '2025-10-01', endDate: '2026-09-30', autoRenew: true, note: '' },
  { id: 7, software: 'adobe acrobat', edition: 'Pro', vendor: 'Adobe', licenseKey: 'acrobat', seats: 30, unitAnnualCost: 24000, startDate: '2025-11-01', endDate: '2026-10-31', autoRenew: true, note: '' },
  { id: 8, software: 'adobe Express', edition: '', vendor: 'Adobe', licenseKey: 'Adobe Express', seats: 15, unitAnnualCost: 12000, startDate: '2026-01-15', endDate: '2027-01-14', autoRenew: true, note: '' },
  { id: 9, software: 'Sketchup', edition: 'Pro', vendor: 'Trimble', licenseKey: 'sketchup', seats: 25, unitAnnualCost: 42000, startDate: '2025-08-01', endDate: '2026-07-31', autoRenew: false, note: '' },
  { id: 10, software: 'Solidworks', edition: 'Standard', vendor: 'Dassault', licenseKey: 'solidworks', seats: 5, unitAnnualCost: 480000, startDate: '2026-03-01', endDate: '2027-02-28', autoRenew: false, note: '' },
  { id: 11, software: '3dsMAX', edition: '', vendor: 'Autodesk', licenseKey: null, seats: 2, unitAnnualCost: 280000, startDate: '2025-06-01', endDate: '2026-05-31', autoRenew: false, note: '5本→2本に減（朱、齋藤）' },
  { id: 12, software: 'V-ray', edition: '', vendor: 'Chaos', licenseKey: null, seats: 4, unitAnnualCost: 90000, startDate: '2025-09-15', endDate: '2026-09-14', autoRenew: true, note: '' },
  { id: 13, software: 'Revit', edition: '', vendor: 'Autodesk', licenseKey: 'Revit', seats: 6, unitAnnualCost: 420000, startDate: '2025-08-01', endDate: '2026-07-31', autoRenew: false, note: '' },
  { id: 14, software: 'Twinmotion', edition: '', vendor: 'Epic Games', licenseKey: 'Twinmotion', seats: 10, unitAnnualCost: 60000, startDate: '2026-02-01', endDate: '2027-01-31', autoRenew: true, note: '' },
]

export type RenewalStatus = '契約中' | '更新間近' | '期限切れ'

export function renewalStatus(endDate: string, today: Date, soonDays = 60): RenewalStatus {
  const end = new Date(endDate + 'T00:00:00')
  const diff = Math.floor((end.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return '期限切れ'
  if (diff <= soonDays) return '更新間近'
  return '契約中'
}

export function daysUntil(endDate: string, today: Date): number {
  const end = new Date(endDate + 'T00:00:00')
  return Math.floor((end.getTime() - today.getTime()) / 86400000)
}

export const STATUS_COLORS: Record<RenewalStatus, string> = {
  契約中: '#16a34a',
  更新間近: '#f59e0b',
  期限切れ: '#e11d48',
}
