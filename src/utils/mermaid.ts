import mermaid from 'mermaid'

let initialized = false

export function initMermaid() {
  if (initialized) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'loose',
    fontFamily: 'SimSun, 宋体, Songti SC, serif',
    themeVariables: {
      primaryColor: '#ffffff',
      primaryTextColor: '#000000',
      primaryBorderColor: '#000000',
      lineColor: '#000000',
      textColor: '#000000',
      background: '#ffffff',
      mainBkg: '#ffffff',
      secondBkg: '#ffffff',
      tertiaryBkg: '#ffffff',
      actorBkg: '#ffffff',
      actorBorder: '#000000',
      actorTextColor: '#000000',
      actorLineColor: '#000000',
      signalColor: '#000000',
      signalTextColor: '#000000',
      labelBoxBkgColor: '#ffffff',
      labelBoxBorderColor: '#000000',
      labelTextColor: '#000000',
      loopTextColor: '#000000',
      noteBkgColor: '#ffffff',
      noteTextColor: '#000000',
      noteBorderColor: '#000000',
      activationBkgColor: '#f0f0f0',
      activationBorderColor: '#000000',
      sequenceNumberColor: '#000000',
    },
    flowchart: {
      htmlLabels: true,
      curve: 'linear',
    },
    sequence: {
      diagramMarginX: 50,
      diagramMarginY: 10,
      actorMargin: 60,
      width: 140,
      height: 50,
      boxMargin: 10,
      mirrorActors: false,
    },
    er: {
      diagramPadding: 20,
    },
  })
  initialized = true
}

export async function renderMermaid(code: string, element: HTMLElement): Promise<void> {
  initMermaid()
  const id = 'mermaid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
  try {
    const { svg } = await mermaid.render(id, code)
    element.innerHTML = svg
  } catch (err: any) {
    element.innerHTML = `<div style="color:#c00;padding:20px;text-align:center;font-family:SimSun,serif;background:#fff;border:1px solid #c00;">
      <p>图表渲染失败，请检查输入内容</p>
      <p style="font-size:12px;color:#666;margin-top:8px;">${err.message || ''}</p>
    </div>`
    console.error('Mermaid渲染错误:', err)
  }
}
