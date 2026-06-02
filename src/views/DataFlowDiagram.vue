<template>
  <DiagramLayout
    title="数据流图"
    :hasContent="hasContent"
    :hideDefaultPreviewActions="true"
    @loadExample="loadExample"
    @clear="clearAll"
    @exportPng="exportPng"
    @exportSvg="exportSvg"
    @copySource="copySource"
    ref="layoutRef"
  >
    <template #input>
      <div class="structured-editor dfd-editor">
        <div class="editor-hint">维护数据流节点与连线，右侧实时生成数据流图</div>

        <el-tabs v-model="activeEditorMode" type="card">
          <el-tab-pane label="节点编辑" name="nodes">
            <div ref="nodeSectionRef" class="editor-section dfd-node-section">
              <div class="editor-section-title">
                <span>数据流节点（{{ nodes.length }}）</span>
                <button class="editor-add" type="button" @click="addNode()">+ 新增节点</button>
              </div>
              <div class="editor-list">
                <div
                  v-for="(node, index) in nodes"
                  :key="node.id"
                  :data-node-id="node.id"
                  class="editor-row dfd-node-row"
                >
                  <el-select v-model="node.kind" size="default">
                    <el-option label="外部实体" value="entity" />
                    <el-option label="加工处理" value="process" />
                    <el-option label="数据存储" value="store" />
                  </el-select>
                  <el-input class="dfd-node-name" v-model="node.name" :placeholder="`${nodeKindLabel(node.kind)}${index + 1}`" />
                  <button class="editor-action text-action" type="button" title="从此节点添加连线" @click="addFlowFromNode(index)">连线</button>
                  <button class="editor-action danger" type="button" title="删除节点" @click="removeNode(index)">×</button>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="连线编辑" name="flows">
            <div ref="flowSectionRef" class="editor-section dfd-flow-section">
              <div class="editor-section-title">
                <span>数据流连线（{{ flows.length }}）</span>
                <button class="editor-add" type="button" @click="addFlow()">+ 新增连线</button>
              </div>
              <div class="editor-list">
                <div
                  v-for="(flow, index) in flows"
                  :key="flow.id"
                  :data-flow-id="flow.id"
                  class="editor-row dfd-flow-row"
                >
                  <el-select v-model="flow.fromId" size="default" placeholder="源">
                    <el-option
                      v-for="option in nodeOptions"
                      :key="option.id"
                      :label="option.label"
                      :value="option.id"
                    />
                  </el-select>
                  <span class="flow-arrow">→</span>
                  <el-select v-model="flow.toId" size="default" placeholder="目标">
                    <el-option
                      v-for="option in nodeOptions"
                      :key="option.id"
                      :label="option.label"
                      :value="option.id"
                    />
                  </el-select>
                  <el-input class="dfd-flow-label" v-model="flow.label" :placeholder="`数据流${index + 1}`" />
                  <button class="editor-action danger" type="button" title="删除连线" @click="removeFlow(index)">×</button>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </template>

    <template #extraButtons>
      <el-button @click="openQuickFill" size="default" text>快速填写</el-button>
    </template>

    <template #previewActions>
      <el-button size="small" plain @click="openStyleDialog">修改样式</el-button>
      <el-button size="small" type="success" :disabled="!hasContent" @click="beautifyLayout">美化排版</el-button>
      <el-dropdown split-button type="primary" size="small" :disabled="!hasContent" @click="exportPng">
        导出图片
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="openDrawIo">在 Draw.io 中编辑</el-dropdown-item>
            <el-dropdown-item @click="exportPng">导出 PNG</el-dropdown-item>
            <el-dropdown-item @click="exportSvg">导出 SVG</el-dropdown-item>
            <el-dropdown-item @click="copySource">复制源码</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </template>

    <template #preview>
      <div v-if="!hasContent" class="diagram-placeholder">请添加数据流节点</div>
      <div v-else ref="previewEl" style="width:100%;overflow:visible;"></div>
    </template>
  </DiagramLayout>

  <el-dialog v-model="quickFillVisible" title="快速填写数据流图" width="680px">
    <div class="quick-fill-help">
      节点可写“外部实体：读者 / 加工处理：图书查询 / 数据存储：图书信息库”；连线可写“读者 -> 图书查询：查询请求”。
    </div>
    <el-input
      v-model="quickFillText"
      type="textarea"
      :rows="14"
      placeholder="外部实体：读者&#10;加工处理：图书查询&#10;数据存储：图书信息数据库&#10;读者 -> 图书查询：图书查询条件&#10;图书查询 -> 图书信息数据库：查询图书信息"
    />
    <template #footer>
      <el-button @click="quickFillVisible = false">取消</el-button>
      <el-button type="primary" @click="applyQuickFill">确认填充</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="styleDialogVisible"
    title="数据流图样式设置"
    width="620px"
    top="16px"
    class="dfd-style-dialog"
    append-to-body
  >
    <div v-if="styleDraft" class="dfd-style-panel">
      <div class="dfd-style-switches">
        <div class="style-switch-row">
          <span>实时渲染</span>
          <el-switch v-model="styleDraft.realTimeRender" />
          <em>开启后编辑器变动会立即刷新图表。</em>
        </div>
        <div class="style-switch-row">
          <span>连线风格</span>
          <el-radio-group v-model="styleDraft.lineStyle" size="small">
            <el-radio-button value="straight">直线</el-radio-button>
            <el-radio-button value="orthogonal">正交</el-radio-button>
          </el-radio-group>
          <em>选择连线呈现直线或以直角方式弯折。</em>
        </div>
        <div class="style-switch-row">
          <span>文本自适应宽度</span>
          <el-switch v-model="styleDraft.autoNodeWidth" />
          <em>开启后节点宽度将根据文本长度自动调整。</em>
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">布局设置</div>
        <div class="style-grid">
          <label>水平间距</label>
          <el-input-number v-model="styleDraft.horizontalGap" :min="260" :max="760" :step="20" controls-position="right" size="small" />
          <label>垂直间距</label>
          <el-input-number v-model="styleDraft.verticalGap" :min="90" :max="440" :step="10" controls-position="right" size="small" />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">全局样式</div>
        <div class="style-grid">
          <label>背景颜色</label>
          <el-color-picker v-model="styleDraft.backgroundColor" size="small" show-alpha />
          <label>连线文本背景</label>
          <el-color-picker v-model="styleDraft.edgeLabelBackground" size="small" show-alpha />
          <label>节点边框</label>
          <el-color-picker v-model="styleDraft.borderColor" size="small" />
          <label>文字颜色</label>
          <el-color-picker v-model="styleDraft.fontColor" size="small" />
          <label>字体</label>
          <el-select v-model="styleDraft.fontFamily" size="small">
            <el-option label="宋体+Times" value="SimSun, 宋体, Times New Roman, serif" />
            <el-option label="微软雅黑" value="Microsoft YaHei, 微软雅黑, sans-serif" />
            <el-option label="黑体" value="SimHei, 黑体, sans-serif" />
          </el-select>
          <label>字体大小</label>
          <el-input-number v-model="styleDraft.fontSize" :min="10" :max="40" controls-position="right" size="small" />
          <label>连线颜色</label>
          <el-color-picker v-model="styleDraft.lineColor" size="small" />
          <label>连线粗细</label>
          <el-input-number v-model="styleDraft.lineWidth" :min="0.5" :max="8" :step="0.5" controls-position="right" size="small" />
          <label>箭头粗细</label>
          <el-input-number v-model="styleDraft.arrowSize" :min="4" :max="14" controls-position="right" size="small" />
          <label>边框粗细</label>
          <el-input-number v-model="styleDraft.borderWidth" :min="0.5" :max="8" :step="0.5" controls-position="right" size="small" />
        </div>
      </div>

      <div class="style-section" v-for="section in nodeStyleSections" :key="section.kind">
        <div class="style-section-title">{{ section.label }}</div>
        <div class="style-grid">
          <label>展示形状</label>
          <el-select v-model="styleDraft.nodeStyles[section.kind].shape" size="small">
            <el-option label="立方体" value="box3d" />
            <el-option label="圆角矩形" value="rounded" />
            <el-option label="矩形" value="rect" />
            <el-option label="右侧敞开" value="store" />
          </el-select>
          <label>背景颜色</label>
          <el-color-picker v-model="styleDraft.nodeStyles[section.kind].fill" size="small" show-alpha />
          <label>节点尺寸 宽</label>
          <el-input-number v-model="styleDraft.nodeStyles[section.kind].width" :min="80" :max="320" :step="10" controls-position="right" size="small" />
          <label>高</label>
          <el-input-number v-model="styleDraft.nodeStyles[section.kind].height" :min="36" :max="160" :step="6" controls-position="right" size="small" />
          <label>圆角大小</label>
          <el-input-number v-model="styleDraft.nodeStyles[section.kind].radius" :min="0" :max="80" :step="2" controls-position="right" size="small" />
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="restoreDefaultStyle">恢复默认</el-button>
      <el-button @click="cancelStyleDialog">取消</el-button>
      <el-button type="primary" @click="applyStyleDialog">应用</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, nextTick, ref, watch } from 'vue'
import DiagramLayout from '@/components/DiagramLayout.vue'
import { exportToPng, exportToSvg, copyToClipboard } from '@/utils/export'
import { buildSvg, textWidth } from '@/utils/svg-style'
import { readDiagramStorage } from '@/utils/diagramStorage'
import { ElMessage } from 'element-plus'

type DfdNodeKind = 'entity' | 'process' | 'store'
type DfdLineStyle = 'straight' | 'orthogonal'
type DfdLayoutMode = 'default' | 'balanced' | 'wide' | 'vertical'
type DfdNodeShape = 'box3d' | 'rounded' | 'rect' | 'store'

interface DfdNodeStyle {
  shape: DfdNodeShape
  fill: string
  width: number
  height: number
  radius: number
}

interface DfdDiagramStyle {
  realTimeRender: boolean
  lineStyle: DfdLineStyle
  autoNodeWidth: boolean
  horizontalGap: number
  verticalGap: number
  backgroundColor: string
  edgeLabelBackground: string
  borderColor: string
  fontColor: string
  fontFamily: string
  fontSize: number
  lineColor: string
  lineWidth: number
  arrowSize: number
  borderWidth: number
  nodeStyles: Record<DfdNodeKind, DfdNodeStyle>
}

interface DfdNode {
  id: number
  name: string
  kind: DfdNodeKind
  offsetX: number
  offsetY: number
}

interface DataFlow {
  id: number
  fromId: number
  toId: number
  label: string
}

interface RenderDfdNode {
  id: number
  name: string
  kind: DfdNodeKind
  offsetX: number
  offsetY: number
}

interface RenderDfdFlow {
  id: number
  fromId: number
  toId: number
  label: string
}

interface DfdPosition {
  id: number
  cx: number
  cy: number
  w: number
  h: number
  kind: DfdNodeKind
  index: number
}

interface DfdLabelCandidate {
  label: string
  x: number
  y: number
  w: number
  h: number
  zone: string
}

interface Point {
  x: number
  y: number
}

const DFD_LAYOUT_CYCLE: DfdLayoutMode[] = ['default', 'balanced', 'wide', 'vertical']
const DFD_STYLE_STORAGE_KEY = 'diagram:dfd-style'
const nodeStyleSections = [
  { kind: 'entity' as const, label: '外部实体' },
  { kind: 'process' as const, label: '加工处理' },
  { kind: 'store' as const, label: '数据存储' },
]

const nodes = ref<DfdNode[]>([])
const flows = ref<DataFlow[]>([])
const dfdLayoutMode = ref<DfdLayoutMode>('default')
const dfdStyle = ref<DfdDiagramStyle>(createDefaultDfdStyle())
const styleDraft = ref<DfdDiagramStyle | null>(null)
const styleSnapshot = ref<DfdDiagramStyle | null>(null)
const styleDialogVisible = ref(false)
const activeEditorMode = ref<'nodes' | 'flows'>('nodes')
const quickFillVisible = ref(false)
const quickFillText = ref('')
const previewEl = ref<HTMLElement>()
const nodeSectionRef = ref<HTMLElement>()
const flowSectionRef = ref<HTMLElement>()
const layoutRef = ref<InstanceType<typeof DiagramLayout>>()

let timer: number | undefined
let nodeId = 0
let draggingNodeId: number | null = null
let dragStartPoint = { x: 0, y: 0 }
let dragStartOffset = { x: 0, y: 0 }

const hasContent = computed(() => {
  return Boolean(
    nodes.value.some((item) => item.name.trim()) ||
    flows.value.some((item) => item.label.trim())
  )
})

const nodeOptions = computed(() => {
  return nodes.value.map((node, index) => ({
    id: node.id,
    label: node.name.trim() || `${nodeKindLabel(node.kind)}${index + 1}`,
  }))
})

const editorToggleText = computed(() => activeEditorMode.value === 'nodes' ? '连接编辑' : '节点编辑')

watch([nodes, flows, dfdStyle, dfdLayoutMode], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(renderDiagram, 300)
}, { deep: true })

watch(styleDraft, (draft) => {
  if (!styleDialogVisible.value || !draft?.realTimeRender) return
  dfdStyle.value = normalizeDfdStyle(cloneDfdStyle(draft))
  saveCurrentStyle()
  window.clearTimeout(timer)
  timer = window.setTimeout(renderDiagram, 120)
}, { deep: true })

function createDefaultDfdStyle(): DfdDiagramStyle {
  return {
    realTimeRender: true,
    lineStyle: 'straight',
    autoNodeWidth: true,
    horizontalGap: 330,
    verticalGap: 118,
    backgroundColor: '#ffffff',
    edgeLabelBackground: '#ffffff',
    borderColor: '#000000',
    fontColor: '#000000',
    fontFamily: 'SimSun, 宋体, Times New Roman, serif',
    fontSize: 13,
    lineColor: '#000000',
    lineWidth: 1.2,
    arrowSize: 6,
    borderWidth: 1.2,
    nodeStyles: {
      entity: { shape: 'box3d', fill: '#f7fdff', width: 180, height: 54, radius: 0 },
      process: { shape: 'rounded', fill: '#e4f4ff', width: 180, height: 54, radius: 28 },
      store: { shape: 'rect', fill: '#fff0f6', width: 180, height: 54, radius: 0 },
    },
  }
}

function normalizeDfdStyle(style: DfdDiagramStyle): DfdDiagramStyle {
  return {
    ...style,
    horizontalGap: Math.max(300, style.horizontalGap || 330),
    verticalGap: Math.max(110, style.verticalGap || 118),
    nodeStyles: {
      entity: {
        ...style.nodeStyles.entity,
        width: Math.max(170, style.nodeStyles.entity.width || 180),
        height: Math.max(48, style.nodeStyles.entity.height || 54),
      },
      process: {
        ...style.nodeStyles.process,
        width: Math.max(170, style.nodeStyles.process.width || 180),
        height: Math.max(48, style.nodeStyles.process.height || 54),
      },
      store: {
        ...style.nodeStyles.store,
        width: Math.max(170, style.nodeStyles.store.width || 180),
        height: Math.max(48, style.nodeStyles.store.height || 54),
      },
    },
  }
}

function cloneDfdStyle(style: DfdDiagramStyle): DfdDiagramStyle {
  return JSON.parse(JSON.stringify(style))
}

function saveCurrentStyle() {
  localStorage.setItem(DFD_STYLE_STORAGE_KEY, JSON.stringify(dfdStyle.value))
}

function loadStoredStyle() {
  const stored = localStorage.getItem(DFD_STYLE_STORAGE_KEY)
  if (!stored) return
  try {
    dfdStyle.value = normalizeDfdStyle({
      ...createDefaultDfdStyle(),
      ...JSON.parse(stored),
      nodeStyles: {
        ...createDefaultDfdStyle().nodeStyles,
        ...(JSON.parse(stored).nodeStyles || {}),
      },
    })
  } catch {
    localStorage.removeItem(DFD_STYLE_STORAGE_KEY)
  }
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function nodeKindLabel(kind: DfdNodeKind) {
  if (kind === 'entity') return '外部实体'
  if (kind === 'store') return '数据存储'
  return '加工处理'
}

function createNode(kind: DfdNodeKind = 'process', name = ''): DfdNode {
  return { id: ++nodeId, kind, name, offsetX: 0, offsetY: 0 }
}

function createFlow(fromId = nodes.value[0]?.id || 0, toId = nodes.value[1]?.id || nodes.value[0]?.id || 0, label = ''): DataFlow {
  return { id: ++nodeId, fromId, toId, label }
}

function focusEditorRow(type: 'node' | 'flow', id: number) {
  nextTick(() => {
    const section = type === 'node' ? nodeSectionRef.value : flowSectionRef.value
    const attr = type === 'node' ? 'data-node-id' : 'data-flow-id'
    const row = section?.querySelector<HTMLElement>(`[${attr}="${id}"]`)
    const list = row?.closest<HTMLElement>('.editor-list')
    if (row && list) {
      const rowRect = row.getBoundingClientRect()
      const listRect = list.getBoundingClientRect()
      if (rowRect.bottom > listRect.bottom) {
        list.scrollTo({ top: list.scrollTop + rowRect.bottom - listRect.bottom + 10, behavior: 'smooth' })
      } else if (rowRect.top < listRect.top) {
        list.scrollTo({ top: list.scrollTop - (listRect.top - rowRect.top) - 10, behavior: 'smooth' })
      }
    }
    const input = row?.querySelector<HTMLInputElement>('.dfd-node-name .el-input__inner, .dfd-flow-label .el-input__inner')
    input?.focus({ preventScroll: true })
    input?.select()
  })
}

function addNode(insertIndex?: number, shouldFocus = true) {
  const item = createNode('process', `加工处理${nodes.value.filter((node) => node.kind === 'process').length + 1}`)
  if (typeof insertIndex === 'number') {
    nodes.value.splice(insertIndex, 0, item)
  } else {
    nodes.value.push(item)
  }
  if (shouldFocus) {
    activeEditorMode.value = 'nodes'
    focusEditorRow('node', item.id)
  }
}

function removeNode(index: number) {
  const [removed] = nodes.value.splice(index, 1)
  if (!removed) return
  flows.value = flows.value.filter((flow) => flow.fromId !== removed.id && flow.toId !== removed.id)
}

function addFlow(insertIndex?: number, shouldFocus = true) {
  if (!nodes.value.length) addNode(undefined, false)
  const first = nodes.value[0]?.id || 0
  const second = nodes.value.find((node) => node.id !== first)?.id || first
  const item = createFlow(first, second, `数据流${flows.value.length + 1}`)
  if (typeof insertIndex === 'number') {
    flows.value.splice(insertIndex, 0, item)
  } else {
    flows.value.push(item)
  }
  if (shouldFocus) {
    activeEditorMode.value = 'flows'
    focusEditorRow('flow', item.id)
  }
}

function openNodeEditor() {
  activeEditorMode.value = 'nodes'
  nextTick(() => {
    nodeSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function openFlowEditor() {
  if (!flows.value.length) addFlow()
  activeEditorMode.value = 'flows'
  nextTick(() => {
    flowSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function toggleEditorMode() {
  if (activeEditorMode.value === 'nodes') {
    openFlowEditor()
  } else {
    openNodeEditor()
  }
}

function addFlowFromNode(index: number) {
  const source = nodes.value[index]
  if (!source) return
  const target = nodes.value.find((node) => node.id !== source.id && node.kind === 'process')
    || nodes.value.find((node) => node.id !== source.id)
    || source
  const item = createFlow(source.id, target.id, `数据流${flows.value.length + 1}`)
  flows.value.push(item)
  activeEditorMode.value = 'flows'
  focusEditorRow('flow', item.id)
}

function removeFlow(index: number) {
  flows.value.splice(index, 1)
}

function getRenderData() {
  const renderNodes = nodes.value.map((node, index) => ({
    id: node.id,
    kind: node.kind,
    name: node.name.trim() || `${nodeKindLabel(node.kind)}${index + 1}`,
    offsetX: node.offsetX || 0,
    offsetY: node.offsetY || 0,
  }))

  const nodeIds = new Set(renderNodes.map((node) => node.id))
  const renderFlows = flows.value
    .map((flow, index) => ({
      id: flow.id,
      fromId: flow.fromId,
      toId: flow.toId,
      label: flow.label.trim() || `数据流${index + 1}`,
    }))
    .filter((flow) => nodeIds.has(flow.fromId) && nodeIds.has(flow.toId))

  return { renderNodes, renderFlows }
}

function renderDiagram() {
  if (!previewEl.value) return
  if (!hasContent.value) {
    previewEl.value.innerHTML = ''
    return
  }

  const { renderNodes, renderFlows } = getRenderData()
  try {
    previewEl.value.innerHTML = generateDFDSVG(renderNodes, renderFlows)
    bindNodeDrag()
  } catch (e: any) {
    previewEl.value.innerHTML = `<div class="diagram-error">渲染失败：${e.message || ''}</div>`
  }
}

function bindNodeDrag() {
  if (!previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  if (!svg) return

  previewEl.value.querySelectorAll<SVGGElement>('.draggable-dfd-node').forEach((group) => {
    group.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()

      const id = Number(group.dataset.id)
      const target = getNodeById(id)
      if (!target || !Number.isFinite(id)) return

      draggingNodeId = id
      dragStartPoint = getSvgPoint(event, svg)
      dragStartOffset = { x: target.offsetX, y: target.offsetY }

      window.addEventListener('pointermove', handleNodeDrag)
      window.addEventListener('pointerup', stopNodeDrag, { once: true })
      window.addEventListener('pointercancel', stopNodeDrag, { once: true })
    })
  })
}

function getNodeById(id: number) {
  return nodes.value.find((node) => node.id === id)
}

function getSvgPoint(event: PointerEvent, svg: SVGSVGElement) {
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const matrix = svg.getScreenCTM()
  if (!matrix) return { x: point.x, y: point.y }
  const transformed = point.matrixTransform(matrix.inverse())
  return { x: transformed.x, y: transformed.y }
}

function handleNodeDrag(event: PointerEvent) {
  if (draggingNodeId === null || !previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  const target = getNodeById(draggingNodeId)
  if (!svg || !target) return

  event.preventDefault()
  const current = getSvgPoint(event, svg)
  target.offsetX = Math.round(dragStartOffset.x + current.x - dragStartPoint.x)
  target.offsetY = Math.round(dragStartOffset.y + current.y - dragStartPoint.y)
  window.clearTimeout(timer)
  renderDiagram()
}

function stopNodeDrag() {
  draggingNodeId = null
  window.removeEventListener('pointermove', handleNodeDrag)
}

function resetLayout() {
  nodes.value.forEach((node) => {
    node.offsetX = 0
    node.offsetY = 0
  })
  dfdLayoutMode.value = 'default'
  window.clearTimeout(timer)
  nextTick(renderDiagram)
  ElMessage.success('已恢复默认布局')
}

function openStyleDialog() {
  styleSnapshot.value = cloneDfdStyle(dfdStyle.value)
  styleDraft.value = cloneDfdStyle(dfdStyle.value)
  styleDialogVisible.value = true
}

function applyStyleDialog() {
  if (!styleDraft.value) return
  dfdStyle.value = normalizeDfdStyle(cloneDfdStyle(styleDraft.value))
  saveCurrentStyle()
  styleSnapshot.value = null
  styleDialogVisible.value = false
  nextTick(renderDiagram)
}

function cancelStyleDialog() {
  if (styleSnapshot.value) {
    dfdStyle.value = cloneDfdStyle(styleSnapshot.value)
  }
  styleDialogVisible.value = false
  styleDraft.value = null
  styleSnapshot.value = null
  nextTick(renderDiagram)
}

function restoreDefaultStyle() {
  styleDraft.value = createDefaultDfdStyle()
  dfdStyle.value = normalizeDfdStyle(cloneDfdStyle(styleDraft.value))
  saveCurrentStyle()
  nextTick(renderDiagram)
}

function beautifyLayout() {
  if (!hasContent.value) return
  const currentIndex = DFD_LAYOUT_CYCLE.indexOf(dfdLayoutMode.value)
  const nextMode = DFD_LAYOUT_CYCLE[(Math.max(0, currentIndex) + 1) % DFD_LAYOUT_CYCLE.length]
  dfdLayoutMode.value = nextMode
  nodes.value.forEach((node) => {
    node.offsetX = 0
    node.offsetY = 0
  })
  window.clearTimeout(timer)
  nextTick(renderDiagram)
  ElMessage.success(`已切换排版：${dfdLayoutModeName(nextMode)}`)
}

function dfdLayoutModeName(mode: DfdLayoutMode) {
  const names: Record<DfdLayoutMode, string> = {
    default: '默认排版',
    balanced: '平衡排版',
    wide: '横向展开',
    vertical: '纵向排列',
  }
  return names[mode]
}

function rectBoundaryPoint(pos: DfdPosition, targetX: number, targetY: number): Point {
  const dx = targetX - pos.cx
  const dy = targetY - pos.cy
  const scale = Math.max(Math.abs(dx) / (pos.w / 2), Math.abs(dy) / (pos.h / 2))
  if (!scale) return { x: pos.cx, y: pos.cy }
  return { x: pos.cx + dx / scale, y: pos.cy + dy / scale }
}

function ellipseBoundaryPoint(pos: DfdPosition, targetX: number, targetY: number): Point {
  const dx = targetX - pos.cx
  const dy = targetY - pos.cy
  const rx = pos.w / 2
  const ry = pos.h / 2
  const scale = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry))
  if (!scale) return { x: pos.cx, y: pos.cy }
  return { x: pos.cx + dx / scale, y: pos.cy + dy / scale }
}

function nodeBoundaryPoint(pos: DfdPosition, targetX: number, targetY: number) {
  return dfdNodeStyle(pos.kind).shape === 'box3d'
    ? rectBoundaryPoint({ ...pos, cx: pos.cx + 4, cy: pos.cy - 4, w: pos.w + 8, h: pos.h + 8 }, targetX, targetY)
    : rectBoundaryPoint(pos, targetX, targetY)
}

function flowLabelSvg(label: string, x: number, y: number) {
  const style = dfdStyle.value
  const labelW = flowLabelWidth(label)
  const labelH = flowLabelHeight()
  return `<g class="dfd-flow-label" pointer-events="none">
    <rect x="${x - labelW / 2}" y="${y - labelH / 2}" width="${labelW}" height="${labelH}" rx="2" fill="${style.edgeLabelBackground}"/>
    <text class="dfd-edge-label" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" style="paint-order:stroke;stroke:${style.edgeLabelBackground};stroke-width:3;stroke-linejoin:round;">${esc(label)}</text>
  </g>`
}

function flowLabelWidth(label: string) {
  return Math.max(48, textWidth(label, Math.max(10, dfdStyle.value.fontSize - 1)) + 12)
}

function flowLabelHeight() {
  return 18
}

function createDfdLabelCandidate(label: string, x: number, y: number, zone: string): DfdLabelCandidate {
  return {
    label,
    x: Math.round(x),
    y: Math.round(y),
    w: flowLabelWidth(label),
    h: flowLabelHeight(),
    zone,
  }
}

function dfdLabelZone(from: DfdPosition, to: DfdPosition) {
  if (from.id === to.id) return `self-${from.id}`
  if (from.kind === 'entity' || to.kind === 'entity') return 'entity-corridor'
  if (from.kind === 'store' || to.kind === 'store') return 'store-corridor'
  return 'process-corridor'
}

function dfdLabelBounds(label: DfdLabelCandidate, margin = 0) {
  return {
    left: label.x - label.w / 2 - margin,
    right: label.x + label.w / 2 + margin,
    top: label.y - label.h / 2 - margin,
    bottom: label.y + label.h / 2 + margin,
  }
}

function dfdNodeBounds(pos: DfdPosition, margin = 0) {
  return {
    left: pos.cx - pos.w / 2 - margin,
    right: pos.cx + pos.w / 2 + margin,
    top: pos.cy - pos.h / 2 - margin,
    bottom: pos.cy + pos.h / 2 + margin,
  }
}

function rectOverlapArea(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return width * height
}

function dfdLabelPenalty(
  candidate: DfdLabelCandidate,
  placed: DfdLabelCandidate[],
  positions: Map<number, DfdPosition>,
) {
  let penalty = 0
  const candidateBounds = dfdLabelBounds(candidate, 4)

  placed.forEach((label) => {
    const overlap = rectOverlapArea(candidateBounds, dfdLabelBounds(label, 4))
    if (overlap > 0) penalty += 2600 + overlap * 2
  })

  positions.forEach((pos) => {
    const overlap = rectOverlapArea(candidateBounds, dfdNodeBounds(pos, 10))
    if (overlap > 0) penalty += 4200 + overlap * 3
  })

  return penalty
}

function chooseDfdLabelCandidate(
  label: string,
  from: DfdPosition,
  to: DfdPosition,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  unitX: number,
  unitY: number,
  normalX: number,
  normalY: number,
  labelOffset: number,
  sideOffset: number,
  placed: DfdLabelCandidate[],
  positions: Map<number, DfdPosition>,
  totalW: number,
  totalH: number,
) {
  const zone = dfdLabelZone(from, to)
  const labelW = flowLabelWidth(label)
  const labelH = flowLabelHeight()
  const isStoreFlow = from.kind === 'store' || to.kind === 'store'
  const isEntityFlow = from.kind === 'entity' || to.kind === 'entity'
  const tValues = isStoreFlow
    ? [0.28, 0.72, 0.44, 0.58, 0.18, 0.82]
    : isEntityFlow
      ? [0.36, 0.62, 0.24, 0.76, 0.5]
      : [0.5, 0.35, 0.65]
  const sideMultipliers = [1, -1, 0, 1.45, -1.45]
  const candidates: DfdLabelCandidate[] = []
  const preferredX = sx + (ex - sx) * 0.5
  const preferredY = sy + (ey - sy) * 0.5

  tValues.forEach((t) => {
    sideMultipliers.forEach((side) => {
      const x = sx + (ex - sx) * t + unitX * labelOffset + normalX * sideOffset * side
      const y = sy + (ey - sy) * t + unitY * labelOffset + normalY * sideOffset * side
      candidates.push(createDfdLabelCandidate(
        label,
        Math.min(totalW - labelW / 2 - 16, Math.max(labelW / 2 + 16, x)),
        Math.min(totalH - labelH / 2 - 16, Math.max(labelH / 2 + 16, y)),
        zone,
      ))
    })
  })

  return candidates.sort((a, b) => {
    const penaltyA = dfdLabelPenalty(a, placed, positions) + Math.hypot(a.x - preferredX, a.y - preferredY) * 8
    const penaltyB = dfdLabelPenalty(b, placed, positions) + Math.hypot(b.x - preferredX, b.y - preferredY) * 8
    if (penaltyA !== penaltyB) return penaltyA - penaltyB
    return Math.abs(a.y - (from.cy + to.cy) / 2) - Math.abs(b.y - (from.cy + to.cy) / 2)
  })[0]
}

function presetPosition(name: string, mode: DfdLayoutMode): Point | null {
  const layoutPresets: Record<DfdLayoutMode, Record<string, Point>> = {
    default: {
      图书管理员: { x: 160, y: 160 },
      读者: { x: 160, y: 360 },
      图书管理: { x: 510, y: 125 },
      图书查询: { x: 510, y: 265 },
      图书借阅: { x: 510, y: 405 },
      图书日志: { x: 510, y: 545 },
      读者信息: { x: 860, y: 155 },
      读者信息表: { x: 860, y: 155 },
      图书信息数据库: { x: 860, y: 305 },
      图书信息表: { x: 860, y: 305 },
      借阅记录数据库: { x: 860, y: 460 },
      借阅记录表: { x: 860, y: 460 },
    },
    balanced: {
      图书管理员: { x: 210, y: 125 },
      图书管理: { x: 500, y: 165 },
      读者信息: { x: 780, y: 145 },
      读者信息表: { x: 780, y: 145 },
      图书信息数据库: { x: 475, y: 330 },
      图书信息表: { x: 475, y: 330 },
      图书查询: { x: 220, y: 360 },
      图书借阅: { x: 530, y: 465 },
      读者: { x: 220, y: 555 },
      图书日志: { x: 520, y: 655 },
      借阅记录数据库: { x: 790, y: 655 },
      借阅记录表: { x: 790, y: 655 },
    },
    wide: {
      图书管理员: { x: 165, y: 140 },
      读者: { x: 165, y: 395 },
      图书管理: { x: 540, y: 115 },
      图书查询: { x: 540, y: 290 },
      图书借阅: { x: 540, y: 455 },
      图书日志: { x: 540, y: 625 },
      读者信息: { x: 930, y: 135 },
      读者信息表: { x: 930, y: 135 },
      图书信息数据库: { x: 930, y: 315 },
      图书信息表: { x: 930, y: 315 },
      借阅记录数据库: { x: 930, y: 515 },
      借阅记录表: { x: 930, y: 515 },
    },
    vertical: {
      图书管理员: { x: 480, y: 95 },
      图书管理: { x: 480, y: 230 },
      读者信息: { x: 740, y: 280 },
      读者信息表: { x: 740, y: 280 },
      图书信息数据库: { x: 480, y: 395 },
      图书信息表: { x: 480, y: 395 },
      图书查询: { x: 240, y: 520 },
      图书借阅: { x: 480, y: 555 },
      读者: { x: 240, y: 700 },
      图书日志: { x: 480, y: 735 },
      借阅记录数据库: { x: 740, y: 735 },
      借阅记录表: { x: 740, y: 735 },
    },
  }
  return layoutPresets[mode][name] || null
}

function dfdNodeStyle(kind: DfdNodeKind) {
  return dfdStyle.value.nodeStyles[kind]
}

function dfdNodeWidth(node: RenderDfdNode) {
  const style = dfdStyle.value
  const nodeStyle = dfdNodeStyle(node.kind)
  return style.autoNodeWidth
    ? Math.max(nodeStyle.width, textWidth(node.name, style.fontSize) + 34)
    : nodeStyle.width
}

function dfdSvgStyle() {
  const style = dfdStyle.value
  return `<defs>
    <marker id="dfd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${style.arrowSize}" markerHeight="${style.arrowSize}" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${style.lineColor}"/>
    </marker>
    <style>
      .dfd-edge-line { stroke: ${style.lineColor}; stroke-width: ${style.lineWidth}; fill: none; }
      .dfd-node-label { font-family: ${style.fontFamily}; fill: ${style.fontColor}; text-anchor: middle; dominant-baseline: central; font-size: ${style.fontSize}px; }
      .dfd-edge-label { font-family: ${style.fontFamily}; fill: ${style.fontColor}; font-size: ${Math.max(10, style.fontSize - 1)}px; }
    </style>
  </defs>`
}

function drawDfdNodeShape(kind: DfdNodeKind, x: number, y: number, w: number, h: number) {
  const globalStyle = dfdStyle.value
  const nodeStyle = dfdNodeStyle(kind)
  const stroke = globalStyle.borderColor
  const strokeW = globalStyle.borderWidth
  const fill = nodeStyle.fill
  const shape = nodeStyle.shape
  if (shape === 'box3d') {
    const side = Math.min(12, Math.max(7, h / 5))
    return `<polygon points="${x + side},${y - side} ${x + w + side},${y - side} ${x + w},${y} ${x},${y}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>
      <polygon points="${x + w},${y} ${x + w + side},${y - side} ${x + w + side},${y + h - side} ${x + w},${y + h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`
  }
  if (shape === 'rounded') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${nodeStyle.radius || h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`
  }
  if (shape === 'store') {
    const open = Math.min(18, w / 8)
    return `<path d="M ${x + open} ${y} H ${x + w} M ${x + open} ${y + h} H ${x + w} M ${x + open} ${y} C ${x - open / 2} ${y + h / 4}, ${x - open / 2} ${y + h * 0.75}, ${x + open} ${y + h}" fill="none" stroke="${stroke}" stroke-width="${strokeW}"/>
      <path d="M ${x + open} ${y} H ${x + w} V ${y + h} H ${x + open}" fill="${fill}" fill-opacity="0.78" stroke="none"/>`
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${nodeStyle.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`
}

function generateDFDSVG(nodes: RenderDfdNode[], flows: RenderDfdFlow[]): string {
  const style = dfdStyle.value
  const layoutMode = dfdLayoutMode.value
  const dragMargin = 90
  const colGap = layoutMode === 'wide' ? Math.round(style.horizontalGap * 1.35) : style.horizontalGap
  const rowGap = layoutMode === 'vertical' ? Math.round(style.verticalGap * 0.9) : style.verticalGap
  const minColW = Math.max(
    style.nodeStyles.entity.width,
    style.nodeStyles.process.width,
    style.nodeStyles.store.width,
    120
  )
  const grouped: Record<DfdNodeKind, RenderDfdNode[]> = {
    entity: nodes.filter((node) => node.kind === 'entity'),
    process: nodes.filter((node) => node.kind === 'process'),
    store: nodes.filter((node) => node.kind === 'store'),
  }
  const kinds: DfdNodeKind[] = layoutMode === 'vertical' ? ['process', 'entity', 'store'] : ['entity', 'process', 'store']
  const colWidths = kinds.map((kind) => Math.max(minColW, ...grouped[kind].map((node) => dfdNodeWidth(node))))
  const maxRows = Math.max(1, ...kinds.map((kind) => grouped[kind].length))
  const maxNodeH = Math.max(...Object.values(style.nodeStyles).map((item) => item.height))
  const contentH = Math.max(300, (maxRows - 1) * rowGap + maxNodeH)
  const hasPresetLayout = nodes.some((node) => Boolean(presetPosition(node.name, layoutMode)))
  const positions = new Map<number, DfdPosition>()

  let cursorX = dragMargin
  kinds.forEach((kind, colIndex) => {
    const items = grouped[kind]
    const colW = colWidths[colIndex]
    const balancedShift = layoutMode === 'balanced' && kind === 'process' ? Math.round(colGap * 0.18) : 0
    const cx = cursorX + colW / 2 + balancedShift
    const columnHeight = Math.max(0, (items.length - 1) * rowGap)
    const startY = dragMargin + contentH / 2 - columnHeight / 2

    items.forEach((node, index) => {
      const w = dfdNodeWidth(node)
      const h = dfdNodeStyle(kind).height
      const preset = hasPresetLayout ? presetPosition(node.name, layoutMode) : null
      const verticalBaseX = dragMargin + colWidths.reduce((sum, width) => sum + width, 0) / 2
      const verticalOffsetX = kind === 'entity' ? -Math.round(colGap * 0.7) : kind === 'store' ? Math.round(colGap * 0.7) : 0
      positions.set(node.id, {
        id: node.id,
        cx: (preset?.x ?? (layoutMode === 'vertical' ? verticalBaseX + verticalOffsetX : cx)) + node.offsetX,
        cy: (preset?.y ?? (layoutMode === 'vertical' ? dragMargin + index * rowGap + (kind === 'process' ? 0 : rowGap / 2) : startY + index * rowGap)) + node.offsetY,
        w,
        h,
        kind,
        index,
      })
    })
    cursorX += colW + colGap
  })

  // Expand canvas to fit all nodes including drag offsets
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  positions.forEach((pos) => {
    const halfW = pos.w / 2 + 60
    const halfH = pos.h / 2 + 60
    minX = Math.min(minX, pos.cx - halfW)
    minY = Math.min(minY, pos.cy - halfH)
    maxX = Math.max(maxX, pos.cx + halfW)
    maxY = Math.max(maxY, pos.cy + halfH)
  })

  const baseW = Math.max(980, dragMargin * 2 + colWidths.reduce((sum, width) => sum + width, 0) + colGap * 2)
  const baseH = Math.max(720, dragMargin * 2 + contentH)
  const padX = dragMargin
  const padY = dragMargin
  const shiftX = minX < padX ? padX - minX : 0
  const shiftY = minY < padY ? padY - minY : 0
  const totalW = Math.max(baseW, maxX + padX + shiftX)
  const totalH = Math.max(baseH, maxY + padY + shiftY)

  if (shiftX || shiftY) {
    positions.forEach((pos) => {
      pos.cx += shiftX
      pos.cy += shiftY
    })
  }

  const pairIndexes = new Map<string, number>()
  const pairCounts = new Map<string, number>()
  flows.forEach((flow) => {
    const key = [flow.fromId, flow.toId].sort((a, b) => a - b).join('<>')
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1)
  })

  let flowLines = ''
  let nodeShapes = ''
  const flowLabelCandidates: DfdLabelCandidate[] = []

  flows.forEach((flow) => {
    const from = positions.get(flow.fromId)
    const to = positions.get(flow.toId)
    if (!from || !to) return

    const key = [flow.fromId, flow.toId].sort((a, b) => a - b).join('<>')
    const pairIndex = pairIndexes.get(key) || 0
    pairIndexes.set(key, pairIndex + 1)
    const pairCount = pairCounts.get(key) || 1

    if (from.id === to.id) {
      const x = from.cx + from.w / 2
      const y = from.cy
      flowLines += `<path class="dfd-edge-line" d="M ${x} ${y - 10} C ${x + 72} ${y - 62}, ${x + 72} ${y + 62}, ${x} ${y + 10}" marker-end="url(#dfd-arrow)"/>`
      flowLabelCandidates.push(createDfdLabelCandidate(flow.label, x + 86, y, dfdLabelZone(from, to)))
      return
    }

    const dx = to.cx - from.cx
    const dy = to.cy - from.cy
    const distance = Math.sqrt(dx * dx + dy * dy) || 1
    const unitX = dx / distance
    const unitY = dy / distance
    const stableDirection = from.id <= to.id ? 1 : -1
    const normalX = (-dy / distance) * stableDirection
    const normalY = (dx / distance) * stableDirection
    const spread = (pairIndex - (pairCount - 1) / 2) * 26
    const start = nodeBoundaryPoint(from, to.cx, to.cy)
    const end = nodeBoundaryPoint(to, from.cx, from.cy)
    const sx = start.x + normalX * spread
    const sy = start.y + normalY * spread
    const ex = end.x + normalX * spread
    const ey = end.y + normalY * spread
    const labelOffset = (pairIndex - (pairCount - 1) / 2) * 30
    const labelW = flowLabelWidth(flow.label)
    const labelH = flowLabelHeight()
    const labelHalfProjection = Math.abs(normalX) * (labelW / 2) + Math.abs(normalY) * (labelH / 2)
    const sideOffset = labelHalfProjection + 18 + Math.abs(spread) * 0.35

    if (style.lineStyle === 'orthogonal') {
      const midX = Math.round((sx + ex) / 2)
      flowLines += `<path class="dfd-edge-line" d="M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ey} L ${ex} ${ey}" marker-end="url(#dfd-arrow)"/>`
    } else {
      flowLines += `<line class="dfd-edge-line" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" marker-end="url(#dfd-arrow)"/>`
    }
    flowLabelCandidates.push(chooseDfdLabelCandidate(
      flow.label,
      from,
      to,
      sx,
      sy,
      ex,
      ey,
      unitX,
      unitY,
      normalX,
      normalY,
      labelOffset,
      sideOffset,
      flowLabelCandidates,
      positions,
      totalW,
      totalH,
    ))
  })

  const flowLabels = flowLabelCandidates
    .map((label) => flowLabelSvg(label.label, label.x, label.y))
    .join('')

  nodes.forEach((node) => {
    const pos = positions.get(node.id)
    if (!pos) return
    const x = pos.cx - pos.w / 2
    const y = pos.cy - pos.h / 2

    nodeShapes += `<g class="draggable-dfd-node" data-id="${node.id}" style="cursor:move;">`
    nodeShapes += drawDfdNodeShape(node.kind, x, y, pos.w, pos.h)
    nodeShapes += `<text class="dfd-node-label" x="${pos.cx}" y="${pos.cy}">${esc(node.name)}</text>`
    nodeShapes += `</g>`
  })

  const background = `<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="${style.backgroundColor}"/>`
  return buildSvg(totalW, totalH, dfdSvgStyle() + background + flowLines + nodeShapes + flowLabels) + '</svg>'
}

function openQuickFill() {
  const nodeLines = nodes.value.map((node) => `${nodeKindLabel(node.kind)}：${node.name}`)
  const nodeMap = new Map(nodes.value.map((node) => [node.id, node.name]))
  const flowLines = flows.value.map((flow) => `${nodeMap.get(flow.fromId) || ''} -> ${nodeMap.get(flow.toId) || ''}：${flow.label}`)
  quickFillText.value = [...nodeLines, ...flowLines].filter(Boolean).join('\n')
  quickFillVisible.value = true
}

function applyQuickFill() {
  const parsed = parseQuickFill(quickFillText.value)
  nodes.value = parsed.nodes
  flows.value = parsed.flows
  quickFillVisible.value = false
}

function parseQuickFill(text: string): { nodes: DfdNode[]; flows: DataFlow[] } {
  const parsedNodes: DfdNode[] = []
  const pendingFlows: Array<{ from: string; to: string; label: string }> = []

  text.split('\n').forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line) return

    const arrowMatch = line.match(/^(.+?)(?:->|→|到)(.+?)(?:：|:)(.+)$/)
    if (arrowMatch) {
      pendingFlows.push({
        from: arrowMatch[1].trim(),
        to: arrowMatch[2].trim(),
        label: arrowMatch[3].trim(),
      })
      return
    }

    const idx = line.includes('：') ? line.indexOf('：') : line.indexOf(':')
    const prefix = idx === -1 ? '' : line.slice(0, idx).trim()
    const name = idx === -1 ? line : line.slice(idx + 1).trim()
    const kind = parseNodeKind(prefix)
    parsedNodes.push(createNode(kind, name || `${nodeKindLabel(kind)}${parsedNodes.length + 1}`))
  })

  const nameMap = new Map(parsedNodes.map((node) => [node.name, node.id]))
  const parsedFlows = pendingFlows
    .map((flow) => {
      const fromId = nameMap.get(flow.from)
      const toId = nameMap.get(flow.to)
      if (!fromId || !toId) return null
      return createFlow(fromId, toId, flow.label)
    })
    .filter((flow): flow is DataFlow => Boolean(flow))

  return { nodes: parsedNodes, flows: parsedFlows }
}

function parseNodeKind(prefix: string): DfdNodeKind {
  if (/外部|实体|参与者|用户|管理员|读者/.test(prefix)) return 'entity'
  if (/存储|数据库|数据表|文件/.test(prefix)) return 'store'
  return 'process'
}

function loadExample() {
  const admin = createNode('entity', '图书管理员')
  const manage = createNode('process', '图书管理')
  const readerInfo = createNode('store', '读者信息')
  const bookStore = createNode('store', '图书信息数据库')
  const query = createNode('process', '图书查询')
  const borrow = createNode('process', '图书借阅')
  const borrowStore = createNode('store', '借阅记录数据库')
  const reader = createNode('entity', '读者')
  const log = createNode('process', '图书日志')

  nodes.value = [admin, manage, readerInfo, bookStore, query, borrow, borrowStore, reader, log]
  flows.value = [
    createFlow(admin.id, manage.id, '图书管理指令'),
    createFlow(manage.id, admin.id, '管理结果'),
    createFlow(manage.id, readerInfo.id, '读者更新信息'),
    createFlow(bookStore.id, manage.id, '图书更新信息'),
    createFlow(bookStore.id, query.id, '图书查询条件'),
    createFlow(query.id, bookStore.id, '图书数据'),
    createFlow(query.id, bookStore.id, '查询图书信息'),
    createFlow(bookStore.id, query.id, '图书信息'),
    createFlow(readerInfo.id, borrow.id, '验证读者信息'),
    createFlow(borrow.id, readerInfo.id, '读者信息'),
    createFlow(reader.id, borrow.id, '借书请求'),
    createFlow(borrow.id, reader.id, '借书确认'),
    createFlow(borrow.id, borrowStore.id, '记录借阅信息'),
    createFlow(borrowStore.id, log.id, '更新借阅记录'),
    createFlow(reader.id, query.id, '查询请求'),
    createFlow(query.id, reader.id, '查询结果'),
    createFlow(reader.id, log.id, '还书申请'),
    createFlow(log.id, reader.id, '还书确认'),
  ]
}

function clearAll() {
  nodes.value = []
  flows.value = []
  if (previewEl.value) previewEl.value.innerHTML = ''
}

async function exportPng() {
  if (!previewEl.value) return
  await exportToPng(previewEl.value, '数据流图')
  ElMessage.success('PNG导出成功')
}

async function exportSvg() {
  if (!previewEl.value) return
  await exportToSvg(previewEl.value, '数据流图')
  ElMessage.success('SVG导出成功')
}

function currentSvgSource() {
  const svgEl = previewEl.value?.querySelector('svg')
  if (!svgEl) return previewEl.value?.innerHTML || ''
  return new XMLSerializer().serializeToString(svgEl)
}

async function copySource() {
  const svg = currentSvgSource()
  await copyToClipboard(svg)
  ElMessage.success('SVG源码已复制')
}

async function openDrawIo() {
  if (hasContent.value) {
    await copyToClipboard(currentSvgSource())
    ElMessage.success('已复制SVG源码，可在 Draw.io 中粘贴导入')
  }
  window.open('https://app.diagrams.net/?splash=0', '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  loadStoredStyle()
  const cached = readDiagramStorage('diagram:dfd')
  if (cached) {
    try {
      const data = JSON.parse(cached)
      let nextId = Date.now()
      if (data.nodes) {
        const nodeMap = new Map<string, number>()
        nodes.value = data.nodes.map((n: any) => {
          const id = nextId++
          nodeMap.set(n.name, id)
          return { id, name: n.name, kind: n.kind || 'process', offsetX: 0, offsetY: 0 }
        })
        if (data.flows) {
          flows.value = data.flows.map((f: any) => ({
            id: nextId++,
            fromId: nodeMap.get(f.from) ?? 0,
            toId: nodeMap.get(f.to) ?? 0,
            label: f.label || '',
          })).filter((f: any) => f.fromId !== 0 && f.toId !== 0)
        }
      }
      nextTick(renderDiagram)
      return
    } catch { /* ignore */ }
  }
  loadExample()
  nextTick(renderDiagram)
})
</script>

<style scoped>
:global(.diagram-left .input-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:global(.diagram-left .input-card > .el-card__body) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dfd-editor {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-right: 4px;
}

.dfd-editor .editor-hint {
  color: var(--t3);
  font-size: 12px;
  line-height: 1.6;
  padding: 4px 0 2px;
}

.dfd-editor :deep(.el-tabs) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.dfd-editor :deep(.el-tabs__header) {
  flex: 0 0 auto;
  margin-bottom: 10px;
}

.dfd-editor :deep(.el-tabs__content) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.dfd-editor :deep(.el-tab-pane) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.dfd-editor .editor-section {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 0;
}

.dfd-node-section,
.dfd-flow-section {
  scroll-margin-top: 92px;
}

.dfd-editor .editor-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.editor-row.dfd-node-row {
  grid-template-columns: 118px minmax(0, 1fr) 44px 28px;
}

.editor-row.dfd-flow-row {
  grid-template-columns: minmax(92px, 0.8fr) 18px minmax(92px, 0.8fr) minmax(120px, 1.2fr) 28px;
}

.flow-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--t4);
  font-size: 13px;
}

.text-action {
  width: 44px;
  font-size: 12px;
  color: var(--accent);
}

:global(.dfd-style-dialog.el-dialog) {
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow: hidden;
  background: #fff !important;
}

:global(.dfd-style-dialog .el-dialog__header) {
  flex: 0 0 auto;
  padding: 18px 22px 12px !important;
  margin-right: 0 !important;
  background: #fff !important;
}

:global(.dfd-style-dialog .el-dialog__body) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 4px 18px 8px 22px !important;
  background: #fff !important;
}

:global(.dfd-style-dialog .el-dialog__footer) {
  flex: 0 0 auto;
  padding: 10px 18px 16px !important;
  border-top: 1px solid #edf1f6 !important;
  background: #fff !important;
}

.dfd-style-panel {
  max-height: calc(100vh - 158px);
  overflow: auto;
  padding-right: 8px;
}

.dfd-style-switches {
  display: grid;
  gap: 14px;
  padding: 4px 0 10px;
}

.style-switch-row {
  display: grid;
  grid-template-columns: 112px auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.style-switch-row span {
  color: #606b7c;
  font-size: 14px;
  text-align: right;
}

.style-switch-row em {
  color: #8a93a3;
  font-size: 12px;
  font-style: normal;
}

.style-section {
  margin-top: 16px;
  border-top: 1px solid #dce4ef;
}

.style-section-title {
  display: inline-block;
  transform: translateY(-50%);
  margin-left: 28px;
  padding: 0 12px;
  background: #fff;
  color: #111827;
  font-weight: 700;
  font-size: 14px;
}

.style-grid {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 96px minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  row-gap: 12px;
  padding: 0 4px 16px;
}

.style-grid label {
  text-align: right;
  color: #606b7c;
  font-size: 14px;
}

.style-grid :deep(.el-input-number),
.style-grid :deep(.el-select) {
  width: 100%;
}

@media (max-width: 620px) {
  .dfd-input-actions {
    grid-template-columns: 1fr;
  }

  .style-switch-row,
  .style-grid {
    grid-template-columns: 88px minmax(0, 1fr);
  }
}
</style>
