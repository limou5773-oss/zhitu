import fs from 'fs-extra'
import path from 'path'
import type { ProjectSummary } from '../types/analysis.js'

const IGNORE_DIRS = new Set([
  'node_modules', 'dist', 'build', 'target', '.git', 'logs', '__pycache__', 'vendor',
  '.idea', '.vscode', '.settings', 'bin', 'obj',
])

const IGNORE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico', '.webp',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
  '.ttf', '.woff', '.woff2', '.eot', '.otf',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.class', '.jar', '.war',
  '.min.js', '.map', '.lock',
])

const BINARY_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
])

const MAX_FILE_SIZE = 200 * 1024 // 200KB
const MAX_FILE_COUNT = 5000
const LARGE_FILE_SIZE = 500 * 1024 // 500KB

function isIgnoredDir(dirname: string): boolean {
  return IGNORE_DIRS.has(dirname) || dirname.startsWith('.')
}

function isIgnoredFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  if (IGNORE_EXTENSIONS.has(ext) || BINARY_EXTENSIONS.has(ext)) return true
  return false
}

function detectTechStack(files: string[]): string[] {
  const stack: string[] = []
  const allPaths = files.join('\n')
  if (allPaths.includes('pom.xml')) stack.push('SpringBoot')
  if (allPaths.includes('build.gradle') || allPaths.includes('build.gradle.kts')) stack.push('Gradle')
  if (allPaths.includes('package.json')) {
    try {
      const pkgIdx = files.findIndex(f => f.endsWith('package.json') && !f.includes('node_modules'))
      if (pkgIdx >= 0) {
        // Just flag it; actual parsing done elsewhere
      }
    } catch {}
    stack.push('Node')
  }
  if (allPaths.includes('vue') || files.some(f => f.endsWith('.vue'))) stack.push('Vue')
  if (files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx'))) stack.push('React')
  if (allPaths.includes('go.mod')) stack.push('Go')
  if (allPaths.includes('requirements.txt') || allPaths.includes('Pipfile')) stack.push('Python')
  return stack
}

function extractJavaController(filePath: string, content: string) {
  const controllers: ProjectSummary['controllers'] = []
  const classNameMatch = content.match(/public\s+class\s+(\w+)\s*\{/)
  if (!classNameMatch) return controllers
  const className = classNameMatch[1]

  const isController = /@RestController|@Controller/.test(content)
  if (!isController) return controllers

  const requestMapping = content.match(/@RequestMapping\s*\(\s*"?([^")]+)"?\s*\)/)
  const basePath = requestMapping?.[1] || ''

  const methodPattern = /@(?:Get|Post|Put|Delete|Patch)Mapping\s*\(\s*"?([^")]*)"?\s*\)\s*\n\s*(?:@\w+\s*\([^)]*\)\s*\n\s*)*public\s+\S+\s+(\w+)/g
  const methods: string[] = []
  let m
  while ((m = methodPattern.exec(content)) !== null) {
    const path = m[1] || ''
    const methodName = m[2]
    const annotation = m[0].match(/@(\w+)Mapping/)![1].toUpperCase()
    methods.push(`${annotation} ${path}${path ? ' ' : ''}(${methodName})`)
  }

  if (className && (isController || methods.length > 0)) {
    controllers.push({ className, basePath, methods })
  }
  return controllers
}

function extractJavaService(filePath: string, content: string) {
  const services: ProjectSummary['services'] = []
  const classNameMatch = content.match(/public\s+class\s+(\w+)\s*\{/)
  if (!classNameMatch) return services
  const className = classNameMatch[1]

  const isService = /@Service/.test(content) || className.endsWith('Service') || className.endsWith('ServiceImpl')
  if (!isService) return services

  const methodPattern = /public\s+\S+\s+(\w+)\s*\(/g
  const methods: string[] = []
  let m
  while ((m = methodPattern.exec(content)) !== null) {
    methods.push(m[1])
  }
  services.push({ className, methods })
  return services
}

function extractJavaEntity(filePath: string, content: string) {
  const entities: ProjectSummary['entities'] = []
  const classNameMatch = content.match(/public\s+class\s+(\w+)\s*\{/)
  if (!classNameMatch) return entities
  const className = classNameMatch[1]

  const isEntity = /@Entity|@Table/.test(content)
  if (!isEntity) return entities

  const tableMatch = content.match(/@Table\s*\([^)]*name\s*=\s*"([^"]+)"/)
  const tableName = tableMatch?.[1]

  const fieldPattern = /(?:@Column\s*\([^)]*\)\s*\n\s*)?(?:@\w+\s*(?:\([^)]*\))?\s*\n\s*)*private\s+(\w+(?:<[^>]+>)?)\s+(\w+)/g
  const fields: ProjectSummary['entities'][number]['fields'] = []
  let f
  while ((f = fieldPattern.exec(content)) !== null) {
    const isPK = /@Id/.test(content.substring(Math.max(0, f.index - 100), f.index))
    fields.push({ name: f[2], type: f[1], isPK })
  }
  if (fields.length > 0) {
    entities.push({ className, tableName, fields })
  }
  return entities
}

function extractSqlTables(filePath: string, content: string) {
  const tables: ProjectSummary['sqlTables'] = []
  const createPattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(([\s\S]*?)\);/gi
  let t
  while ((t = createPattern.exec(content)) !== null) {
    const tableName = t[1]
    const body = t[2]
    const columns: ProjectSummary['sqlTables'][number]['columns'] = []
    const colPattern = /[`"]?(\w+)[`"]?\s+(\w+(?:\(\d+(?:,\d+)?\))?)([\s\S]*?)(?:,|\n|$)/g
    const commentMatch = body.match(/COMMENT\s*=\s*'([^']+)'/i)
    let c
    while ((c = colPattern.exec(body)) !== null) {
      const colName = c[1]
      const colType = c[2]
      const rest = c[3] || ''
      const isPK = /PRIMARY\s+KEY/i.test(rest)
      const colComment = rest.match(/COMMENT\s+'([^']+)'/i)
      columns.push({
        name: colName,
        type: colType,
        comment: colComment?.[1],
        isPK,
      })
    }
    if (columns.length > 0) {
      tables.push({ tableName, comment: commentMatch?.[1], columns })
    }
  }
  return tables
}

function extractVueRoutes(filePath: string, content: string) {
  const routes: ProjectSummary['routes'] = []
  const routePattern = /\{\s*(?:path:\s*['"]([^'"]+)['"],\s*(?:name:\s*['"][^'"]*['"],\s*)?)?component:\s*(?:\(\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)|(\w+))\s*(?:,\s*meta:\s*(\{[^}]+\}))?\s*\}/g
  let r
  while ((r = routePattern.exec(content)) !== null) {
    let meta = {}
    const metaStr = r[4]
    if (metaStr) {
      try {
        const cleaned = metaStr.replace(/(\w+):/g, '"$1":')
        meta = JSON.parse(cleaned)
      } catch {}
    }
    routes.push({
      path: r[1] || '/',
      component: r[2] || r[3],
      meta,
    })
  }
  // Fallback: collect path string patterns for simpler route definitions
  if (routes.length === 0) {
    const pathPattern = /path:\s*['"]([^'"]+)['"]/g
    let p
    while ((p = pathPattern.exec(content)) !== null) {
      routes.push({ path: p[1] })
    }
  }
  return routes
}

function extractVueMenus(filePath: string, content: string) {
  const menus: ProjectSummary['menus'] = []
  // Look for menu arrays in config files
  const menuPattern = /\{\s*(?:name|title):\s*['"]([^'"]+)['"],\s*(?:path|url):\s*['"]([^'"]+)['"]/g
  let m
  while ((m = menuPattern.exec(content)) !== null) {
    menus.push({ name: m[1], path: m[2] })
  }
  return menus
}

function extractApis(filePath: string, content: string) {
  const apis: ProjectSummary['apis'] = []
  // Match Vue/React API calls: axios/fetch with URL
  const axiosPattern = /(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi
  let a
  while ((a = axiosPattern.exec(content)) !== null) {
    const method = a[0].match(/(\w+)\s*\(/)?.[1]?.toUpperCase() || 'GET'
    apis.push({ method, url: a[1] })
  }
  // Match fetch calls
  const fetchPattern = /fetch\s*\(\s*['"]([^'"]+)['"]/gi
  let f
  while ((f = fetchPattern.exec(content)) !== null) {
    apis.push({ method: 'GET', url: f[1] })
  }
  return apis
}

function readFileSafe(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > LARGE_FILE_SIZE) {
      // Only return signatures for very large files
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      const sigLines = lines.filter(l =>
        /\b(class|interface|enum|public|private|protected|function|def|export|@\w+)\b/.test(l)
      )
      return sigLines.slice(0, 200).join('\n')
    }
    if (stat.size > MAX_FILE_SIZE) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      // Return class/method/annotation/field lines only
      const keyLines = lines.filter(l =>
        /\b(class|interface|enum|public|private|protected|function|def|export|@\w+|CREATE TABLE|ALTER TABLE)\b/.test(l)
      )
      return keyLines.slice(0, 300).join('\n')
    }
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

export function parseProject(projectDir: string, mode: 'fast' | 'deep'): ProjectSummary {
  const projectName = path.basename(projectDir)
  const summary: ProjectSummary = {
    projectName,
    techStack: [],
    directories: [],
    controllers: [],
    services: [],
    entities: [],
    sqlTables: [],
    routes: [],
    menus: [],
    apis: [],
  }

  const allFiles: string[] = []
  let fileCount = 0

  function walk(dir: string) {
    if (fileCount >= MAX_FILE_COUNT) return
    try {
      const entries = fs.readdirSync(dir)
      for (const entry of entries) {
        if (fileCount >= MAX_FILE_COUNT) break
        const fullPath = path.join(dir, entry)
        if (isIgnoredDir(entry)) continue

        let stat
        try { stat = fs.statSync(fullPath) } catch { continue }

        if (stat.isDirectory()) {
          summary.directories.push(path.relative(projectDir, fullPath).replace(/\\/g, '/'))
          walk(fullPath)
        } else if (stat.isFile()) {
          if (isIgnoredFile(entry)) continue
          fileCount++
          allFiles.push(fullPath)
        }
      }
    } catch {}
  }

  walk(projectDir)
  summary.techStack = detectTechStack(allFiles)

  for (const filePath of allFiles) {
    const ext = path.extname(filePath).toLowerCase()
    const content = readFileSafe(filePath)
    if (!content) continue

    // Java files
    if (ext === '.java') {
      summary.controllers.push(...extractJavaController(filePath, content))
      if (mode === 'deep') {
        summary.services.push(...extractJavaService(filePath, content))
      }
      summary.entities.push(...extractJavaEntity(filePath, content))
    }

    // SQL files
    if (ext === '.sql') {
      summary.sqlTables.push(...extractSqlTables(filePath, content))
    }

    // Vue/TS/JS route files
    if (filePath.includes('router') && (ext === '.ts' || ext === '.js')) {
      summary.routes.push(...extractVueRoutes(filePath, content))
    }

    // API files
    if (filePath.includes('/api/') || filePath.includes('\\api\\')) {
      summary.apis.push(...extractApis(filePath, content))
    }

    // Menu config
    if (filePath.includes('menu') || filePath.includes('nav')) {
      summary.menus.push(...extractVueMenus(filePath, content))
    }
  }

  // Deduplicate APIs
  const seen = new Set<string>()
  summary.apis = summary.apis.filter(a => {
    const key = `${a.method}:${a.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return summary
}

export function cleanupProjectDir(projectDir: string): void {
  const delay = 30 * 60 * 1000 // 30 minutes
  setTimeout(() => {
    try {
      fs.removeSync(projectDir)
      console.log(`Cleaned up: ${projectDir}`)
    } catch (e) {
      console.error(`Failed to cleanup ${projectDir}:`, e)
    }
  }, delay)
}
