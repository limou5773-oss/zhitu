import { toPng, toSvg } from 'html-to-image'
import { saveAs } from 'file-saver'

export async function exportToPng(el: HTMLElement, filename: string) {
  try {
    const dataUrl = await toPng(el, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
    })
    const blob = await (await fetch(dataUrl)).blob()
    saveAs(blob, `${filename}.png`)
  } catch (err) {
    console.error('导出PNG失败:', err)
    throw err
  }
}

export async function exportToSvg(el: HTMLElement, filename: string) {
  try {
    const svgEl = el.matches('svg') ? (el as unknown as SVGSVGElement) : el.querySelector('svg')
    if (svgEl) {
      const clone = svgEl.cloneNode(true) as SVGSVGElement
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      const source = new XMLSerializer().serializeToString(clone)
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
      saveAs(blob, `${filename}.svg`)
      return
    }

    const dataUrl = await toSvg(el, {
      backgroundColor: '#ffffff',
    })
    const blob = await (await fetch(dataUrl)).blob()
    saveAs(blob, `${filename}.svg`)
  } catch (err) {
    console.error('导出SVG失败:', err)
    throw err
  }
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

export function downloadTextFile(content: string, filename: string, ext: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  saveAs(blob, `${filename}.${ext}`)
}
