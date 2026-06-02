import type { ProjectSummary } from '../types/analysis.js'
import type {
  DataFlowResult,
  DiagramResultMap,
  DiagramType,
  ERResult,
  FlowchartResult,
  FunctionModuleResult,
  SequenceResult,
  UseCaseResult,
} from '../types/diagrams.js'

function cleanName(value: string | undefined, fallback: string) {
  const raw = (value || '').trim()
  if (!raw) return fallback
  return raw
    .replace(/^t_/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(controller|service|impl|entity|mapper)\b/gi, '')
    .trim() || fallback
}

function unique(values: string[], limit = 12) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of values) {
    const name = item.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
    if (result.length >= limit) break
  }
  return result
}

function methodText(method: string) {
  const nameMatch = method.match(/\(([^)]+)\)/)
  const pathMatch = method.match(/^(GET|POST|PUT|DELETE|PATCH)\s*([^\s(]*)/i)
  const methodName = nameMatch?.[1] || method
  const path = pathMatch?.[2]
  return cleanName(path || methodName, cleanName(methodName, '业务处理'))
}

function projectTitle(summary: ProjectSummary) {
  return cleanName(summary.projectName, '项目系统')
}

function tableDisplayName(table: ProjectSummary['sqlTables'][number]) {
  return cleanName(table.comment || table.tableName, table.tableName)
}

function entityDisplayName(entity: ProjectSummary['entities'][number]) {
  return cleanName(entity.tableName || entity.className, entity.className)
}

function buildModuleFallback(summary: ProjectSummary): FunctionModuleResult {
  const modules = summary.controllers.map((controller) => {
    const functions = unique(controller.methods.map(methodText), 8)
    return {
      name: cleanName(controller.className, '业务模块'),
      functions: functions.length ? functions : ['业务处理'],
    }
  })

  if (modules.length === 0 && summary.services.length > 0) {
    modules.push(...summary.services.slice(0, 8).map((service) => ({
      name: cleanName(service.className, '服务模块'),
      functions: unique(service.methods.map((item) => cleanName(item, '服务方法')), 8),
    })))
  }

  if (modules.length === 0 && summary.menus.length > 0) {
    modules.push(...summary.menus.slice(0, 8).map((menu) => ({
      name: cleanName(menu.name, '菜单模块'),
      functions: ['页面访问'],
    })))
  }

  if (modules.length === 0) {
    modules.push({
      name: '核心模块',
      functions: ['项目分析', '数据维护'],
    })
  }

  return {
    systemName: projectTitle(summary),
    modules: modules.slice(0, 10).map((module) => ({
      ...module,
      functions: module.functions.length ? module.functions : ['业务处理'],
    })),
  }
}

function buildERFallback(summary: ProjectSummary): ERResult {
  const sqlEntities = summary.sqlTables.map((table) => ({
    name: tableDisplayName(table),
    sourceName: table.tableName,
    attributes: table.columns.slice(0, 10).map((column) => ({
      name: cleanName(column.comment || column.name, column.name),
      isPK: column.isPK,
      sourceName: column.name,
    })),
  }))

  const javaEntities = summary.entities.map((entity) => ({
    name: entityDisplayName(entity),
    sourceName: entity.tableName || entity.className,
    attributes: entity.fields.slice(0, 10).map((field) => ({
      name: cleanName(field.name, field.name),
      isPK: field.isPK,
      sourceName: field.name,
    })),
  }))

  const sourceEntities = sqlEntities.length ? sqlEntities : javaEntities
  const entities = sourceEntities.length
    ? sourceEntities.map((entity) => ({
        name: entity.name,
        attributes: entity.attributes.length
          ? entity.attributes.map((attribute) => ({ name: attribute.name, isPK: attribute.isPK }))
          : [{ name: 'ID', isPK: true }],
      }))
    : [
        { name: '用户', attributes: [{ name: '用户ID', isPK: true }, { name: '名称', isPK: false }] },
        { name: '记录', attributes: [{ name: '记录ID', isPK: true }, { name: '用户ID', isPK: false }] },
      ]

  const relationships: ERResult['relationships'] = []
  sourceEntities.forEach((from) => {
    from.attributes.forEach((attribute) => {
      const key = attribute.sourceName.toLowerCase()
      if (!key.endsWith('id') && !key.endsWith('_id')) return
      const target = sourceEntities.find((entity) => {
        if (entity.sourceName === from.sourceName) return false
        const base = entity.sourceName.toLowerCase().replace(/^t_/, '').replace(/_?info$/, '')
        return key.includes(base.replace(/_/g, '')) || key.includes(base)
      })
      if (!target) return
      relationships.push({
        from: from.name,
        to: target.name,
        label: '关联',
        cardinality: 'N:1',
      })
    })
  })

  if (relationships.length === 0 && entities.length >= 2) {
    relationships.push({
      from: entities[0].name,
      to: entities[1].name,
      label: '关联',
      cardinality: '1:N',
    })
  }

  return {
    entities,
    relationships: relationships.slice(0, 12),
  }
}

function buildUseCaseFallback(summary: ProjectSummary): UseCaseResult {
  const routeCases = summary.routes.map((route) => cleanName(route.path, '页面访问'))
  const apiCases = summary.apis.map((api) => cleanName(api.description || api.url, api.url))
  const controllerCases = summary.controllers.flatMap((controller) => controller.methods.map(methodText))
  const useCases = unique([...routeCases, ...apiCases, ...controllerCases], 12)

  return {
    systemName: projectTitle(summary),
    actors: [
      {
        name: '用户',
        useCases: useCases.length ? useCases : ['登录系统', '查询数据', '维护信息'],
      },
    ],
  }
}

function buildDfdFallback(summary: ProjectSummary): DataFlowResult {
  const processNames = unique([
    ...summary.controllers.map((item) => cleanName(item.className, '业务处理')),
    ...summary.services.map((item) => cleanName(item.className, '服务处理')),
    ...summary.apis.map((item) => cleanName(item.description || item.url, item.url)),
  ], 10)

  const storeNames = unique([
    ...summary.sqlTables.map(tableDisplayName),
    ...summary.entities.map(entityDisplayName),
  ], 10)

  const processes = processNames.length ? processNames : ['业务处理']
  const stores = storeNames.length ? storeNames : ['业务数据库']
  const nodes: DataFlowResult['nodes'] = [
    { name: '用户', kind: 'entity' },
    ...processes.map((name) => ({ name, kind: 'process' as const })),
    ...stores.map((name) => ({ name, kind: 'store' as const })),
  ]

  const flows: DataFlowResult['flows'] = []
  processes.forEach((processName, index) => {
    const storeName = stores[index % stores.length]
    flows.push({ from: '用户', to: processName, label: '操作请求' })
    flows.push({ from: processName, to: storeName, label: '读写数据' })
    flows.push({ from: storeName, to: processName, label: '数据结果' })
    flows.push({ from: processName, to: '用户', label: '处理结果' })
  })

  return {
    nodes,
    flows: flows.slice(0, 24),
  }
}

function buildFlowchartFallback(summary: ProjectSummary): FlowchartResult {
  const keySteps = unique([
    ...summary.apis.map((api) => cleanName(api.description || api.url, api.url)),
    ...summary.controllers.flatMap((controller) => controller.methods.map(methodText)),
    ...summary.services.flatMap((service) => service.methods.map((method) => cleanName(method, method))),
  ], 7)

  const steps: FlowchartResult['steps'] = [
    { type: 'start', text: '开始' },
    { type: 'io', text: '接收请求' },
    { type: 'decision', text: '参数是否有效？' },
    { type: 'yes', text: keySteps[0] || '执行业务处理' },
    { type: 'process', text: keySteps[1] || '查询或保存数据' },
    { type: 'io', text: '返回处理结果' },
    { type: 'no', text: '返回错误提示' },
    { type: 'end', text: '结束' },
  ]

  return {
    layoutDir: 'TB',
    steps,
  }
}

function buildSequenceFallback(summary: ProjectSummary): SequenceResult {
  const hasDb = summary.sqlTables.length > 0 || summary.entities.length > 0
  const controller = cleanName(summary.controllers[0]?.className, '服务端')
  const service = cleanName(summary.services[0]?.className, '业务服务')
  const participants = [
    { name: '用户', isActor: true },
    { name: '客户端', isActor: false },
    { name: controller, isActor: false },
    ...(hasDb ? [{ name: '数据库', isActor: false }] : []),
  ]

  const messages: SequenceResult['messages'] = [
    { from: '用户', to: '客户端', type: 'sync', message: '发起操作' },
    { from: '客户端', to: controller, type: 'sync', message: '提交请求' },
    { from: controller, to: service, type: 'sync', message: '业务处理' },
  ]

  if (hasDb) {
    messages.push({ from: service, to: '数据库', type: 'sync', message: '读写数据' })
    messages.push({ from: '数据库', to: service, type: 'return', message: '返回数据' })
  }

  messages.push(
    { from: service, to: controller, type: 'return', message: '返回结果' },
    { from: controller, to: '客户端', type: 'return', message: '响应结果' },
    { from: '客户端', to: '用户', type: 'return', message: '展示结果' },
  )

  return {
    participants,
    messages,
    fragments: [],
  }
}

export function buildFallbackDiagram<T extends DiagramType>(
  type: T,
  summary: ProjectSummary,
): DiagramResultMap[T] {
  switch (type) {
    case 'module':
      return buildModuleFallback(summary) as DiagramResultMap[T]
    case 'er':
      return buildERFallback(summary) as DiagramResultMap[T]
    case 'usecase':
      return buildUseCaseFallback(summary) as DiagramResultMap[T]
    case 'dfd':
      return buildDfdFallback(summary) as DiagramResultMap[T]
    case 'flowchart':
      return buildFlowchartFallback(summary) as DiagramResultMap[T]
    case 'sequence':
      return buildSequenceFallback(summary) as DiagramResultMap[T]
  }
}
