import dotenv from 'dotenv'
import { z } from 'zod'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Try project root .env first, then server/.env. User-provided API keys are
// supplied per request, so the server does not require a stored DeepSeek key.
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const EnvSchema = z.object({
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
  PORT: z.coerce.number().default(3000),
  UPLOAD_MAX_MB: z.coerce.number().int().positive().default(200),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Environment config error:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data
