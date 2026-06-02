import { z } from 'zod'

// ==================== 功能模块图 ====================
export const ModuleFunctionSchema = z.object({
  name: z.string().min(1),
})

export const ModuleSchema = z.object({
  name: z.string().min(1),
  functions: z.array(z.string().min(1)).min(1),
})

export const FunctionModuleResultSchema = z.object({
  systemName: z.string().min(1),
  modules: z.array(ModuleSchema).min(1),
})

export type FunctionModuleResult = z.infer<typeof FunctionModuleResultSchema>

// ==================== ER 图 ====================
export const AttributeSchema = z.object({
  name: z.string().min(1),
  isPK: z.boolean(),
})

export const EntitySchema = z.object({
  name: z.string().min(1),
  attributes: z.array(AttributeSchema).min(1),
})

export const RelationshipSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string(),
  cardinality: z.string(),
})

export const ERResultSchema = z.object({
  entities: z.array(EntitySchema),
  relationships: z.array(RelationshipSchema),
})

export type ERResult = z.infer<typeof ERResultSchema>

// ==================== 用例图 ====================
export const ActorSchema = z.object({
  name: z.string().min(1),
  useCases: z.array(z.string().min(1)).min(1),
})

export const UseCaseResultSchema = z.object({
  systemName: z.string().min(1),
  actors: z.array(ActorSchema).min(1),
})

export type UseCaseResult = z.infer<typeof UseCaseResultSchema>

// ==================== 数据流图 ====================
export const DfdNodeKindSchema = z.enum(['entity', 'process', 'store'])

export const DfdNodeSchema = z.object({
  name: z.string().min(1),
  kind: DfdNodeKindSchema,
})

export const DataFlowSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string(),
})

export const DataFlowResultSchema = z.object({
  nodes: z.array(DfdNodeSchema),
  flows: z.array(DataFlowSchema),
})

export type DataFlowResult = z.infer<typeof DataFlowResultSchema>

// ==================== 流程图 ====================
export const FlowNodeTypeSchema = z.enum(['start', 'end', 'decision', 'process', 'io', 'yes', 'no'])

export const FlowNodeSchema = z.object({
  text: z.string().min(1),
  type: FlowNodeTypeSchema,
})

export const FlowchartResultSchema = z.object({
  layoutDir: z.enum(['TB', 'LR']),
  steps: z.array(FlowNodeSchema),
})

export type FlowchartResult = z.infer<typeof FlowchartResultSchema>

// ==================== 时序图 ====================
export const ParticipantSchema = z.object({
  name: z.string().min(1),
  isActor: z.boolean(),
})

export const MessageTypeSchema = z.enum(['sync', 'async', 'return', 'self'])

export const MessageSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: MessageTypeSchema,
  message: z.string().min(1),
})

export const FragmentSchema = z.object({
  type: z.enum(['alt', 'loop', 'opt']),
  condition: z.string(),
  startMessageId: z.number().optional(),
  endMessageId: z.number().optional(),
})

export const SequenceResultSchema = z.object({
  participants: z.array(ParticipantSchema),
  messages: z.array(MessageSchema),
  fragments: z.array(FragmentSchema),
})

export type SequenceResult = z.infer<typeof SequenceResultSchema>

// ==================== 图表类型映射 ====================
export const DiagramTypeSchema = z.enum(['module', 'er', 'usecase', 'dfd', 'flowchart', 'sequence'])

export type DiagramType = z.infer<typeof DiagramTypeSchema>

export const DiagramResultSchemas: Record<DiagramType, z.ZodTypeAny> = {
  module: FunctionModuleResultSchema,
  er: ERResultSchema,
  usecase: UseCaseResultSchema,
  dfd: DataFlowResultSchema,
  flowchart: FlowchartResultSchema,
  sequence: SequenceResultSchema,
} as const

export type DiagramResultMap = {
  module: FunctionModuleResult
  er: ERResult
  usecase: UseCaseResult
  dfd: DataFlowResult
  flowchart: FlowchartResult
  sequence: SequenceResult
}
