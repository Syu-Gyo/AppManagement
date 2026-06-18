import type { SoftwareMeta } from './types'

// デモ用のソフトウェアメタ情報（カテゴリ・概算月額）。
// 金額はあくまでデモ用の仮置きで、実際の契約金額ではありません。
export const SOFTWARE_META: Record<string, SoftwareMeta> = {
  Midjourney: { name: 'Midjourney', category: 'AI', monthlyCost: 1500, vendor: 'Midjourney', url: 'https://www.midjourney.com/account' },
  chatGPT: { name: 'chatGPT', category: 'AI', monthlyCost: 3000, vendor: 'OpenAI', url: 'https://platform.openai.com/account' },
  Autocad: { name: 'Autocad', category: 'CAD/3D', monthlyCost: 30000, vendor: 'Autodesk', url: 'https://manage.autodesk.com' },
  AutocadLT: { name: 'AutocadLT', category: 'CAD/3D', monthlyCost: 6000, vendor: 'Autodesk', url: 'https://manage.autodesk.com' },
  sketchup: { name: 'sketchup', category: 'CAD/3D', monthlyCost: 3500, vendor: 'Trimble', url: 'https://account.sketchup.com' },
  photoshop: { name: 'photoshop', category: 'クリエイティブ', monthlyCost: 3300, vendor: 'Adobe', url: 'https://adminconsole.adobe.com' },
  'Adobe Express': { name: 'Adobe Express', category: 'クリエイティブ', monthlyCost: 1500, vendor: 'Adobe', url: 'https://adminconsole.adobe.com' },
  acrobat: { name: 'acrobat', category: 'その他', monthlyCost: 2000, vendor: 'Adobe', url: 'https://adminconsole.adobe.com' },
  CreativeCloud: { name: 'CreativeCloud', category: 'クリエイティブ', monthlyCost: 7800, vendor: 'Adobe', url: 'https://adminconsole.adobe.com' },
  solidworks: { name: 'solidworks', category: 'CAD/3D', monthlyCost: 40000, vendor: 'Dassault', url: 'https://customerportal.solidworks.com' },
  Twinmotion: { name: 'Twinmotion', category: 'CAD/3D', monthlyCost: 6000, vendor: 'Epic Games', url: 'https://www.unrealengine.com/account' },
  Revit: { name: 'Revit', category: 'CAD/3D', monthlyCost: 35000, vendor: 'Autodesk', url: 'https://manage.autodesk.com' },
}

export const CATEGORY_COLORS: Record<string, string> = {
  'CAD/3D': '#2563eb',
  AI: '#7c3aed',
  クリエイティブ: '#db2777',
  その他: '#64748b',
}

export function metaOf(name: string): SoftwareMeta {
  return (
    SOFTWARE_META[name] ?? { name, category: 'その他', monthlyCost: 0, vendor: '—' }
  )
}
