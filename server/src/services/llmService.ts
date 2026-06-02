import axios from 'axios'
import https from 'https'
import type { DiagramType } from '../types/diagrams.js'
import { DiagramResultSchemas } from '../types/diagrams.js'
import { buildPrompt } from './promptBuilder.js'
import type { ProjectSummary } from '../types/analysis.js'
import { config } from '../config.js'

const MAX_RETRIES = 2

// Bypass system proxy — clear proxy env vars for this agent
const proxyEnvKeys = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy']
const savedEnv: Record<string, string | undefined> = {}
for (const key of proxyEnvKeys) {
  savedEnv[key] = process.env[key]
  delete process.env[key]
}
const httpsAgent = new https.Agent({ keepAlive: true })

export async function callLLM(
  type: DiagramType,
  summary: ProjectSummary,
  apiKey: string,
): Promise<unknown> {
  const trimmedApiKey = apiKey.trim()
  if (!trimmedApiKey) {
    throw new Error('DeepSeek API Key is required')
  }

  const { system, user } = buildPrompt(type, summary)

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        `${config.DEEPSEEK_BASE_URL}/v1/chat/completions`,
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        },
        {
          headers: {
            'Authorization': `Bearer ${trimmedApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120_000,
          httpsAgent,
        },
      )

      const raw = response.data.choices?.[0]?.message?.content?.trim() || ''

      // Strip markdown code fences if present
      let jsonStr = raw
      const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim()
      }

      const parsed = JSON.parse(jsonStr)

      // Validate with Zod
      const schema = DiagramResultSchemas[type]
      const result = schema.safeParse(parsed)

      if (result.success) {
        return result.data
      }

      if (attempt < MAX_RETRIES) {
        console.warn(`[LLM] Schema validation failed for ${type}, retrying (${attempt + 1}/${MAX_RETRIES}):`, result.error.flatten())
        continue
      }

      // Last attempt failed validation — return raw parsed data with warning
      console.error(`[LLM] Schema validation failed after retries for ${type}:`, result.error.flatten())
      return { ...parsed, _validationError: result.error.flatten() }

    } catch (err: any) {
      lastError = err
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        if (status && status < 500 && status !== 429) {
          // Client error — don't retry
          break
        }
      }
      if (attempt < MAX_RETRIES) {
        console.warn(`[LLM] Request failed for ${type}, retrying (${attempt + 1}/${MAX_RETRIES}):`, err.message)
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
    }
  }

  throw lastError || new Error(`LLM call failed for ${type}`)
}
