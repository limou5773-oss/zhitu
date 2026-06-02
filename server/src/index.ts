import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import projectRoutes from './routes/project.js'
import analyzeRoutes from './routes/analyze.js'

const app = express()

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`)
  next()
})

app.use(cors())
app.use(express.json({ limit: '200MB' }))
app.use(express.urlencoded({ extended: true, limit: '200MB' }))

// In-memory project storage
app.locals.projects = {}

// Routes — more specific paths must be mounted first
app.use('/api/project/analyze', analyzeRoutes)
app.use('/api/project', projectRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`)
  console.log(`DeepSeek API: ${config.DEEPSEEK_BASE_URL}`)
})
