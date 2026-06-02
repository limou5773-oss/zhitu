import { Router, Request, Response } from 'express'
import multer from 'multer'
import { GithubRequestSchema } from '../types/analysis.js'
import { extractZip } from '../services/zipService.js'
import { cloneRepo } from '../services/gitService.js'
import { cleanupProjectDir } from '../services/codeParser.js'
import { config } from '../config.js'

const router = Router()
const uploadMaxBytes = config.UPLOAD_MAX_MB * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadMaxBytes },
  fileFilter(_req, file, cb) {
    if (file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true)
    } else {
      cb(new Error('Only ZIP files are allowed'))
    }
  },
})

// POST /api/project/upload
router.post('/upload', (req: Request, res: Response) => {
  upload.single('file')(req, res, async (uploadErr: any) => {
    if (uploadErr) {
      const message = uploadErr.code === 'LIMIT_FILE_SIZE'
        ? `ZIP 文件不能超过 ${config.UPLOAD_MAX_MB}MB`
        : uploadErr.message || 'ZIP 上传失败'
      res.status(uploadErr.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message })
      return
    }

    try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const { projectId, projectDir, name } = extractZip(req.file.buffer, req.file.originalname)

    // Schedule cleanup
    cleanupProjectDir(projectDir)

    // Store projectDir mapping in memory (via app.locals)
    if (!req.app.locals.projects) req.app.locals.projects = {}
    req.app.locals.projects[projectId] = { projectDir, name }

    res.json({ projectId, name })
    } catch (err: any) {
      console.error('[upload] Error:', err)
      res.status(400).json({ error: err.message || 'Failed to process ZIP file' })
    }
  })
})

// POST /api/project/github
router.post('/github', async (req: Request, res: Response) => {
  try {
    const parsed = GithubRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
      return
    }

    const { repoUrl, branch, token } = parsed.data

    const { projectId, projectDir, name } = await cloneRepo(repoUrl, branch, token || undefined)

    // Schedule cleanup
    cleanupProjectDir(projectDir)

    // Store projectDir mapping
    if (!req.app.locals.projects) req.app.locals.projects = {}
    req.app.locals.projects[projectId] = { projectDir, name }

    res.json({ projectId, name })
  } catch (err: any) {
    console.error('[github] Error:', err)
    res.status(400).json({ error: err.message || 'Failed to clone repository' })
  }
})

export default router
