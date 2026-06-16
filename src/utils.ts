const AVATAR_COLORS = [
  '#3b5bfd', '#7c3aed', '#db2777', '#16a34a', '#f59e0b',
  '#0891b2', '#e11d48', '#4f46e5', '#0d9488', '#ca8a04',
]

export function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function initials(name: string): string {
  return name.slice(0, 1)
}

export function yen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}
