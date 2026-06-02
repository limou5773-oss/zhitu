import { Router, Request, Response } from 'express'
import { AnalyzeRequestSchema } from '../types/analysis.js'
import { parseProject } from '../services/codeParser.js'
import { callLLM } from '../services/llmService.js'
import { buildFallbackDiagram } from '../services/diagramFallback.js'
import { normalizeDiagramResult } from '../services/diagramNormalizer.js'
import type { DiagramType } from '../types/diagrams.js'

const router = Router()

function getRequestApiKey(req: Request): string {
  const headerKey = req.header('x-deepseek-api-key') || req.header('x-api-key')
  if (headerKey?.trim()) return headerKey.trim()

  const auth = req.header('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim()

  return ''
}

// POST /api/project/analyze
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = AnalyzeRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
      return
    }

    const { projectId, diagramTypes, mode } = parsed.data
    const apiKey = getRequestApiKey(req)
    if (!apiKey) {
      res.status(400).json({ error: '请先输入 DeepSeek API Key' })
      return
    }

    // Resolve project directory
    const projects = req.app.locals.projects || {}
    const proj = projects[projectId]
    if (!proj) {
      res.status(404).json({ error: 'Project not found. The project may have expired. Please re-upload.' })
      return
    }

    const projectDir: string = proj.projectDir

    // Step 1: Parse project → build summary
    console.log(`[analyze] Parsing project: ${projectDir} (mode: ${mode})`)
    const summary = parseProject(projectDir, mode)
    console.log(`[analyze] Summary built: ${summary.controllers.length} controllers, ${summary.entities.length} entities, ${summary.sqlTables.length} tables`)

    // Step 2: Call LLM for each diagram type in parallel
    const results: Record<string, unknown> = {}
    const errors: { diagramType: string; error: string }[] = []
    const warnings: { diagramType: string; message: string }[] = []

    const tasks = diagramTypes.map(async (type: DiagramType) => {
      try {
        console.log(`[analyze] Calling LLM for: ${type}`)
        const rawResult = await callLLM(type, summary, apiKey)
        const normalized = normalizeDiagramResult(type, rawResult, summary)
        results[type] = normalized.data
        if (normalized.warning) {
          warnings.push({ diagramType: type, message: normalized.warning })
        }
        console.log(`[analyze] LLM result received for: ${type}`)
      } catch (err: any) {
        console.error(`[analyze] LLM failed for ${type}:`, err.message)
        results[type] = buildFallbackDiagram(type, summary)
        warnings.push({
          diagramType: type,
          message: `AI 生成失败，已使用项目结构兜底生成：${err.message || 'LLM call failed'}`,
        })
      }
    })

    await Promise.allSettled(tasks)

    const response = {
      success: Object.keys(results).length > 0,
      results: Object.keys(results).length > 0 ? results : undefined,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      summary,
    }

    res.json(response)
  } catch (err: any) {
    console.error('[analyze] Error:', err)
    res.status(500).json({ error: err.message || 'Analysis failed' })
  }
})

export default router
