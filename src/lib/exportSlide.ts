import pptxgen from 'pptxgenjs'
import type { Slide, OptBreakdown } from '../data/application'
import { optKindMeta, optItemSeats, optDelta, optDeltaTerms, optAfterSeats, optNeedTerms, sectionVisible } from '../data/application'

const FONT = 'Meiryo'
const DARK = '1e2530'
const MUTED = '6B7688'
const LIGHT = 'F4F6FB'
const BORDER = 'E5E9F2'

export function exportAsPptx(slide: Slide, opt?: OptBreakdown): void {
  const prs = new pptxgen()
  prs.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches

  const s = prs.addSlide()
  s.background = { color: 'FFFFFF' }

  // ── Header bar
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 1.35,
    fill: { color: DARK },
    line: { type: 'none' },
  })
  s.addText(slide.software, {
    x: 0.35, y: 0.08, w: 8, h: 0.65,
    fontSize: 28, bold: true, color: 'FFFFFF', fontFace: FONT,
  })
  s.addText(`ライセンス申請書  /  ${slide.badge}`, {
    x: 0.35, y: 0.75, w: 7, h: 0.35,
    fontSize: 11, color: 'AAAAAA', fontFace: FONT,
  })
  s.addText(`${slide.vendor}  /  購入窓口：${slide.purchaseVia}`, {
    x: 8.3, y: 0.45, w: 4.7, h: 0.45,
    fontSize: 11, color: 'AAAAAA', align: 'right', fontFace: FONT,
  })

  // ── Alert
  let y = 1.5
  if (slide.alert) {
    s.addShape(prs.ShapeType.rect, {
      x: 0.2, y, w: 12.9, h: 0.45,
      fill: { color: 'FEF3C7' }, line: { color: 'FBB024', pt: 1 },
    })
    s.addText(slide.alert, {
      x: 0.35, y: y + 0.07, w: 12.6, h: 0.32,
      fontSize: 11, color: '92400E', fontFace: FONT,
    })
    y += 0.58
  }

  // ── Stats boxes
  const stats = [
    { label: '現在の契約本数', value: `${slide.currentSeats} 本` },
    { label: '増減申請本数', value: slide.requestSeats === 0 ? '変更なし' : `${slide.requestSeats > 0 ? '＋' : '−'}${Math.abs(slide.requestSeats)} 本` },
    { label: '申請・実施月', value: slide.requestDate },
    { label: '目標更新月', value: slide.targetRenewalDate },
  ]
  const bw = 3.08
  stats.forEach((st, i) => {
    const x = 0.2 + i * (bw + 0.1)
    s.addShape(prs.ShapeType.rect, {
      x, y, w: bw, h: 0.95,
      fill: { color: LIGHT }, line: { color: BORDER, pt: 1 },
    })
    s.addText(st.label, {
      x: x + 0.1, y: y + 0.1, w: bw - 0.2, h: 0.28,
      fontSize: 9, color: MUTED, align: 'center', fontFace: FONT,
    })
    s.addText(st.value, {
      x: x + 0.1, y: y + 0.42, w: bw - 0.2, h: 0.43,
      fontSize: 16, bold: true, color: DARK, align: 'center', fontFace: FONT,
    })
  })
  y += 1.1

  // ── Optimization breakdown（利用実態より：区分カード＋式）
  if (sectionVisible(slide, 'optBreakdown') && opt && Array.isArray(opt.items) && opt.items.length > 0) {
    const items = opt.items
    s.addText('最適化内訳（利用実態より）', { x: 0.2, y, w: 12.9, h: 0.27, fontSize: 9.5, bold: true, color: '0F6E56', fontFace: FONT })
    y += 0.3

    const n = items.length
    const gap = 0.1
    const cw = (12.9 - gap * (n - 1)) / n
    items.forEach((it, i) => {
      const x = 0.2 + i * (cw + gap)
      const seats = optItemSeats(it)
      const color = optKindMeta(it.kind).color.replace('#', '')
      const result = it.kind === 'remove' ? (it.people > 0 ? `${it.people}本 返却可` : '—')
        : it.kind === 'shared' ? `${seats}本（${it.ratio ?? 2}人で1本）`
        : `${seats}本`
      s.addShape(prs.ShapeType.rect, { x, y, w: cw, h: 0.3, fill: { color }, line: { type: 'none' } })
      s.addText(it.label, { x: x + 0.05, y: y + 0.02, w: cw - 0.1, h: 0.26, fontSize: 8.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: FONT })
      s.addShape(prs.ShapeType.rect, { x, y: y + 0.3, w: cw, h: 0.6, fill: { color: 'FFFFFF' }, line: { color: BORDER, pt: 1 } })
      s.addText([
        { text: `${it.people}`, options: { fontSize: 16, bold: true, color } },
        { text: ' 名', options: { fontSize: 9, color: MUTED } },
      ], { x: x + 0.05, y: y + 0.33, w: cw - 0.1, h: 0.3, align: 'center', fontFace: FONT })
      s.addText(`→ ${result}`, { x: x + 0.05, y: y + 0.63, w: cw - 0.1, h: 0.24, fontSize: 8.5, bold: true, color: DARK, align: 'center', fontFace: FONT })
    })
    y += 0.98

    // 削減申請本数 ／ 増加申請本数 ／ 申請後の本数
    const after = optAfterSeats(opt)
    const allDelta = optDeltaTerms(opt)
    const reductions = allDelta.filter((t) => t.sign === '-')
    const additions = allDelta.filter((t) => t.sign === '+')
    const reduceTotal = reductions.reduce((s, t) => s + t.value, 0)
    const addTotal = additions.reduce((s, t) => s + t.value, 0)
    if (reductions.length > 0) {
      s.addText(`削減申請本数 ＝ ${reductions.map((t) => `${t.label} ${t.value}`).join(' ＋ ')} ＝ ${reduceTotal}本`, {
        x: 0.2, y, w: 12.9, h: 0.26, fontSize: 10, bold: true, color: 'B91C1C', fontFace: FONT,
      })
      y += 0.3
    }
    if (additions.length > 0) {
      s.addText(`増加申請本数 ＝ ${additions.map((t) => `${t.label} ${t.value}`).join(' ＋ ')} ＝ ${addTotal}本`, {
        x: 0.2, y, w: 12.9, h: 0.26, fontSize: 10, bold: true, color: '2563EB', fontFace: FONT,
      })
      y += 0.3
    }
    const needs = optNeedTerms(opt)
    const needExpr = needs.length === 0 ? '—' : needs.map((t) => `${t.label} ${t.value}`).join(' ＋ ')
    s.addText(`申請後の本数 ＝ ${needExpr} ＝ ${after}本`, {
      x: 0.2, y, w: 12.9, h: 0.26, fontSize: 10, bold: true, color: '0F6E56', fontFace: FONT,
    })
    y += 0.38
  }

  // ── Cost note
  if (sectionVisible(slide, 'cost')) {
    s.addText('費用概算', { x: 0.2, y, w: 12.9, h: 0.27, fontSize: 9, bold: true, color: MUTED, fontFace: FONT })
    y += 0.27
    s.addShape(prs.ShapeType.rect, { x: 0.2, y, w: 12.9, h: 0.47, fill: { color: LIGHT }, line: { color: BORDER, pt: 1 } })
    s.addText(slide.costNote, { x: 0.35, y: y + 0.1, w: 12.5, h: 0.3, fontSize: 12, color: DARK, fontFace: FONT })
    y += 0.62
  }

  // ── Reason
  if (sectionVisible(slide, 'reason')) {
    s.addText('申請理由', { x: 0.2, y, w: 12.9, h: 0.27, fontSize: 9, bold: true, color: MUTED, fontFace: FONT })
    y += 0.27
    s.addShape(prs.ShapeType.rect, { x: 0.2, y, w: 12.9, h: 0.75, fill: { color: LIGHT }, line: { color: BORDER, pt: 1 } })
    s.addText(slide.reason, { x: 0.35, y: y + 0.08, w: 12.5, h: 0.6, fontSize: 11, color: DARK, wrap: true, fontFace: FONT })
    y += 0.9
  }

  // ── Schedule table
  if (sectionVisible(slide, 'schedule')) {
    s.addText('実施スケジュール', { x: 0.2, y, w: 12.9, h: 0.27, fontSize: 9, bold: true, color: MUTED, fontFace: FONT })
    y += 0.27

    const rows: pptxgen.TableRow[] = slide.actions.map((a) => ([
      { text: a.label, options: { bold: true, color: slide.badgeColor.replace('#', ''), fontFace: FONT, fontSize: 11 } },
      { text: a.detail, options: { color: DARK, fontFace: FONT, fontSize: 11 } },
    ]))
    s.addTable(rows, {
      x: 0.2, y, w: 12.9,
      colW: [3, 9.9], rowH: 0.4,
      fontSize: 11, fontFace: FONT,
      border: { type: 'solid', color: BORDER, pt: 1 },
      fill: { color: 'FFFFFF' },
    })
  }

  // ── Footer
  s.addText('AppManagement  ライセンス更新集約申請書  |  作成日：2026年6月26日', {
    x: 0, y: 7.22, w: 13.33, h: 0.25,
    fontSize: 9, color: 'BBBBBB', align: 'center', fontFace: FONT,
  })

  prs.writeFile({ fileName: `申請書_${slide.software}.pptx` })
}

export function exportAsPdf(): void {
  window.print()
}
