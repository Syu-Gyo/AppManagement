import type { SoftwareMeta } from './types'

// デモ用のソフトウェアメタ情報（カテゴリ・概算月額）。
// 金額はあくまでデモ用の仮置きで、実際の契約金額ではありません。
export const SOFTWARE_META: Record<string, SoftwareMeta> = {
  '3dsMax':          { name: '3ds Max',       category: 'CAD/3D',      monthlyCost: 23000, vendor: 'Autodesk',   url: 'https://manage.autodesk.com',                       icon: '/softicons/3dsmax.svg',  dcc: true },
  Vray:              { name: 'V-Ray',          category: 'CAD/3D',      monthlyCost: 7500,  vendor: 'Chaos',      url: 'https://www.chaos.com/account',                     icon: '/softicons/vray.svg',    dcc: true },
  Midjourney:      { name: 'Midjourney',    category: 'AI',          monthlyCost: 1500,  vendor: 'Midjourney', url: 'https://www.midjourney.com/account',                icon: '/softicons/midjourney.svg' },
  chatGPT:         { name: 'chatGPT',          category: 'AI',          monthlyCost: 3000,  vendor: 'OpenAI',     url: 'https://chatgpt.com/admin',                         icon: '/softicons/chatgpt_pro.svg' },
  'chatGPT Business': { name: 'chatGPT Business', category: 'AI',        monthlyCost: 3000,  vendor: 'OpenAI',     url: 'https://chatgpt.com/admin',                         icon: '/softicons/chatgpt_business.svg' },
  'chatGPT Pro':      { name: 'chatGPT Pro',      category: 'AI',        monthlyCost: 20000, vendor: 'OpenAI',     url: 'https://chatgpt.com/admin',                         icon: '/softicons/chatgpt_pro.svg' },
  Autocad:         { name: 'Autocad',       category: 'CAD/3D',      monthlyCost: 30000, vendor: 'Autodesk',   url: 'https://manage.autodesk.com',                       icon: '/softicons/autocad.svg' },
  AutocadLT:       { name: 'AutocadLT',     category: 'CAD/3D',      monthlyCost: 6000,  vendor: 'Autodesk',   url: 'https://manage.autodesk.com',                       icon: '/softicons/autocad_lt.svg' },
  sketchup:        { name: 'sketchup',      category: 'CAD/3D',      monthlyCost: 3500,  vendor: 'Trimble',    url: 'https://account.sketchup.com',                      icon: '/softicons/sketchup.svg' },
  photoshop:       { name: 'photoshop',     category: 'クリエイティブ', monthlyCost: 3300,  vendor: 'Adobe',      url: 'https://adminconsole.adobe.com',                    icon: '/softicons/adobe_photoshop.svg' },
  'Adobe Express': { name: 'Adobe Express', category: 'クリエイティブ', monthlyCost: 1500,  vendor: 'Adobe',      url: 'https://adminconsole.adobe.com',                    icon: '/softicons/adobe_express.svg' },
  acrobat:         { name: 'acrobat',       category: 'その他',       monthlyCost: 2000,  vendor: 'Adobe',      url: 'https://adminconsole.adobe.com',                    icon: '/softicons/adobe_acrobat.svg' },
  CreativeCloud:   { name: 'CreativeCloud', category: 'クリエイティブ', monthlyCost: 7800,  vendor: 'Adobe',      url: 'https://adminconsole.adobe.com',                    icon: '/softicons/adobe_creative_cloud.svg' },
  solidworks:      { name: 'solidworks',    category: 'CAD/3D',      monthlyCost: 40000, vendor: 'Dassault', purchaseVia: 'Canon', url: 'https://customerportal.solidworks.com', icon: '/softicons/solidworks.svg' },
  Twinmotion:      { name: 'Twinmotion',    category: 'CAD/3D',      monthlyCost: 6000,  vendor: 'Epic Games', url: 'https://www.unrealengine.com/account',              icon: '/softicons/twinmotion.svg' },
  Revit:           { name: 'Revit',         category: 'CAD/3D',      monthlyCost: 35000, vendor: 'Autodesk',   url: 'https://manage.autodesk.com',                       icon: '/softicons/revit.svg' },
  KreaAI:          { name: 'KreaAI',        category: 'AI',          monthlyCost: 5250,  vendor: 'Krea',       url: 'https://www.krea.ai',                               icon: '/softicons/krea_ai.png' },
  Genspark:        { name: 'Genspark',      category: 'AI',          monthlyCost: 3750,  vendor: 'Genspark',   url: 'https://www.genspark.ai',                           icon: '/softicons/genspark.ico' },
  Tripo:           { name: 'Tripo',         category: 'AI',          monthlyCost: 3000,  vendor: 'Tripo',      url: 'https://www.tripo3d.ai',                            icon: '/softicons/tripo.ico' },
  GoogleAI:        { name: 'GoogleAI',      category: 'AI',          monthlyCost: 18000, vendor: 'Google',     url: 'https://one.google.com/about/plans/gemini',         icon: '/softicons/google_ai.svg' },
}

// AIプランモデル別アイコン
export const AI_MODEL_ICONS: Record<string, string> = {
  chatGPT:      '/softicons/chatgpt_business.svg',
  KreaAI:       '/softicons/krea_ai.png',
  Genspark:     '/softicons/genspark.ico',
  Tripo:        '/softicons/tripo.ico',
  Midjourney:   '/softicons/midjourney.svg',
  Adobeexpress: '/softicons/adobe_express.svg',
  'Google AI':  '/softicons/google_ai.svg',
}

// APIサービス別アイコン
export const API_SERVICE_ICONS: Record<string, string> = {
  'OpenAI API':          '/softicons/openai_api.svg',
  'Anthropic Claude API': '/softicons/anthropic_claude_api.svg',
  'Google Gemini API':   '/softicons/google_gemini_api.svg',
  'Midjourney API':      '/softicons/midjourney_api.svg',
  'Stability AI API':    '/softicons/stability_ai_api.svg',
  'DeepL API':           '/softicons/deepl_api.svg',
  'Azure OpenAI':        '/softicons/azure_openai.svg',
}

export const CATEGORY_COLORS: Record<string, string> = {
  'CAD/3D': '#2563eb',
  AI: '#7c3aed',
  クリエイティブ: '#db2777',
  その他: '#64748b',
}

// カスタムツール用の実行時レジストリ（store から registerCustomMeta() で注入される）
let _customMeta: Record<string, SoftwareMeta> = {}
export function registerCustomMeta(meta: Record<string, SoftwareMeta>) { _customMeta = meta }

export function metaOf(name: string): SoftwareMeta {
  const normalize = (s: string) => s.toLowerCase().replace(/[-\s]/g, '')
  return (
    _customMeta[name] ??
    SOFTWARE_META[name] ??
    Object.entries(SOFTWARE_META).find(([k]) => normalize(k) === normalize(name))?.[1] ??
    { name, category: 'その他', monthlyCost: 0, vendor: '—' }
  )
}
