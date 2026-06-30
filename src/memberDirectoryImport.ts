import type { Member } from './data/types'

export type ImportedMemberRow = Pick<Member, 'name' | 'department' | 'section'>

type ZipEntry = {
  name: string
  method: number
  compressedSize: number
  localOffset: number
}

const decoder = new TextDecoder('utf-8')

export async function parseMemberDirectoryFile(file: File): Promise<ImportedMemberRow[]> {
  const name = file.name.toLowerCase()
  const buffer = await file.arrayBuffer()
  if (name.endsWith('.csv')) return parseRowsFromMatrix(parseCsv(decoder.decode(buffer)))
  if (name.endsWith('.xlsx')) return parseXlsx(buffer)
  throw new Error('CSV または XLSX ファイルを選択してください')
}

async function parseXlsx(buffer: ArrayBuffer): Promise<ImportedMemberRow[]> {
  const entries = readZipEntries(buffer)
  const firstSheet = entries.find((e) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(e.name))
  if (!firstSheet) throw new Error('Excel シートが見つかりません')

  const sharedEntry = entries.find((e) => e.name === 'xl/sharedStrings.xml')
  const sharedStrings = sharedEntry ? parseSharedStrings(await readEntry(buffer, sharedEntry)) : []
  const sheetXml = await readEntry(buffer, firstSheet)
  return parseRowsFromMatrix(parseWorksheet(sheetXml, sharedStrings))
}

function readZipEntries(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer)
  let eocd = -1
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 70000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('XLSX の ZIP 情報を読み取れません')

  const count = view.getUint16(eocd + 10, true)
  const cdOffset = view.getUint32(eocd + 16, true)
  const entries: ZipEntry[] = []
  let p = cdOffset
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break
    const method = view.getUint16(p + 10, true)
    const compressedSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const name = decoder.decode(new Uint8Array(buffer, p + 46, nameLen))
    entries.push({ name, method, compressedSize, localOffset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function readEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const view = new DataView(buffer)
  const p = entry.localOffset
  if (view.getUint32(p, true) !== 0x04034b50) throw new Error(`ZIP エントリを読み取れません: ${entry.name}`)
  const nameLen = view.getUint16(p + 26, true)
  const extraLen = view.getUint16(p + 28, true)
  const start = p + 30 + nameLen + extraLen
  const bytes = new Uint8Array(buffer, start, entry.compressedSize)
  if (entry.method === 0) return decoder.decode(bytes)
  if (entry.method !== 8) throw new Error(`未対応の圧縮形式です: ${entry.method}`)
  return inflateRaw(bytes)
}

async function inflateRaw(bytes: Uint8Array): Promise<string> {
  const Decompression = (globalThis as typeof globalThis & { DecompressionStream?: typeof DecompressionStream }).DecompressionStream
  if (!Decompression) throw new Error('このブラウザでは XLSX の展開に対応していません。CSV でアップロードしてください')
  const formats: Array<'deflate-raw' | 'deflate'> = ['deflate-raw', 'deflate']
  let lastError: unknown
  for (const format of formats) {
    try {
      const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new Decompression(format))
      return decoder.decode(await new Response(stream).arrayBuffer())
    } catch (e) {
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error('XLSX を展開できませんでした')
}

function parseSharedStrings(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return [...doc.getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join(''))
}

function parseWorksheet(xml: string, sharedStrings: string[]): string[][] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const rows: string[][] = []
  for (const row of [...doc.getElementsByTagName('row')]) {
    const cells: string[] = []
    for (const cell of [...row.getElementsByTagName('c')]) {
      const ref = cell.getAttribute('r') ?? ''
      const idx = colIndex(ref.replace(/\d+/g, ''))
      const type = cell.getAttribute('t')
      let value = ''
      if (type === 'inlineStr') {
        value = [...cell.getElementsByTagName('t')].map((t) => t.textContent ?? '').join('')
      } else {
        const raw = cell.getElementsByTagName('v')[0]?.textContent ?? ''
        value = type === 's' ? sharedStrings[Number(raw)] ?? '' : raw
      }
      cells[idx] = value.trim()
    }
    rows.push(cells)
  }
  return rows
}

function colIndex(col: string): number {
  let n = 0
  for (const ch of col.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64
  return Math.max(0, n - 1)
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n') {
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') cell += ch
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function parseRowsFromMatrix(rows: string[][]): ImportedMemberRow[] {
  const members: ImportedMemberRow[] = []
  let department = ''
  let section = ''
  for (const row of rows.slice(1)) {
    const nextDepartment = clean(row[1])
    const nextSection = clean(row[2])
    const name = clean(row[3])
    if (nextDepartment) {
      department = nextDepartment
      section = ''
    }
    if (nextSection) section = nextSection
    if (!name || name === '名前') continue
    members.push({ name, department, section })
  }
  if (members.length === 0) throw new Error('取り込めるメンバー行がありません')
  return members
}

function clean(value: unknown): string {
  return String(value ?? '').replace(/　/g, ' ').trim()
}