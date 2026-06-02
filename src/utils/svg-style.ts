export const SVG_NS = 'http://www.w3.org/2000/svg'

export const BLACK = '#000'
export const WHITE = '#fff'
export const STROKE_WIDTH = 1.2
export const FONT_FAMILY = 'SimSun, 宋体, Songti SC, serif'

export const SVG_STYLE = `
  .node-rect { fill: #fff; stroke: #000; stroke-width: 1.2; }
  .node-ellipse { fill: #fff; stroke: #000; stroke-width: 1.2; }
  .node-diamond { fill: #fff; stroke: #000; stroke-width: 1.2; }
  .node-label { font-family: SimSun, 宋体, serif; fill: #000; text-anchor: middle; dominant-baseline: central; font-size: 13px; }
  .node-label-pk { font-family: SimSun, 宋体, serif; fill: #000; text-anchor: middle; dominant-baseline: central; font-size: 13px; text-decoration: underline; }
  .edge-line { stroke: #000; stroke-width: 1.2; fill: none; }
  .edge-dashed { stroke: #000; stroke-width: 1.2; fill: none; stroke-dasharray: 6 4; }
  .edge-dotted { stroke: #000; stroke-width: 1; fill: none; stroke-dasharray: 3 5; }
  .edge-label { font-family: SimSun, 宋体, serif; fill: #000; font-size: 12px; }
  .system-boundary { fill: none; stroke: #000; stroke-width: 1.2; stroke-dasharray: 6 4; }
  .system-label { font-family: SimSun, 宋体, serif; fill: #000; font-size: 13px; font-weight: bold; }
  .actor-text { font-family: SimSun, 宋体, serif; fill: #000; font-size: 13px; text-anchor: middle; }
  .cardinality { font-family: SimSun, 宋体, serif; fill: #000; font-size: 12px; font-weight: bold; }
`

export function makeArrowMarker(id: string) {
  return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="#000"/>
  </marker>`
}

export function buildSvg(w: number, h: number, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible" style="overflow:visible;">
  <defs>
    <style>${SVG_STYLE}</style>
    ${makeArrowMarker('arrow')}
    ${makeArrowMarker('arrow-small')}
  </defs>
  ${content}`
}

/** Estimate text width in SVG, roughly 7px per Chinese char, 6px per ASCII */
export function textWidth(text: string, fontSize = 13): number {
  let w = 0
  for (const ch of text) {
    w += /[一-鿿　-〿＀-￯]/.test(ch) ? fontSize : fontSize * 0.6
  }
  return w + 12
}
