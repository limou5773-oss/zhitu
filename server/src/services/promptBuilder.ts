import type { ProjectSummary } from '../types/analysis.js'
import type { DiagramType } from '../types/diagrams.js'

const SYSTEM_PROMPT = `你是软件工程项目分析助手。
请根据提供的项目文件摘要，生成指定图表的数据。
要求：
- 只能返回 JSON，不要返回 Markdown 代码块（不要 \`\`\`json）
- 不要解释、不要补充说明
- 所有字段必须严格符合给定的 JSON Schema
- 如果信息不足，请根据代码命名、目录结构、接口路径进行合理推断
- 推断的实体/模块名称使用中文（基于注释、表注释、Controller 命名等）`

function getSchemaForType(type: DiagramType): string {
  switch (type) {
    case 'module':
      return `{
  "systemName": "系统名称(string)",
  "modules": [
    {
      "name": "模块名称(string)",
      "functions": ["功能名称(string)"]
    }
  ]
}`
    case 'er':
      return `{
  "entities": [
    {
      "name": "实体名称(string)",
      "attributes": [
        { "name": "属性名(string)", "isPK": true或false }
      ]
    }
  ],
  "relationships": [
    {
      "from": "来源实体名(string)",
      "to": "目标实体名(string)",
      "cardinality": "1:1或1:N或M:N",
      "label": "关系描述(string)"
    }
  ]
}`
    case 'usecase':
      return `{
  "systemName": "系统名称(string)",
  "actors": [
    {
      "name": "角色名称(string)",
      "useCases": ["用例名称(string)"]
    }
  ]
}`
    case 'dfd':
      return `{
  "nodes": [
    { "name": "节点名称(string)", "kind": "entity或process或store" }
  ],
  "flows": [
    { "from": "来源节点名(string)", "to": "目标节点名(string)", "label": "数据描述(string)" }
  ]
}`
    case 'flowchart':
      return `{
  "layoutDir": "TB或LR",
  "steps": [
    { "type": "start或end或decision或process或io或yes或no", "text": "步骤文字(string)" }
  ]
}`
    case 'sequence':
      return `{
  "participants": [
    { "name": "参与者名称(string)", "isActor": true或false }
  ],
  "messages": [
    { "from": "发送方(string)", "to": "接收方(string)", "type": "sync或async或return或self", "message": "消息内容(string)" }
  ],
  "fragments": [
    { "type": "alt或loop或opt", "condition": "条件描述(string)" }
  ]
}`
  }
}

function getChartName(type: DiagramType): string {
  switch (type) {
    case 'module': return '功能模块图'
    case 'er': return 'ER 图'
    case 'usecase': return '用例图'
    case 'dfd': return '数据流图'
    case 'flowchart': return '流程图'
    case 'sequence': return '时序图'
  }
}

export function buildPrompt(type: DiagramType, summary: ProjectSummary): { system: string; user: string } {
  const schema = getSchemaForType(type)
  const chartName = getChartName(type)

  const userPrompt = `请根据以下项目摘要，生成${chartName}的数据。

项目摘要：
${JSON.stringify(summary, null, 2)}

目标图表类型：${chartName}
必须严格符合以下 JSON Schema：
${schema}

直接返回 JSON：`

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  }
}
