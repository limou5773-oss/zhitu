import { z } from 'zod'
import { DiagramTypeSchema } from './diagrams.js'

// ==================== 项目摘要结构 ====================
export const ControllerSummarySchema = z.object({
  className: z.string(),
  basePath: z.string(),
  methods: z.array(z.string()),
})

export const ServiceSummarySchema = z.object({
  className: z.string(),
  methods: z.array(z.string()),
})

export const EntityFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  isPK: z.boolean(),
})

export const EntitySummarySchema = z.object({
  className: z.string(),
  tableName: z.string().optional(),
  fields: z.array(EntityFieldSchema),
})

export const SqlColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
  comment: z.string().optional(),
  isPK: z.boolean(),
})

export const SqlTableSchema = z.object({
  tableName: z.string(),
  comment: z.string().optional(),
  columns: z.array(SqlColumnSchema),
})

export const RouteSummarySchema = z.object({
  path: z.string(),
  component: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
})

export interface MenuSummary {
  name: string
  path: string
  children?: MenuSummary[]
}

export const MenuSummarySchema: z.ZodType<MenuSummary> = z.object({
  name: z.string(),
  path: z.string(),
  children: z.array(z.lazy(() => MenuSummarySchema)).optional(),
})

export const ApiSummarySchema = z.object({
  method: z.string(),
  url: z.string(),
  description: z.string().optional(),
})

export const ProjectSummarySchema = z.object({
  projectName: z.string(),
  techStack: z.array(z.string()),
  directories: z.array(z.string()),
  controllers: z.array(ControllerSummarySchema),
  services: z.array(ServiceSummarySchema),
  entities: z.array(EntitySummarySchema),
  sqlTables: z.array(SqlTableSchema),
  routes: z.array(RouteSummarySchema),
  menus: z.array(MenuSummarySchema),
  apis: z.array(ApiSummarySchema),
})

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>

// ==================== API 请求/响应 ====================
export const AnalysisModeSchema = z.enum(['fast', 'deep'])

export const AnalyzeRequestSchema = z.object({
  projectId: z.string().min(1),
  diagramTypes: z.array(DiagramTypeSchema).min(1),
  mode: AnalysisModeSchema.default('fast'),
  model: z.string().default('deepseek'),
})

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>

export const GithubRequestSchema = z.object({
  repoUrl: z.string().url(),
  branch: z.string().default('main'),
  token: z.string().optional(),
})

export type GithubRequest = z.infer<typeof GithubRequestSchema>

export const ProjectResponseSchema = z.object({
  projectId: z.string(),
  name: z.string(),
})

export type ProjectResponse = z.infer<typeof ProjectResponseSchema>

export const AnalyzeErrorSchema = z.object({
  diagramType: z.string(),
  error: z.string(),
})

export const AnalyzeWarningSchema = z.object({
  diagramType: z.string(),
  message: z.string(),
})

export const AnalyzeResponseSchema = z.object({
  success: z.boolean(),
  results: z.record(z.unknown()).optional(),
  errors: z.array(AnalyzeErrorSchema).optional(),
  warnings: z.array(AnalyzeWarningSchema).optional(),
  summary: ProjectSummarySchema.optional(),
})

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>
