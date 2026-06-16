import type { SoftwareMeta } from './types'

// デモ用のソフトウェアメタ情報（カテゴリ・概算月額）。
// 金額はあくまでデモ用の仮置きで、実際の契約金額ではありません。
export const SOFTWARE_META: Record<string, SoftwareMeta> = {
  Midjourney: { name: 'Midjourney', category: 'AI', monthlyCost: 1500, vendor: 'Midjourney' },
  chatGPT: { name: 'chatGPT', category: 'AI', monthlyCost: 3000, vendor: 'OpenAI' },
  Autocad: { name: 'Autocad', category: 'CAD/3D', monthlyCost: 30000, vendor: 'Autodesk' },
  AutocadLT: { name: 'AutocadLT', category: 'CAD/3D', monthlyCost: 6000, vendor: 'Autodesk' },
  sketchup: { name: 'sketchup', category: 'CAD/3D', monthlyCost: 3500, vendor: 'Trimble' },
  photoshop: { name: 'photoshop', category: 'クリエイティブ', monthlyCost: 3300, vendor: 'Adobe' },
  'Adobe Express': { name: 'Adobe Express', category: 'クリエイティブ', monthlyCost: 1500, vendor: 'Adobe' },
  acrobat: { name: 'acrobat', category: 'その他', monthlyCost: 2000, vendor: 'Adobe' },
  CreativeCloud: { name: 'CreativeCloud', category: 'クリエイティブ', monthlyCost: 7800, vendor: 'Adobe' },
  solidworks: { name: 'solidworks', category: 'CAD/3D', monthlyCost: 40000, vendor: 'Dassault' },
  Twinmotion: { name: 'Twinmotion', category: 'CAD/3D', monthlyCost: 6000, vendor: 'Epic Games' },
  Revit: { name: 'Revit', category: 'CAD/3D', monthlyCost: 35000, vendor: 'Autodesk' },
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
