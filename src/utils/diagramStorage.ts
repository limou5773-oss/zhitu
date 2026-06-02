const ANALYZER_STORAGE_PREFIX = 'project-analyzer:'

function isAnalyzerContext() {
  const source = `${window.location.search || ''}${window.location.hash || ''}`
  return /[?&](from=analyzer|embed=preview)(?:&|$)/.test(source)
}

export function writeAnalyzerDiagram(key: string, value: unknown) {
  const serialized = JSON.stringify(value)
  sessionStorage.setItem(key, serialized)
  localStorage.setItem(`${ANALYZER_STORAGE_PREFIX}${key}`, serialized)
}

export function readDiagramStorage(key: string) {
  const sessionValue = sessionStorage.getItem(key)
  if (sessionValue) return sessionValue
  if (!isAnalyzerContext()) return null
  return localStorage.getItem(`${ANALYZER_STORAGE_PREFIX}${key}`)
}
