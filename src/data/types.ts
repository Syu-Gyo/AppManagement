export type SoftwareName = string

export interface Member {
  id: number
  name: string
  department: string
  section: string
  email: string
  licenses: SoftwareName[]
}

export interface SoftwareMeta {
  name: SoftwareName
  category: 'CAD/3D' | 'AI' | 'クリエイティブ' | 'その他'
  /** 1ライセンスあたりの月額（円）— デモ用の概算 */
  monthlyCost: number
  vendor: string
}
