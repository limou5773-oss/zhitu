import type { ProjectSummary } from '../types/analysis.js'
import {
  DiagramResultSchemas,
  type DataFlowResult,
  type DiagramResultMap,
  type DiagramType,
  type ERResult,
  type FlowchartResult,
  type FunctionModuleResult,
  type SequenceResult,
  type UseCaseResult,
} from '../types/diagrams.js'
import { buildFallbackDiagram } from './diagramFallback.js'

export interface NormalizedDiagramResult<T extends DiagramType = DiagramType> {
  data: DiagramResultMap[T]
  warning?: string
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function pickArray(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key] as unknown[]
  }
  return []
}

function pickString(source: Record<string, unknown>, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
}

function pickBool(source: Record<string, unknown>, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      if (['true', 'yes', 'pk', 'primary', '主键'].includes(lower)) return true
      if (['false', 'no'].includes(lower)) return false
    }
  }
  return fallback
}

function unwrapPayload(payload: unknown) {
  const source = objectValue(payload)
  for (const key of ['data', 'diagram', 'result', 'content']) {
    const value = source[key]
    if (value && typeof value === 'object') return value
  }
  return payload
}

function normalizeModule(payload: unknown, summary: ProjectSummary): FunctionModuleResult {
  const source = objectValue(unwrapPayload(payload))
  const modules = pickArray(source, ['modules', 'moduleList', 'children']).map((item) => {
    const module = objectValue(item)
    const rawFunctions = pickArray(module, ['functions', 'functionList', 'features', 'children'])
    const functions = rawFunctions
      .map((fn) => typeof fn === 'string' ? fn : pickString(objectValue(fn), ['name', 'title', 'text']))
      .filter(Boolean)
    return {
      name: pickString(module, ['name', 'title', 'moduleName'], '模块'),
      functions: functions.length ? functions : ['功能'],
    }
  })

  return {
    systemName: pickString(source, ['systemName', 'system', 'name', 'title'], summary.projectName || '系统'),
    modules: modules.length ? modules : buildFallbackDiagram('module', summary).modules,
  }
}

function normalizeER(payload: unknown, summary: ProjectSummary): ERResult {
  const source = objectValue(unwrapPayload(payload))
  const entities = pickArray(source, ['entities', 'tables', 'nodes']).map((item) => {
    const entity = objectValue(item)
    const attributes = pickArray(entity, ['attributes', 'fields', 'columns', 'attrs']).map((attr) => {
      const field = objectValue(attr)
      return {
        name: typeof attr === 'string'
          ? attr
          : pickString(field, ['name', 'fieldName', 'columnName', 'comment'], '属性'),
        isPK: pickBool(field, ['isPK', 'primary', 'primaryKey', 'pk']),
      }
    })
    return {
      name: pickString(entity, ['name', 'entityName', 'tableName', 'comment'], '实体'),
      attributes: attributes.length ? attributes : [{ name: 'ID', isPK: true }],
    }
  })

  const relationships = pickArray(source, ['relationships', 'relations', 'edges']).map((item) => {
    const rel = objectValue(item)
    return {
      from: pickString(rel, ['from', 'source', 'left', 'start'], ''),
      to: pickString(rel, ['to', 'target', 'right', 'end'], ''),
      label: pickString(rel, ['label', 'name', 'relationship'], '关联'),
      cardinality: pickString(rel, ['cardinality', 'type', 'relation'], '1:N'),
    }
  }).filter((rel) => rel.from && rel.to)

  return {
    entities: entities.length ? entities : buildFallbackDiagram('er', summary).entities,
    relationships,
  }
}

function normalizeUseCase(payload: unknown, summary: ProjectSummary): UseCaseResult {
  const source = objectValue(unwrapPayload(payload))
  const actors = pickArray(source, ['actors', 'roles', 'users']).map((item) => {
    const actor = objectValue(item)
    const rawCases = pickArray(actor, ['useCases', 'cases', 'functions', 'children'])
    const useCases = rawCases
      .map((uc) => typeof uc === 'string' ? uc : pickString(objectValue(uc), ['name', 'title', 'text']))
      .filter(Boolean)
    return {
      name: pickString(actor, ['name', 'actorName', 'role'], '参与者'),
      useCases: useCases.length ? useCases : ['使用系统'],
    }
  })

  return {
    systemName: pickString(source, ['systemName', 'system', 'name', 'title'], summary.projectName || '系统'),
    actors: actors.length ? actors : buildFallbackDiagram('usecase', summary).actors,
  }
}

function normalizeNodeKind(kind: string): DataFlowResult['nodes'][number]['kind'] {
  const lower = kind.toLowerCase()
  if (['entity', 'external', 'actor', '外部实体'].includes(lower)) return 'entity'
  if (['store', 'database', 'db', 'data_store', '数据存储'].includes(lower)) return 'store'
  return 'process'
}

function normalizeDfd(payload: unknown, summary: ProjectSummary): DataFlowResult {
  const source = objectValue(unwrapPayload(payload))
  const nodes = pickArray(source, ['nodes', 'entities']).map((item) => {
    const node = objectValue(item)
    return {
      name: pickString(node, ['name', 'label', 'text'], '节点'),
      kind: normalizeNodeKind(pickString(node, ['kind', 'type', 'nodeType'], 'process')),
    }
  })

  const flows = pickArray(source, ['flows', 'edges', 'links']).map((item) => {
    const flow = objectValue(item)
    return {
      from: pickString(flow, ['from', 'source', 'start'], ''),
      to: pickString(flow, ['to', 'target', 'end'], ''),
      label: pickString(flow, ['label', 'name', 'text'], '数据'),
    }
  }).filter((flow) => flow.from && flow.to)

  return {
    nodes: nodes.length ? nodes : buildFallbackDiagram('dfd', summary).nodes,
    flows,
  }
}

function normalizeFlowType(type: string): FlowchartResult['steps'][number]['type'] {
  const lower = type.toLowerCase()
  if (['start', '开始'].includes(lower)) return 'start'
  if (['end', '结束'].includes(lower)) return 'end'
  if (['decision', 'judge', 'condition', '判断'].includes(lower)) return 'decision'
  if (['io', 'input', 'output', 'input/output', '输入/输出'].includes(lower)) return 'io'
  if (['yes', '是'].includes(lower)) return 'yes'
  if (['no', '否'].includes(lower)) return 'no'
  return 'process'
}

function normalizeFlowchart(payload: unknown, summary: ProjectSummary): FlowchartResult {
  const source = objectValue(unwrapPayload(payload))
  const steps = pickArray(source, ['steps', 'nodes', 'flow']).map((item) => {
    const step = objectValue(item)
    return {
      text: typeof item === 'string' ? item : pickString(step, ['text', 'name', 'label', 'title'], '处理'),
      type: normalizeFlowType(pickString(step, ['type', 'kind', 'shape'], 'process')),
    }
  })

  return {
    layoutDir: pickString(source, ['layoutDir', 'direction'], 'TB') === 'LR' ? 'LR' : 'TB',
    steps: steps.length ? steps : buildFallbackDiagram('flowchart', summary).steps,
  }
}

function normalizeMessageType(type: string): SequenceResult['messages'][number]['type'] {
  const lower = type.toLowerCase()
  if (['async', 'asynchronous', '异步'].includes(lower)) return 'async'
  if (['return', 'reply', '返回'].includes(lower)) return 'return'
  if (['self', 'selfcall', '自调用'].includes(lower)) return 'self'
  return 'sync'
}

function normalizeSequence(payload: unknown, summary: ProjectSummary): SequenceResult {
  const source = objectValue(unwrapPayload(payload))
  const participants = pickArray(source, ['participants', 'lifelines', 'actors']).map((item) => {
    const participant = objectValue(item)
    return {
      name: typeof item === 'string' ? item : pickString(participant, ['name', 'label', 'text'], '对象'),
      isActor: pickBool(participant, ['isActor', 'actor'], false),
    }
  })

  const messages = pickArray(source, ['messages', 'calls', 'interactions']).map((item) => {
    const message = objectValue(item)
    return {
      from: pickString(message, ['from', 'source', 'sender'], ''),
      to: pickString(message, ['to', 'target', 'receiver'], ''),
      type: normalizeMessageType(pickString(message, ['type', 'messageType'], 'sync')),
      message: pickString(message, ['message', 'text', 'label', 'name'], '调用'),
    }
  }).filter((message) => message.from && message.to)

  const fragments = pickArray(source, ['fragments', 'groups']).map((item) => {
    const fragment = objectValue(item)
    const type = pickString(fragment, ['type'], 'alt')
    return {
      type: ['alt', 'loop', 'opt'].includes(type) ? type as 'alt' | 'loop' | 'opt' : 'alt',
      condition: pickString(fragment, ['condition', 'label', 'text'], ''),
    }
  })

  const fallback = buildFallbackDiagram('sequence', summary)
  return {
    participants: participants.length ? participants : fallback.participants,
    messages: messages.length ? messages : fallback.messages,
    fragments,
  }
}

function normalizeByType(type: DiagramType, payload: unknown, summary: ProjectSummary) {
  switch (type) {
    case 'module':
      return normalizeModule(payload, summary)
    case 'er':
      return normalizeER(payload, summary)
    case 'usecase':
      return normalizeUseCase(payload, summary)
    case 'dfd':
      return normalizeDfd(payload, summary)
    case 'flowchart':
      return normalizeFlowchart(payload, summary)
    case 'sequence':
      return normalizeSequence(payload, summary)
  }
}

export function normalizeDiagramResult<T extends DiagramType>(
  type: T,
  payload: unknown,
  summary: ProjectSummary,
): NormalizedDiagramResult<T> {
  const normalized = normalizeByType(type, payload, summary)
  const parsed = DiagramResultSchemas[type].safeParse(normalized)
  if (parsed.success) {
    return { data: parsed.data as DiagramResultMap[T] }
  }

  return {
    data: buildFallbackDiagram(type, summary),
    warning: 'AI 返回的数据结构不完整，已使用项目结构兜底生成。',
  }
}
