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
  /** 購入窓口（代理店など）のデフォルト値 */
  purchaseVia?: string
  /** ライセンス/契約状況を確認できる管理画面・アカウントページのURL */
  url?: string
  /** アイコン画像のパス（/softicons/...）またはdata URI */
  icon?: string
  /** DCCツールとして分類する（Autodesk製でもDCCタブに表示） */
  dcc?: boolean
  /** 表示分類。ホームのフィルタタブと対応（明示指定があればベンダー推定より優先） */
  group?: 'adobe' | 'autodesk' | 'dcc' | 'ai' | 'api'
}
