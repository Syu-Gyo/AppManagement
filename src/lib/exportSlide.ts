import pptxgen from 'pptxgenjs'
import type { Slide, OptBreakdown } from '../data/application'
import { optKindMeta, optItemSeats, optDelta, optDeltaTerms, optAfterSeats, optNeedTerms, sectionVisible } from '../data/application'

const FONT = 'Meiryo'
const DARK = '1e2530'
const MUTED = '6B7688'
const LIGHT = 'F4F6FB'
const BORDER = 'E5E9F2'

export function exportAsPptx(slide: Slide, opt?: OptBreakdown, currentUsers?: number): void {
  const prs = new pptxgen()
  prs.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches

  const s = prs.addSlide()
  s.background = { color: 'FFFFFF' }

  // ── Header bar
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.8,
    fill: { color: DARK },
    line: { type: 'none' },
  })
  s.addText(slide.software, {
    x: 0.3, y: 0.1, w: 8, h: 0.4,
    fontSize: 22, bold: true, color: 'FFFFFF', fontFace: FONT,
  })
  s.addText(`ライセンス申請書  |  ${slide.badge}`, {
    x: 0.3, y: 0.5, w: 7, h: 0.2,
    fontSize: 10, color: 'AAAAAA', fontFace: FONT,
  })

  // Right side of header: requestDate, targetRenewalDate, vendor
  const headerRight = `申請・実施月：${slide.requestDate || '—'}  |  目標更新月：${slide.targetRenewalDate || '—'}\n${slide.vendor}  /  購入窓口：${slide.purchaseVia}`
  s.addText(headerRight, {
    x: 6.0, y: 0.15, w: 7.0, h: 0.5,
    fontSize: 9, color: 'CCCCCC', align: 'right', fontFace: FONT,
  })

  let y = 1.0

  // ── Alert
  if (slide.alert) {
    s.addShape(prs.ShapeType.rect, {
      x: 0.2, y, w: 12.9, h: 0.4,
      fill: { color: 'FEF3C7' }, line: { color: 'FBB024', pt: 1 },
    })
    s.addText(slide.alert, {
      x: 0.35, y: y + 0.05, w: 12.6, h: 0.3,
      fontSize: 10, color: '92400E', fontFace: FONT,
    })
    y += 0.55
  }

  // ── Pre-calculate heights for dynamic spacing
  let contentHeight = 0
  let visibleSectionsCount = 0

  // Flow is always 0.8
  contentHeight += 0.8
  visibleSectionsCount++

  if (sectionVisible(slide, 'userAnalysis')) {
    contentHeight += 0.95
    visibleSectionsCount++
  }

  let optBreakdownActive = sectionVisible(slide, 'optBreakdown') && opt && Array.isArray(opt.items) && opt.items.length > 0
  if (optBreakdownActive) {
    const allDelta = optDeltaTerms(opt!)
    let linesCount = 1
    if (allDelta.filter((t) => t.sign === '-').length > 0) linesCount++
    if (allDelta.filter((t) => t.sign === '+').length > 0) linesCount++
    contentHeight += 1.1 + linesCount * 0.2
    visibleSectionsCount++
  }

  const hasCost = sectionVisible(slide, 'cost')
  const hasReason = sectionVisible(slide, 'reason')
  const hasSchedule = sectionVisible(slide, 'schedule')

  if (hasCost || hasReason || hasSchedule) {
    const leftH = (hasCost ? 0.8 : 0) + (hasReason ? 0.95 : 0)
    const rightH = hasSchedule ? 0.25 + 0.3 * slide.actions.length : 0
    contentHeight += Math.max(leftH, rightH)
    visibleSectionsCount++
  }

  const availableHeight = 6.9 - y
  let gap = visibleSectionsCount > 1 ? Math.max(0.15, (availableHeight - contentHeight) / (visibleSectionsCount - 1)) : 0.15
  if (gap > 0.6) gap = 0.6
  
  // Center vertically if there is leftover space
  const totalWithGaps = contentHeight + gap * (visibleSectionsCount - 1)
  if (totalWithGaps < availableHeight) {
    y += (availableHeight - totalWithGaps) / 2
  }

  // ── Stats Flow (現在の契約本数 → 増減申請本数 → 申請後の本数)
  const drawFlowNode = (x: number, topY: number, w: number, h: number, label: string, value: string, color: string, hero: boolean) => {
    s.addShape(prs.ShapeType.rect, {
      x, y: topY, w, h,
      fill: { color: hero ? 'F0FDF4' : 'FFFFFF' },
      line: { color: hero ? 'BBF7D0' : BORDER, pt: 1 },
    })
    s.addText(label, { x: x + 0.1, y: topY + 0.1, w: w - 0.2, h: 0.2, fontSize: 10, color: hero ? '15803D' : MUTED, align: 'center', fontFace: FONT, bold: true })
    s.addText(value, { x: x + 0.1, y: topY + 0.3, w: w - 0.2, h: 0.4, fontSize: 20, color: color, align: 'center', fontFace: FONT, bold: true })
  }

  const drawArrow = (x: number, topY: number, color: string) => {
    s.addText('→', { x, y: topY, w: 0.6, h: 0.8, fontSize: 24, color: color, align: 'center', fontFace: FONT, bold: true })
  }

  const reqStr = slide.requestSeats === 0 ? '変更なし' : `${slide.requestSeats > 0 ? '＋' : '−'}${Math.abs(slide.requestSeats)} 本`
  const reqColor = slide.requestSeats === 0 ? MUTED : (slide.requestSeats > 0 ? slide.badgeColor.replace('#', '') : 'E11D48')

  drawFlowNode(0.2, y, 3.9, 0.8, '現在の契約本数', `${slide.currentSeats} 本`, DARK, false)
  drawArrow(4.1, y, reqColor)
  drawFlowNode(4.7, y, 3.9, 0.8, '増減申請本数', reqStr, reqColor, false)
  drawArrow(8.6, y, '16A34A')
  drawFlowNode(9.2, y, 3.9, 0.8, '申請後の本数', `${slide.currentSeats + slide.requestSeats} 本`, '15803D', true)

  y += 0.8 + gap

  // ── 利用人数分析 (User Analysis)
  if (sectionVisible(slide, 'userAnalysis')) {
    s.addText('利用人数分析', { x: 0.2, y, w: 12.9, h: 0.2, fontSize: 9.5, bold: true, color: slide.badgeColor.replace('#', ''), fontFace: FONT })
    y += 0.25

    const drawUserNode = (x: number, topY: number, w: number, h: number, label: string, value: string, color: string, bgColor: string, borderColor: string, sub?: string, subColor?: string) => {
      s.addShape(prs.ShapeType.rect, { x, y: topY, w, h, fill: { color: bgColor }, line: { color: borderColor, pt: 1 } })
      s.addText(label, { x: x + 0.1, y: topY + 0.05, w: w - 0.2, h: 0.2, fontSize: 9, color: MUTED, align: 'center', fontFace: FONT })
      s.addText(value, { x: x + 0.1, y: topY + 0.25, w: w - 0.2, h: 0.35, fontSize: 16, color: color, align: 'center', fontFace: FONT, bold: true })
      if (sub) {
        s.addText(sub, { x: x + 0.1, y: topY + 0.55, w: w - 0.2, h: 0.2, fontSize: 9, color: subColor || color, align: 'center', fontFace: FONT })
      }
    }

    const cUsers = currentUsers ?? slide.currentSeats // Fallback
    const delta = slide.userDelta ?? 0
    const additionalSeats = delta
    const pct = slide.currentSeats > 0 ? Math.round(Math.abs(additionalSeats / slide.currentSeats) * 100) : 0

    const cw = 3.15
    const gap = 0.1
    let cx = 0.2

    drawUserNode(cx, y, cw, 0.75, '現在の利用者数', `${cUsers} 名`, DARK, LIGHT, BORDER)
    cx += cw + gap
    drawUserNode(cx, y, cw, 0.75, '現在の契約本数', `${slide.currentSeats} 本`, DARK, LIGHT, BORDER)
    cx += cw + gap

    const deltaStr = delta === 0 ? '±0 名' : (delta > 0 ? `＋${delta} 名` : `${delta} 名`)
    const deltaColor = delta > 0 ? '15803D' : (delta < 0 ? 'E11D48' : DARK)
    const deltaBg = delta > 0 ? 'F0FDF4' : (delta < 0 ? 'FFF1F2' : LIGHT)
    const deltaBd = delta > 0 ? 'BBF7D0' : (delta < 0 ? 'FECDD3' : BORDER)
    drawUserNode(cx, y, cw, 0.75, '人数の増減', deltaStr, deltaColor, deltaBg, deltaBd)
    cx += cw + gap

    const addStr = additionalSeats === 0 ? '±0 本' : (additionalSeats > 0 ? `＋${additionalSeats} 本` : `${additionalSeats} 本`)
    const subStr = additionalSeats === 0 ? undefined : `${additionalSeats > 0 ? '＋' : '−'}${pct}% ${additionalSeats > 0 ? '増加' : '削減'}`
    const subColor = additionalSeats > 0 ? '16A34A' : 'E11D48'
    drawUserNode(cx, y, cw, 0.75, '追加本数目安', addStr, deltaColor, deltaBg, deltaBd, subStr, subColor)

    y += 0.75 + gap
  }

  // ── 最適化内訳
  if (sectionVisible(slide, 'optBreakdown') && opt && Array.isArray(opt.items) && opt.items.length > 0) {
    const items = opt.items
    s.addText('最適化内訳（利用実態より）', { x: 0.2, y, w: 12.9, h: 0.2, fontSize: 9.5, bold: true, color: '0F6E56', fontFace: FONT })
    y += 0.25

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
      s.addShape(prs.ShapeType.rect, { x, y, w: cw, h: 0.25, fill: { color }, line: { type: 'none' } })
      s.addText(it.label, { x: x, y: y, w: cw, h: 0.25, fontSize: 8.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: FONT })
      s.addShape(prs.ShapeType.rect, { x, y: y + 0.25, w: cw, h: 0.5, fill: { color: 'FFFFFF' }, line: { color: BORDER, pt: 1 } })
      if (it.kind === 'reserve') {
        s.addText(`${seats} 本`, { x: x, y: y + 0.3, w: cw, h: 0.25, fontSize: 14, bold: true, color, align: 'center', fontFace: FONT })
        s.addText(`→ 追加`, { x: x, y: y + 0.55, w: cw, h: 0.2, fontSize: 8.5, bold: true, color: DARK, align: 'center', fontFace: FONT })
      } else {
        s.addText(`${it.people} 名`, { x: x, y: y + 0.3, w: cw, h: 0.25, fontSize: 14, bold: true, color, align: 'center', fontFace: FONT })
        s.addText(`→ ${result}`, { x: x, y: y + 0.55, w: cw, h: 0.2, fontSize: 8.5, bold: true, color: DARK, align: 'center', fontFace: FONT })
      }
    })
    y += 0.85

    // 式
    const after = optAfterSeats(opt)
    const allDelta = optDeltaTerms(opt)
    const reductions = allDelta.filter((t) => t.sign === '-')
    const additions = allDelta.filter((t) => t.sign === '+')
    const reduceTotal = reductions.reduce((s, t) => s + t.value, 0)
    const addTotal = additions.reduce((s, t) => s + t.value, 0)

    let exprLines = []
    if (reductions.length > 0) exprLines.push(`削減申請本数 ＝ ${reductions.map((t) => `${t.label} ${t.value}`).join(' ＋ ')} ＝ ${reduceTotal}本`)
    if (additions.length > 0) exprLines.push(`増加申請本数 ＝ ${additions.map((t) => `${t.label} ${t.value}`).join(' ＋ ')} ＝ ${addTotal}本`)
    const needs = optNeedTerms(opt)
    const needExpr = needs.length === 0 ? '—' : needs.map((t) => `${t.label} ${t.value}`).join(' ＋ ')
    exprLines.push(`申請後の本数 ＝ ${needExpr} ＝ ${after}本`)

    s.addShape(prs.ShapeType.rect, { x: 0.2, y, w: 12.9, h: 0.15 + exprLines.length * 0.2, fill: { color: LIGHT }, line: { color: BORDER, pt: 1 } })
    exprLines.forEach((line, i) => {
      let color = line.startsWith('削減') ? 'B91C1C' : line.startsWith('増加') ? '2563EB' : '0F6E56'
      s.addText(line, { x: 0.3, y: y + 0.05 + i * 0.2, w: 12.7, h: 0.2, fontSize: 9, bold: true, color: color, fontFace: FONT })
    })
    y += 0.15 + exprLines.length * 0.2 + gap
  }

  // ── Bottom Sections (費用, 理由, 予定)
  // Split into 2 columns: Left (Cost, Reason), Right (Schedule)
  const leftX = 0.2
  const leftW = 6.35
  const rightX = 6.75
  const rightW = 6.35
  let leftY = y
  let rightY = y

  if (sectionVisible(slide, 'cost')) {
    s.addText('費用概算', { x: leftX, y: leftY, w: leftW, h: 0.2, fontSize: 9, bold: true, color: MUTED, fontFace: FONT })
    leftY += 0.25
    s.addShape(prs.ShapeType.rect, { x: leftX, y: leftY, w: leftW, h: 0.4, fill: { color: LIGHT }, line: { color: BORDER, pt: 1 } })
    s.addText(slide.costNote, { x: leftX + 0.1, y: leftY + 0.05, w: leftW - 0.2, h: 0.3, fontSize: 11, color: DARK, fontFace: FONT })
    leftY += 0.55
  }

  if (sectionVisible(slide, 'reason')) {
    s.addText('申請理由', { x: leftX, y: leftY, w: leftW, h: 0.2, fontSize: 9, bold: true, color: MUTED, fontFace: FONT })
    leftY += 0.25
    s.addShape(prs.ShapeType.rect, { x: leftX, y: leftY, w: leftW, h: 0.7, fill: { color: LIGHT }, line: { color: BORDER, pt: 1 } })
    s.addText(slide.reason, { x: leftX + 0.1, y: leftY + 0.05, w: leftW - 0.2, h: 0.6, fontSize: 10, color: DARK, wrap: true, fontFace: FONT })
  }

  if (sectionVisible(slide, 'schedule')) {
    s.addText('実施スケジュール', { x: rightX, y: rightY, w: rightW, h: 0.2, fontSize: 9, bold: true, color: MUTED, fontFace: FONT })
    rightY += 0.25

    const rows: pptxgen.TableRow[] = slide.actions.map((a) => ([
      { text: a.label, options: { bold: true, color: slide.badgeColor.replace('#', ''), fontFace: FONT, fontSize: 10 } },
      { text: a.detail, options: { color: DARK, fontFace: FONT, fontSize: 10 } },
    ]))
    s.addTable(rows, {
      x: rightX, y: rightY, w: rightW,
      colW: [1.8, 4.55], rowH: 0.3,
      fontSize: 10, fontFace: FONT,
      border: { type: 'solid', color: BORDER, pt: 1 },
      fill: { color: 'FFFFFF' },
    })
  }

  // ── Footer
  s.addText('AppManagement  ライセンス更新集約申請書', {
    x: 0, y: 7.22, w: 13.33, h: 0.25,
    fontSize: 9, color: 'BBBBBB', align: 'center', fontFace: FONT,
  })

  prs.writeFile({ fileName: `申請書_${slide.software}.pptx` })
}

export async function exportAsPdf(software: string = 'App'): Promise<void> {
  try {
    const el = document.getElementById('print-slide-container')
    if (!el) {
      alert('プレビュー要素が見つかりません')
      return
    }

    const html2canvas = (await import('html2canvas')).default
    const { jsPDF } = await import('jspdf')

    // Capture the element
    const canvas = await html2canvas(el, { scale: 2, useCORS: true })
    const imgData = canvas.toDataURL('image/jpeg', 1.0)

    // Calculate A4 size in mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`申請書_${software}.pdf`)
  } catch (err) {
    console.error(err)
    alert('PDFの生成に失敗しました。')
  }
}
