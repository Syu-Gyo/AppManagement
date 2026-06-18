// APIキー・利用量管理（デモ）
// 生成AI/外部サービスのAPIキーを管理。利用額・予算はデモ用の概算値。

export interface ApiKey {
  id: number
  service: string         // サービス名（OpenAI API 等）
  label: string           // 用途 / プロジェクト名
  keyMasked: string       // マスク済みキー
  owner: string           // 管理者
  env: '本番' | '開発'
  status: '有効' | '無効'
  monthlyUsage: number    // 今月の利用額（円）
  monthlyBudget: number   // 月予算（円）
  lastUsed: string        // 最終利用日 (YYYY-MM-DD)
  consoleUrl?: string     // 利用量・課金状況を確認できる管理コンソールのURL
}

export const API_ENVS = ['本番', '開発'] as const

export const SEED_APIKEYS: ApiKey[] = [
  { id: 1, service: 'OpenAI API', label: '社内チャットボット', keyMasked: 'sk-proj-••••••4A2c', owner: 'kawaguchi@oliverinc.co.jp', env: '本番', status: '有効', monthlyUsage: 82000, monthlyBudget: 100000, lastUsed: '2026-06-15', consoleUrl: 'https://platform.openai.com/usage' },
  { id: 2, service: 'OpenAI API', label: '画像生成検証', keyMasked: 'sk-proj-••••••9F1d', owner: 'yu-tanioka@oliverinc.co.jp', env: '開発', status: '有効', monthlyUsage: 18500, monthlyBudget: 30000, lastUsed: '2026-06-14', consoleUrl: 'https://platform.openai.com/usage' },
  { id: 3, service: 'Anthropic Claude API', label: '提案書ドラフト生成', keyMasked: 'sk-ant-••••••B7e2', owner: 'kawaguchi@oliverinc.co.jp', env: '本番', status: '有効', monthlyUsage: 47000, monthlyBudget: 50000, lastUsed: '2026-06-16', consoleUrl: 'https://console.anthropic.com/settings/usage' },
  { id: 4, service: 'Google Gemini API', label: '議事録要約', keyMasked: 'AIza••••••k3Lq', owner: 'a-saito@oliverinc.co.jp', env: '本番', status: '有効', monthlyUsage: 9800, monthlyBudget: 20000, lastUsed: '2026-06-12', consoleUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 5, service: 'Midjourney API', label: 'パース下絵生成', keyMasked: 'mj-••••••Z8w0', owner: 'nuttaya@oliverinc.co.jp', env: '開発', status: '有効', monthlyUsage: 12000, monthlyBudget: 15000, lastUsed: '2026-06-10', consoleUrl: 'https://www.midjourney.com/account' },
  { id: 6, service: 'Stability AI API', label: 'テクスチャ生成検証', keyMasked: 'sk-••••••Q5r3', owner: 'yu-tanioka@oliverinc.co.jp', env: '開発', status: '無効', monthlyUsage: 0, monthlyBudget: 10000, lastUsed: '2026-03-28', consoleUrl: 'https://platform.stability.ai/account/credits' },
  { id: 7, service: 'DeepL API', label: '海外案件 翻訳', keyMasked: 'dpl-••••••8h2N', owner: 'gyo-shu@oliverinc.co.jp', env: '本番', status: '有効', monthlyUsage: 5400, monthlyBudget: 8000, lastUsed: '2026-06-13', consoleUrl: 'https://www.deepl.com/your-account/usage' },
  { id: 8, service: 'Azure OpenAI', label: '社内ナレッジ検索', keyMasked: 'az-••••••1D9k', owner: 'kawaguchi@oliverinc.co.jp', env: '本番', status: '有効', monthlyUsage: 31000, monthlyBudget: 40000, lastUsed: '2026-06-16', consoleUrl: 'https://portal.azure.com' },
]

export function usageRatio(k: ApiKey): number {
  if (k.monthlyBudget <= 0) return 0
  return k.monthlyUsage / k.monthlyBudget
}
