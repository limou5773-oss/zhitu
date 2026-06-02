<template>
  <DiagramLayout
    title="流程图"
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
      <div class="structured-editor">
        <div class="editor-hint">逐步编辑流程节点，右侧实时生成流程图</div>

        <el-tabs v-model="activeEditorTab" type="card">
          <el-tab-pane label="节点编辑" name="nodes">
            <div class="editor-section">
              <div class="editor-section-title">
                <span>流程节点（{{ steps.length }}）</span>
                <button class="editor-add" type="button" @click="addStep()">+ 新增节点</button>
              </div>
              <div class="editor-list">
                <div
                  v-for="(step, index) in steps"
                  :key="step.id"
                  class="editor-row step"
                >
                  <el-select v-model="step.type" size="default">
                    <el-option label="开始" value="start" />
                    <el-option label="处理" value="process" />
                    <el-option label="输入/输出" value="io" />
                    <el-option label="判断" value="decision" />
                    <el-option label="是" value="yes" />
                    <el-option label="否" value="no" />
                    <el-option label="结束" value="end" />
                  </el-select>
                  <el-input v-model="step.text" :placeholder="`步骤${index + 1}`" />
                  <button class="editor-action danger" type="button" title="删除步骤" @click="removeStep(index)">×</button>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="连线编辑" name="connections">
            <div class="editor-section">
              <div class="editor-section-title">
                <span>流程连线（{{ connections.length }}）</span>
                <div class="flow-editor-actions">
                  <button class="editor-add" type="button" @click="syncAutoConnections(false)">自动连线</button>
                  <button class="editor-add" type="button" @click="addConnection()">+ 新增连线</button>
                </div>
              </div>
              <div class="flow-connection-help">
                默认按节点顺序连线；需要改走向时，选择“起点 → 终点”，中间输入线上文字，例如“是 / 否”。
              </div>
              <div class="editor-list">
                <div
                  v-for="(link, index) in connections"
                  :key="link.id"
                  class="flow-connection-row"
                >
                  <span class="editor-icon">↕</span>
                  <el-select v-model="link.fromId" filterable placeholder="起点" @change="markConnectionsManual">
                    <el-option
                      v-for="item in nodeOptions"
                      :key="`from-${link.id}-${item.value}`"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                  <el-input v-model="link.label" placeholder="线文字" @input="markConnectionsManual" />
                  <span class="arrow-label">→</span>
                  <el-select v-model="link.toId" filterable placeholder="终点" @change="markConnectionsManual">
                    <el-option
                      v-for="item in nodeOptions"
                      :key="`to-${link.id}-${item.value}`"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                  <button class="editor-action danger" type="button" title="删除连线" @click="removeConnection(index)">×</button>
                </div>
                <div v-if="connections.length === 0" class="flow-empty-state">
                  先添加流程节点，或点击“自动连线”生成默认连接关系。
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
      <el-button size="small" plain :disabled="!hasContent" @click="generateUseCaseDiagram">生成用例图</el-button>
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
      <div v-if="!hasContent" class="diagram-placeholder">请添加流程步骤</div>
      <div v-else ref="previewEl" style="width:100%;overflow:visible;"></div>
    </template>
  </DiagramLayout>

  <el-dialog v-model="quickFillVisible" title="快速填写流程节点" width="640px">
    <div class="quick-fill-help">
      每行一个流程节点；可写“开始 / 结束 / 判断：内容 / 输入/输出：内容 / 处理：内容 / 是：内容 / 否：内容”。
    </div>
    <el-input
      v-model="quickFillText"
      type="textarea"
      :rows="13"
      placeholder="开始&#10;判断：用户是否已注册？&#10;输入/输出：输入用户名和密码&#10;处理：验证用户信息&#10;是：进入首页&#10;否：提示登录失败&#10;结束"
    />
    <template #footer>
      <el-button @click="quickFillVisible = false">取消</el-button>
      <el-button type="primary" @click="applyQuickFill">确认填充</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="styleDialogVisible"
    title="流程图样式设置"
    width="620px"
    top="16px"
    class="flow-style-dialog"
    append-to-body
  >
    <div v-if="styleDraft" class="flow-style-panel">
      <div class="flow-style-switches">
        <div class="style-switch-row">
          <span>实时渲染</span>
          <el-switch v-model="styleDraft.realTimeRender" />
          <em>开启后编辑器或样式变动会立即刷新图表。</em>
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
          <el-input-number v-model="styleDraft.horizontalGap" :min="80" :max="520" :step="10" controls-position="right" size="small" />
          <label>垂直间距</label>
          <el-input-number v-model="styleDraft.verticalGap" :min="60" :max="320" :step="10" controls-position="right" size="small" />
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
          <label>箭头样式</label>
          <el-select v-model="styleDraft.arrowStyle" size="small">
            <el-option label="开放箭头" value="open" />
            <el-option label="实心箭头" value="filled" />
            <el-option label="无箭头" value="none" />
          </el-select>
          <label>箭头粗细</label>
          <el-input-number v-model="styleDraft.arrowSize" :min="4" :max="16" controls-position="right" size="small" />
          <label>起始结束样式</label>
          <el-select v-model="styleDraft.terminalShape" size="small">
            <el-option label="圆角矩形" value="rounded" />
            <el-option label="矩形" value="rect" />
          </el-select>
          <label>圆角大小</label>
          <el-input-number v-model="styleDraft.nodeRadius" :min="0" :max="70" controls-position="right" size="small" />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">节点颜色</div>
        <div class="style-grid">
          <label>起始</label>
          <el-color-picker v-model="styleDraft.nodeColors.start" size="small" show-alpha />
          <label>结束</label>
          <el-color-picker v-model="styleDraft.nodeColors.end" size="small" show-alpha />
          <label>处理</label>
          <el-color-picker v-model="styleDraft.nodeColors.process" size="small" show-alpha />
          <label>判断</label>
          <el-color-picker v-model="styleDraft.nodeColors.decision" size="small" show-alpha />
          <label>输入/输出</label>
          <el-color-picker v-model="styleDraft.nodeColors.io" size="small" show-alpha />
          <label>分支节点</label>
          <el-color-picker v-model="styleDraft.nodeColors.branch" size="small" show-alpha />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">节点尺寸</div>
        <div class="style-grid">
          <label>起始尺寸 宽</label>
          <el-input-number v-model="styleDraft.nodeSizes.start.width" :min="80" :max="320" controls-position="right" size="small" />
          <label>高</label>
          <el-input-number v-model="styleDraft.nodeSizes.start.height" :min="32" :max="160" controls-position="right" size="small" />
          <label>结束尺寸 宽</label>
          <el-input-number v-model="styleDraft.nodeSizes.end.width" :min="80" :max="320" controls-position="right" size="small" />
          <label>高</label>
          <el-input-number v-model="styleDraft.nodeSizes.end.height" :min="32" :max="160" controls-position="right" size="small" />
          <label>处理尺寸 宽</label>
          <el-input-number v-model="styleDraft.nodeSizes.process.width" :min="80" :max="340" controls-position="right" size="small" />
          <label>高</label>
          <el-input-number v-model="styleDraft.nodeSizes.process.height" :min="32" :max="160" controls-position="right" size="small" />
          <label>判断尺寸 宽</label>
          <el-input-number v-model="styleDraft.nodeSizes.decision.width" :min="100" :max="380" controls-position="right" size="small" />
          <label>高</label>
          <el-input-number v-model="styleDraft.nodeSizes.decision.height" :min="50" :max="180" controls-position="right" size="small" />
          <label>输入/输出尺寸 宽</label>
          <el-input-number v-model="styleDraft.nodeSizes.io.width" :min="80" :max="340" controls-position="right" size="small" />
          <label>高</label>
          <el-input-number v-model="styleDraft.nodeSizes.io.height" :min="32" :max="160" controls-position="right" size="small" />
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
import { computed, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import DiagramLayout from '@/components/DiagramLayout.vue'
import { exportToPng, exportToSvg, copyToClipboard } from '@/utils/export'
import { buildSvg, textWidth } from '@/utils/svg-style'
import { readDiagramStorage } from '@/utils/diagramStorage'
import { ElMessage } from 'element-plus'

type FlowLineStyle = 'straight' | 'orthogonal'
type FlowArrowStyle = 'open' | 'filled' | 'none'
type FlowTerminalShape = 'rounded' | 'rect'
type FlowSizeKey = 'start' | 'end' | 'process' | 'decision' | 'io'
type FlowLayoutMode = 'default' | 'horizontal' | 'wide' | 'compact' | 'spine'
type FlowAnchorSide = 'top' | 'right' | 'bottom' | 'left'
type FlowEditorTab = 'nodes' | 'connections'

interface FlowNodeSize {
  width: number
  height: number
}

interface FlowchartStyle {
  realTimeRender: boolean
  lineStyle: FlowLineStyle
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
  arrowStyle: FlowArrowStyle
  arrowSize: number
  terminalShape: FlowTerminalShape
  nodeRadius: number
  nodeColors: Record<'start' | 'end' | 'process' | 'decision' | 'io' | 'branch', string>
  nodeSizes: Record<FlowSizeKey, FlowNodeSize>
}

const FLOWCHART_STYLE_STORAGE_KEY = 'diagram:flowchart-style'
const FLOW_LAYOUT_MODES: FlowLayoutMode[] = ['default', 'horizontal', 'wide', 'compact', 'spine']
const LEGACY_COMPACT_FLOW_SIZES: Record<FlowSizeKey, FlowNodeSize> = {
  start: { width: 110, height: 44 },
  end: { width: 110, height: 44 },
  process: { width: 120, height: 48 },
  decision: { width: 150, height: 66 },
  io: { width: 130, height: 48 },
}

const flowLayoutMode = ref<FlowLayoutMode>('default')
const activeEditorTab = ref<FlowEditorTab>('nodes')
const steps = ref<FlowNode[]>([])
const connections = ref<FlowConnection[]>([])
const manualConnectionsEnabled = ref(false)
const flowchartStyle = ref<FlowchartStyle>(createDefaultFlowchartStyle())
const styleDraft = ref<FlowchartStyle | null>(null)
const styleSnapshot = ref<FlowchartStyle | null>(null)
const styleDialogVisible = ref(false)
const quickFillVisible = ref(false)
const quickFillText = ref('')
const previewEl = ref<HTMLElement>()
const layoutRef = ref<InstanceType<typeof DiagramLayout>>()
const router = useRouter()

let timer: number | undefined
let nodeId = 0
let connectionId = 0
let draggingNodeId: number | null = null
let dragStartPoint = { x: 0, y: 0 }
let dragStartOffset = { x: 0, y: 0 }

watch([steps, flowLayoutMode, flowchartStyle], () => {
  if (activeEditorTab.value === 'connections' && !manualConnectionsEnabled.value) {
    connections.value = buildDefaultConnections(getRenderSteps())
  }
  window.clearTimeout(timer)
  timer = window.setTimeout(() => { renderDiagram() }, 300)
}, { deep: true })

watch(activeEditorTab, (tab) => {
  if (tab === 'connections' && connections.value.length === 0) {
    syncAutoConnections(false)
  }
})

watch(connections, () => {
  if (!manualConnectionsEnabled.value) return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => { renderDiagram() }, 180)
}, { deep: true })

watch(styleDraft, (draft) => {
  if (!styleDialogVisible.value || !draft?.realTimeRender) return
  flowchartStyle.value = normalizeFlowchartStyle(cloneFlowchartStyle(draft))
  saveCurrentStyle()
  window.clearTimeout(timer)
  timer = window.setTimeout(renderDiagram, 120)
}, { deep: true })

type FlowNodeType = 'start' | 'end' | 'decision' | 'process' | 'io' | 'yes' | 'no'

interface FlowNode {
  id: number
  text: string
  type: FlowNodeType
  offsetX: number
  offsetY: number
}

interface FlowConnection {
  id: number
  fromId: number | null
  toId: number | null
  label: string
}

interface FlowBox {
  x: number
  y: number
  w: number
  h: number
  type: FlowNodeType
}

const hasContent = computed(() => steps.value.some((step) => step.text.trim()))
const nodeOptions = computed(() => steps.value
  .filter((step) => step.text.trim())
  .map((step, index) => ({
    label: `${index + 1}. ${flowNodeTypeName(step.type)}：${step.text.trim()}`,
    value: step.id,
  })))

function createDefaultFlowchartStyle(): FlowchartStyle {
  return {
    realTimeRender: true,
    lineStyle: 'orthogonal',
    autoNodeWidth: true,
    horizontalGap: 270,
    verticalGap: 120,
    backgroundColor: '#ffffff',
    edgeLabelBackground: 'transparent',
    borderColor: '#000000',
    fontColor: '#000000',
    fontFamily: 'SimSun, 宋体, Times New Roman, serif',
    fontSize: 16,
    lineColor: '#000000',
    lineWidth: 1.4,
    arrowStyle: 'open',
    arrowSize: 6,
    terminalShape: 'rounded',
    nodeRadius: 24,
    nodeColors: {
      start: '#ffffff',
      end: '#ffffff',
      process: '#ffffff',
      decision: '#ffffff',
      io: '#ffffff',
      branch: '#ffffff',
    },
    nodeSizes: {
      start: { width: 128, height: 54 },
      end: { width: 128, height: 54 },
      process: { width: 148, height: 64 },
      decision: { width: 180, height: 96 },
      io: { width: 172, height: 64 },
    },
  }
}

function normalizeFlowchartStyle(style: FlowchartStyle): FlowchartStyle {
  const defaults = createDefaultFlowchartStyle()
  const nodeSizes = {
    ...defaults.nodeSizes,
    ...(style.nodeSizes || {}),
  }
  const nodeColors = normalizeFlowNodeColors(style.nodeColors || {}, defaults.nodeColors)
  return {
    ...defaults,
    ...style,
    horizontalGap: Math.max(80, Math.min(520, style.horizontalGap || defaults.horizontalGap)),
    verticalGap: Math.max(60, Math.min(320, style.verticalGap || defaults.verticalGap)),
    fontSize: Math.max(10, Math.min(40, style.fontSize || defaults.fontSize)),
    lineWidth: Math.max(0.5, Math.min(8, style.lineWidth || defaults.lineWidth)),
    arrowSize: Math.max(4, Math.min(16, style.arrowSize || defaults.arrowSize)),
    nodeColors,
    nodeSizes: {
      start: normalizeFlowSize(nodeSizes.start, defaults.nodeSizes.start),
      end: normalizeFlowSize(nodeSizes.end, defaults.nodeSizes.end),
      process: normalizeFlowSize(nodeSizes.process, defaults.nodeSizes.process),
      decision: normalizeFlowSize(nodeSizes.decision, defaults.nodeSizes.decision),
      io: normalizeFlowSize(nodeSizes.io, defaults.nodeSizes.io),
    },
  }
}

function normalizeFlowNodeColors(
  colors: Partial<FlowchartStyle['nodeColors']>,
  fallback: FlowchartStyle['nodeColors']
) {
  const legacyDefaults = {
    start: '#e6fbf6',
    end: '#e6fbf6',
    process: '#eaf6ff',
    decision: '#fffbe6',
    io: '#eef8ea',
    branch: '#f5eafa',
  }
  const keys = Object.keys(fallback) as Array<keyof FlowchartStyle['nodeColors']>
  const isLegacyDefault = keys.every((key) => !colors[key] || colors[key]?.toLowerCase() === legacyDefaults[key].toLowerCase())
  if (isLegacyDefault) return { ...fallback }
  return { ...fallback, ...colors }
}

function normalizeFlowSize(size: FlowNodeSize, fallback: FlowNodeSize) {
  return {
    width: Math.max(60, Math.min(380, size?.width || fallback.width)),
    height: Math.max(32, Math.min(180, size?.height || fallback.height)),
  }
}

function cloneFlowchartStyle(style: FlowchartStyle): FlowchartStyle {
  return JSON.parse(JSON.stringify(style))
}

function saveCurrentStyle() {
  localStorage.setItem(FLOWCHART_STYLE_STORAGE_KEY, JSON.stringify(flowchartStyle.value))
}

function loadStoredStyle() {
  const stored = localStorage.getItem(FLOWCHART_STYLE_STORAGE_KEY)
  if (!stored) return
  try {
    const parsed = JSON.parse(stored)
    if (isLegacyLargeFlowStyle(parsed) || isLegacySquareFlowStyle(parsed)) {
      localStorage.removeItem(FLOWCHART_STYLE_STORAGE_KEY)
      return
    }
    if (isLegacyCompactFlowSize(parsed.nodeSizes)) {
      parsed.nodeSizes = createDefaultFlowchartStyle().nodeSizes
    }
    flowchartStyle.value = normalizeFlowchartStyle({
      ...createDefaultFlowchartStyle(),
      ...parsed,
    })
  } catch {
    localStorage.removeItem(FLOWCHART_STYLE_STORAGE_KEY)
  }
}

function isLegacyLargeFlowStyle(style: Partial<FlowchartStyle>) {
  const sizes = (style.nodeSizes || {}) as Partial<Record<FlowSizeKey, Partial<FlowNodeSize>>>
  return style.fontSize === 20
    && style.lineWidth === 2
    && style.horizontalGap === 280
    && style.verticalGap === 180
    && sizes.start?.width === 180
    && sizes.start?.height === 90
    && sizes.process?.width === 180
    && sizes.process?.height === 90
    && sizes.decision?.width === 180
    && sizes.decision?.height === 100
}

function isLegacyCompactFlowSize(sizes?: Partial<Record<FlowSizeKey, Partial<FlowNodeSize>>>) {
  if (!sizes) return false
  return (Object.keys(LEGACY_COMPACT_FLOW_SIZES) as FlowSizeKey[]).every((key) => (
    sizes[key]?.width === LEGACY_COMPACT_FLOW_SIZES[key].width
    && sizes[key]?.height === LEGACY_COMPACT_FLOW_SIZES[key].height
  ))
}

function isLegacySquareFlowStyle(style: Partial<FlowchartStyle>) {
  const sizes = (style.nodeSizes || {}) as Partial<Record<FlowSizeKey, Partial<FlowNodeSize>>>
  return style.fontSize === 14
    && style.lineWidth === 1.2
    && style.horizontalGap === 260
    && style.verticalGap === 110
    && style.terminalShape === 'rect'
    && style.nodeRadius === 0
    && sizes.start?.width === 118
    && sizes.start?.height === 48
    && sizes.process?.width === 150
    && sizes.process?.height === 56
    && sizes.decision?.width === 190
    && sizes.decision?.height === 88
}

function createStep(type: FlowNodeType = 'process', text = ''): FlowNode {
  return { id: ++nodeId, type, text, offsetX: 0, offsetY: 0 }
}

function flowNodeTypeName(type: FlowNodeType) {
  const nameMap: Record<FlowNodeType, string> = {
    start: '开始',
    end: '结束',
    decision: '判断',
    process: '处理',
    io: '输入/输出',
    yes: '是',
    no: '否',
  }
  return nameMap[type]
}

function addStep(insertIndex?: number) {
  const item = createStep('process', `步骤${steps.value.length + 1}`)
  if (typeof insertIndex === 'number') {
    steps.value.splice(insertIndex, 0, item)
  } else {
    steps.value.push(item)
  }
}

function removeStep(index: number) {
  const removed = steps.value[index]
  steps.value.splice(index, 1)
  if (removed) {
    connections.value = connections.value.filter((link) => link.fromId !== removed.id && link.toId !== removed.id)
  }
  if (!manualConnectionsEnabled.value) {
    connections.value = []
  }
}

function createConnection(fromId: number | null = null, toId: number | null = null, label = ''): FlowConnection {
  return {
    id: ++connectionId,
    fromId,
    toId,
    label,
  }
}

function addConnection() {
  const options = nodeOptions.value
  const first = options[0]?.value ?? null
  const second = options[1]?.value ?? first
  connections.value.push(createConnection(first, second, ''))
  markConnectionsManual()
}

function removeConnection(index: number) {
  connections.value.splice(index, 1)
  markConnectionsManual()
}

function markConnectionsManual() {
  manualConnectionsEnabled.value = true
  window.clearTimeout(timer)
  timer = window.setTimeout(() => renderDiagram(), 80)
}

function syncAutoConnections(enableManual = false) {
  connections.value = buildDefaultConnections(getRenderSteps())
  manualConnectionsEnabled.value = enableManual
  window.clearTimeout(timer)
  nextTick(() => renderDiagram(true))
}

function buildDefaultConnections(nodes: FlowNode[]) {
  const result: FlowConnection[] = []
  let prevNode: FlowNode | null = null
  let pendingMerge: { yesNode?: FlowNode; noNode?: FlowNode } | null = null

  nodes.forEach((node, index) => {
    if (node.type === 'yes' || node.type === 'no') return

    if (pendingMerge) {
      if (pendingMerge.yesNode) result.push(createConnection(pendingMerge.yesNode.id, node.id))
      if (pendingMerge.noNode) result.push(createConnection(pendingMerge.noNode.id, node.id))
      pendingMerge = null
    } else if (prevNode) {
      result.push(createConnection(prevNode.id, node.id))
    }

    if (node.type === 'decision') {
      const branches = getImmediateBranches(nodes, index)
      if (branches.yesNode) result.push(createConnection(node.id, branches.yesNode.id, '是'))
      if (branches.noNode) result.push(createConnection(node.id, branches.noNode.id, '否'))
      if (branches.yesNode || branches.noNode) pendingMerge = branches
    }

    prevNode = node
  })

  return result
}

function openStyleDialog() {
  styleSnapshot.value = cloneFlowchartStyle(flowchartStyle.value)
  styleDraft.value = cloneFlowchartStyle(flowchartStyle.value)
  styleDialogVisible.value = true
}

function applyStyleDialog() {
  if (!styleDraft.value) return
  flowchartStyle.value = normalizeFlowchartStyle(cloneFlowchartStyle(styleDraft.value))
  saveCurrentStyle()
  styleSnapshot.value = null
  styleDialogVisible.value = false
  nextTick(() => renderDiagram(true))
}

function cancelStyleDialog() {
  if (styleSnapshot.value) {
    flowchartStyle.value = cloneFlowchartStyle(styleSnapshot.value)
  }
  styleDialogVisible.value = false
  styleDraft.value = null
  styleSnapshot.value = null
  nextTick(renderDiagram)
}

function restoreDefaultStyle() {
  styleDraft.value = createDefaultFlowchartStyle()
  flowchartStyle.value = normalizeFlowchartStyle(cloneFlowchartStyle(styleDraft.value))
  saveCurrentStyle()
  nextTick(() => renderDiagram(true))
}

function beautifyLayout() {
  steps.value.forEach((step) => {
    step.offsetX = 0
    step.offsetY = 0
  })
  const current = FLOW_LAYOUT_MODES.indexOf(flowLayoutMode.value)
  flowLayoutMode.value = FLOW_LAYOUT_MODES[(current + 1) % FLOW_LAYOUT_MODES.length]
  window.clearTimeout(timer)
  nextTick(() => renderDiagram(true))
  ElMessage.success('已重新排版')
}

function generateUseCaseDiagram() {
  const useCases = getRenderSteps()
    .filter((step) => !['start', 'end', 'yes', 'no'].includes(step.type))
    .map((step) => ({ name: step.text }))
  sessionStorage.setItem('diagram:usecase', JSON.stringify({
    systemName: '系统',
    actors: [{ name: '用户', useCases }],
  }))
  router.push('/use-case')
}

function openQuickFill() {
  quickFillText.value = steps.value.map((step) => {
    const prefixMap: Record<FlowNodeType, string> = {
      start: '开始',
      end: '结束',
      decision: '判断',
      process: '处理',
      io: '输入/输出',
      yes: '是',
      no: '否',
    }
    if (step.type === 'start' || step.type === 'end') return step.text
    return `${prefixMap[step.type]}：${step.text}`
  }).join('\n')
  quickFillVisible.value = true
}

function applyQuickFill() {
  const parsed = parseQuickFillText(quickFillText.value)
  steps.value = parsed.length ? parsed : []
  connections.value = []
  manualConnectionsEnabled.value = false
  quickFillVisible.value = false
  window.clearTimeout(timer)
  nextTick(() => renderDiagram(true))
}

function parseQuickFillText(text: string): FlowNode[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.includes('：') ? line.indexOf('：') : line.indexOf(':')
      const rawPrefix = idx === -1 ? '' : line.substring(0, idx).trim()
      const rawText = idx === -1 ? line : line.substring(idx + 1).trim()
      const textValue = rawText || line
      const normalized = rawPrefix || line

      if (normalized === '开始' || normalized.startsWith('开始')) return createStep('start', textValue.includes('开始') ? '开始' : textValue)
      if (normalized === '结束' || normalized.startsWith('结束')) return createStep('end', textValue.includes('结束') ? '结束' : textValue)
      if (normalized.includes('判断') || textValue.includes('是否') || textValue.endsWith('?') || textValue.endsWith('？')) return createStep('decision', textValue.replace(/^判断[：:]?\s*/, '') || '判断')
      if (normalized.includes('输入') || normalized.includes('输出')) return createStep('io', textValue || '输入/输出')
      if (normalized === '是' || normalized.startsWith('正确')) return createStep('yes', textValue || '是')
      if (normalized === '否' || normalized.startsWith('错误')) return createStep('no', textValue || '否')
      if (normalized.includes('处理')) return createStep('process', textValue || '处理')
      return createStep('process', line)
    })
}

function getRenderSteps(): FlowNode[] {
  return steps.value
    .filter((step) => step.text.trim())
    .map((step) => ({
      ...step,
      text: step.text.trim(),
    }))
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function flowSvgStyle() {
  const style = flowchartStyle.value
  const marker = style.arrowStyle === 'none'
    ? ''
    : style.arrowStyle === 'filled'
      ? `<marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${style.arrowSize}" markerHeight="${style.arrowSize}" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="${style.lineColor}"/>
        </marker>`
      : `<marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${style.arrowSize + 1}" markerHeight="${style.arrowSize + 1}" orient="auto-start-reverse">
          <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="${style.lineColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </marker>`

  return `<defs>
    ${marker}
    <style>
      .flow-node-shape { stroke: ${style.borderColor}; stroke-width: ${Math.max(1, style.lineWidth * 0.65)}; }
      .flow-node-label { font-family: ${style.fontFamily}; fill: ${style.fontColor}; text-anchor: middle; dominant-baseline: central; font-size: ${style.fontSize}px; }
      .flow-edge-line { stroke: ${style.lineColor}; stroke-width: ${style.lineWidth}; fill: none; }
      .flow-edge-label { font-family: ${style.fontFamily}; fill: ${style.fontColor}; font-size: ${Math.max(10, style.fontSize - 2)}px; }
    </style>
  </defs>`
}

function flowArrowAttr() {
  return flowchartStyle.value.arrowStyle === 'none' ? '' : ' marker-end="url(#flow-arrow)"'
}

function flowSizeKey(type: FlowNodeType): FlowSizeKey {
  if (type === 'start') return 'start'
  if (type === 'end') return 'end'
  if (type === 'decision') return 'decision'
  if (type === 'io') return 'io'
  return 'process'
}

function flowNodeColor(type: FlowNodeType) {
  const colors = flowchartStyle.value.nodeColors
  if (type === 'start') return colors.start
  if (type === 'end') return colors.end
  if (type === 'decision') return colors.decision
  if (type === 'io') return colors.io
  if (type === 'yes' || type === 'no') return colors.branch
  return colors.process
}

function flowNodeSize(type: FlowNodeType, text: string) {
  const style = flowchartStyle.value
  const key = flowSizeKey(type)
  const base = style.nodeSizes[key]
  const padding = type === 'decision' ? 76 : type === 'io' ? 52 : 34
  const maxAutoWidth = type === 'decision' ? 230 : type === 'io' ? 210 : 190
  const measuredWidth = Math.min(textWidth(text, style.fontSize) + padding, maxAutoWidth)
  const width = style.autoNodeWidth ? Math.max(base.width, measuredWidth) : base.width
  const lines = wrapFlowText(text, flowTextWidth(type, width), style.fontSize)
  const lineHeight = flowLineHeight()
  const verticalPadding = type === 'decision' ? 42 : 22
  const height = Math.max(base.height, Math.ceil(lines.length * lineHeight + verticalPadding))
  return {
    w: width,
    h: height,
  }
}

function flowLineHeight() {
  return Math.ceil(flowchartStyle.value.fontSize * 1.18)
}

function flowTextWidth(type: FlowNodeType, width: number) {
  if (type === 'decision') return Math.max(56, width * 0.62)
  if (type === 'io') return Math.max(56, width - 48)
  return Math.max(52, width - 30)
}

function wrapFlowText(text: string, maxWidth: number, fontSize: number) {
  const source = text.trim()
  if (!source) return ['']
  const lines: string[] = []
  let current = ''
  for (const char of source) {
    const next = `${current}${char}`
    if (current && textWidth(next, fontSize) > maxWidth && !/^[？?。！!，,、；;：:]$/.test(char)) {
      lines.push(current)
      current = char
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function flowLabelSvg(text: string, x: number, y: number, anchor = 'middle') {
  const style = flowchartStyle.value
  const w = Math.max(24, textWidth(text, Math.max(10, style.fontSize - 2)) + 10)
  const h = Math.max(18, style.fontSize + 4)
  const background = style.edgeLabelBackground?.toLowerCase()
  const backgroundRect = !background
    || background === 'transparent'
    || background === '#fff'
    || background === '#ffffff'
    || background === 'white'
    || background === 'rgba(0, 0, 0, 0)'
    || background === 'rgba(0,0,0,0)'
    ? ''
    : `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="2" fill="${style.edgeLabelBackground}"/>`
  return `<g pointer-events="none">
    ${backgroundRect}
    <text class="flow-edge-label" x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central">${esc(text)}</text>
  </g>`
}

function getValidManualConnections() {
  return connections.value.filter((link): link is FlowConnection & { fromId: number; toId: number } => (
    manualConnectionsEnabled.value
    && typeof link.fromId === 'number'
    && typeof link.toId === 'number'
    && link.fromId !== link.toId
  ))
}

function edgeLineWithLabel(from: FlowBox, to: FlowBox, label: string) {
  const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 }
  const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 }
  const labelText = label.trim()
  const labelSvg = labelText
    ? flowLabelSvg(labelText, Math.round((fromCenter.x + toCenter.x) / 2), Math.round((fromCenter.y + toCenter.y) / 2) - Math.max(10, flowchartStyle.value.fontSize * 0.7))
    : ''
  return edgeLineBetween(from, to) + labelSvg
}

function drawFlowNode(node: FlowNode, x: number, y: number, w: number, h: number, renderType: FlowNodeType = node.type) {
  const fill = flowNodeColor(renderType)
  let shape = ''
  if (renderType === 'start' || renderType === 'end') {
    const rx = flowchartStyle.value.terminalShape === 'rounded' ? Math.min(h / 2, flowchartStyle.value.nodeRadius) : Math.min(8, flowchartStyle.value.nodeRadius)
    shape = `<rect class="flow-node-shape" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${fill}"/>`
  } else if (renderType === 'decision') {
    const dcx = x + w / 2
    const dcy = y + h / 2
    shape = `<polygon class="flow-node-shape" points="${dcx},${y} ${x + w},${dcy} ${dcx},${y + h} ${x},${dcy}" fill="${fill}"/>`
  } else if (renderType === 'io') {
    const skew = Math.min(20, w * 0.12)
    shape = `<polygon class="flow-node-shape" points="${x + skew},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}" fill="${fill}"/>`
  } else {
    shape = `<rect class="flow-node-shape" x="${x}" y="${y}" width="${w}" height="${h}" rx="0" fill="${fill}"/>`
  }
  const textLines = wrapFlowText(node.text, flowTextWidth(renderType, w), flowchartStyle.value.fontSize)
  const lineHeight = flowLineHeight()
  const firstLineY = y + h / 2 - ((textLines.length - 1) * lineHeight) / 2
  const label = textLines.map((line, index) => (
    `<tspan x="${x + w / 2}" y="${firstLineY + index * lineHeight}">${esc(line)}</tspan>`
  )).join('')

  return `<g class="draggable-flow-node" data-node-id="${node.id}" style="cursor:move;">
    ${shape}
    <text class="flow-node-label">${label}</text>
  </g>`
}

function renderDiagram(fitPreview = false) {
  if (!previewEl.value) return
  const nodes = getRenderSteps()
  if (nodes.length === 0) { previewEl.value.innerHTML = ''; return }

  try {
    previewEl.value.innerHTML = generateFlowSVG(nodes, flowLayoutMode.value)
    bindFlowDrag()
    if (fitPreview) fitFlowPreview()
  } catch (e: any) {
    previewEl.value.innerHTML = `<div class="diagram-error">渲染失败：${e.message || ''}</div>`
  }
}

function fitFlowPreview() {
  layoutRef.value?.fitView?.({
    padding: 34,
    maxScale: 1.18,
    selector: '.draggable-flow-node,.flow-edge-line,.flow-edge-label',
  })
}

function bindFlowDrag() {
  if (!previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  if (!svg) return

  previewEl.value.querySelectorAll<SVGGElement>('.draggable-flow-node').forEach((group) => {
    group.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()

      const id = Number(group.dataset.nodeId)
      const target = steps.value.find((step) => step.id === id)
      if (!target) return

      draggingNodeId = id
      dragStartPoint = getSvgPoint(event, svg)
      dragStartOffset = { x: target.offsetX, y: target.offsetY }

      window.addEventListener('pointermove', handleFlowDrag)
      window.addEventListener('pointerup', stopFlowDrag, { once: true })
      window.addEventListener('pointercancel', stopFlowDrag, { once: true })
    })
  })
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

function handleFlowDrag(event: PointerEvent) {
  if (draggingNodeId === null || !previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  const target = steps.value.find((step) => step.id === draggingNodeId)
  if (!svg || !target) return

  event.preventDefault()
  const current = getSvgPoint(event, svg)
  target.offsetX = Math.round(dragStartOffset.x + current.x - dragStartPoint.x)
  target.offsetY = Math.round(dragStartOffset.y + current.y - dragStartPoint.y)
  window.clearTimeout(timer)
  renderDiagram()
}

function stopFlowDrag() {
  draggingNodeId = null
  window.removeEventListener('pointermove', handleFlowDrag)
}

function getImmediateBranches(nodes: FlowNode[], index: number): { yesNode?: FlowNode; noNode?: FlowNode } {
  const result: { yesNode?: FlowNode; noNode?: FlowNode } = {}
  for (let i = index + 1; i < nodes.length; i++) {
    const candidate = nodes[i]
    if (candidate.type === 'yes') {
      result.yesNode = result.yesNode || candidate
      continue
    }
    if (candidate.type === 'no') {
      result.noNode = result.noNode || candidate
      continue
    }
    break
  }
  return result
}

function boundaryPoint(box: FlowBox, targetX: number, targetY: number) {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const dx = targetX - cx
  const dy = targetY - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  const halfW = box.w / 2
  const halfH = box.h / 2
  const scale = box.type === 'decision'
    ? 1 / ((Math.abs(dx) / halfW) + (Math.abs(dy) / halfH))
    : 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH)

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  }
}

function fixedAnchorPoint(box: FlowBox, side: FlowAnchorSide) {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  if (side === 'top') return { x: cx, y: box.y }
  if (side === 'right') return { x: box.x + box.w, y: cy }
  if (side === 'bottom') return { x: cx, y: box.y + box.h }
  return { x: box.x, y: cy }
}

function chooseFlowAnchors(from: FlowBox, to: FlowBox): { fromSide: FlowAnchorSide; toSide: FlowAnchorSide } {
  const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 }
  const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 }
  const dx = toCenter.x - fromCenter.x
  const dy = toCenter.y - fromCenter.y

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0
      ? { fromSide: 'right', toSide: 'left' }
      : { fromSide: 'left', toSide: 'right' }
  }

  return dy >= 0
    ? { fromSide: 'bottom', toSide: 'top' }
    : { fromSide: 'top', toSide: 'bottom' }
}

function edgeLineBetween(from: FlowBox, to: FlowBox) {
  const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 }
  const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 }
  if (flowchartStyle.value.lineStyle === 'orthogonal') {
    const { fromSide, toSide } = chooseFlowAnchors(from, to)
    const start = fixedAnchorPoint(from, fromSide)
    const end = fixedAnchorPoint(to, toSide)
    if (start.x === end.x || start.y === end.y) {
      return `<path class="flow-edge-line" d="M ${start.x} ${start.y} L ${end.x} ${end.y}"${flowArrowAttr()}/>`
    }
    if (fromSide === 'left' || fromSide === 'right' || toSide === 'left' || toSide === 'right') {
      const midX = Math.round((start.x + end.x) / 2)
      return `<path class="flow-edge-line" d="M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}"${flowArrowAttr()}/>`
    }
    const midY = Math.round((start.y + end.y) / 2)
    return `<path class="flow-edge-line" d="M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}"${flowArrowAttr()}/>`
  }
  const start = boundaryPoint(from, toCenter.x, toCenter.y)
  const end = boundaryPoint(to, fromCenter.x, fromCenter.y)
  return `<line class="flow-edge-line" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"${flowArrowAttr()}/>`
}

function branchMergeLineBetween(from: FlowBox, to: FlowBox, avoid?: FlowBox) {
  if (flowchartStyle.value.lineStyle !== 'orthogonal') return edgeLineBetween(from, to)
  const start = fixedAnchorPoint(from, 'bottom')
  const targetSide: FlowAnchorSide = from.x + from.w / 2 >= to.x + to.w / 2 ? 'right' : 'left'
  const end = fixedAnchorPoint(to, targetSide)
  const laneY = Math.round(end.y)
  if (start.y === laneY) {
    return `<path class="flow-edge-line" d="M ${start.x} ${start.y} L ${end.x} ${end.y}"${flowArrowAttr()}/>`
  }
  return `<path class="flow-edge-line" d="M ${start.x} ${start.y} L ${start.x} ${laneY} L ${end.x} ${laneY}"${flowArrowAttr()}/>`
}

function generateFlowSVG(nodes: FlowNode[], layoutMode: FlowLayoutMode): string {
  if (layoutMode === 'horizontal') return generateHorizontalFlowSVG(nodes)

  const style = flowchartStyle.value
  const manualConnections = getValidManualConnections()
  const useManualConnections = manualConnections.length > 0
  const boxById = new Map<number, FlowBox>()
  const dragMargin = 140
  const isCompact = layoutMode === 'compact'
  const isWide = layoutMode === 'wide'
  const isSpine = layoutMode === 'spine'
  const gap = Math.max(26, Math.round(style.verticalGap * (isCompact ? 0.3 : isWide ? 0.5 : 0.42)))
  const branchGap = Math.max(40, Math.round(style.horizontalGap * (isWide ? 0.36 : isCompact ? 0.12 : 0.2)))

  let cy = dragMargin + 30
  const totalW = Math.max(620 + dragMargin * 2, style.horizontalGap + (isWide ? 700 : 520))
  const centerX = totalW / 2
  let totalH = 40

  let svgContent = ''
  let prevBox: FlowBox | null = null
  let pendingBranchMerge: {
    yesNode?: FlowBox
    noNode?: FlowBox
  } | null = null

  nodes.forEach((node, idx) => {
    if (node.type === 'yes' || node.type === 'no') {
      // These are handled as branches of the previous decision
      return
    }

    const size = flowNodeSize(node.type, node.text)
    const nw = size.w
    const nh = size.h

    const weaveOffset = isSpine && node.type !== 'start' && node.type !== 'end'
      ? (idx % 2 === 0 ? -1 : 1) * Math.min(120, style.horizontalGap * 0.34)
      : 0
    const baseNx = centerX - nw / 2 + weaveOffset
    const baseNy = cy
    const nx = baseNx + node.offsetX
    const ny = baseNy + node.offsetY
    const currentBox: FlowBox = { x: nx, y: ny, w: nw, h: nh, type: node.type }
    boxById.set(node.id, currentBox)

    svgContent += drawFlowNode(node, nx, ny, nw, nh)

    // Draw edge from previous
    if (!useManualConnections && pendingBranchMerge) {
      if (pendingBranchMerge.yesNode) {
        svgContent += edgeLineBetween(pendingBranchMerge.yesNode, currentBox)
      }
      if (pendingBranchMerge.noNode) {
        svgContent += branchMergeLineBetween(pendingBranchMerge.noNode, currentBox, pendingBranchMerge.yesNode)
      }
      pendingBranchMerge = null
    } else if (!useManualConnections && prevBox) {
      svgContent += edgeLineBetween(prevBox, currentBox)
    }

    // Handle yes/no branches after decision
    let nextCy = baseNy + nh + gap
    if (node.type === 'decision') {
      const { yesNode, noNode } = getImmediateBranches(nodes, idx)
      const branchMerge: {
        yesNode?: FlowBox
        noNode?: FlowBox
      } = {}

      if (yesNode) {
        const yesY = baseNy + nh + gap + yesNode.offsetY
        const yesSize = flowNodeSize('yes', yesNode.text)
        const yesW = yesSize.w
        const yesH = yesSize.h
        const yesX = baseNx + nw / 2 - yesW / 2 + yesNode.offsetX
        svgContent += drawFlowNode(yesNode, yesX, yesY, yesW, yesH, 'yes')
        const yesBox: FlowBox = { x: yesX, y: yesY, w: yesW, h: yesH, type: 'process' }
        boxById.set(yesNode.id, yesBox)
        if (!useManualConnections) {
          svgContent += edgeLineBetween(currentBox, yesBox)
          const labelX = nx + nw / 2 - Math.max(12, style.fontSize)
          const labelY = ny + nh + Math.max(20, gap * 0.34)
          svgContent += flowLabelSvg('是', labelX, labelY)
        }
        branchMerge.yesNode = yesBox
      }

      if (noNode) {
        const noSize = flowNodeSize('no', noNode.text)
        const noW = noSize.w
        const noH = noSize.h
        const noX = baseNx + nw + branchGap + noNode.offsetX
        const noY = baseNy + nh / 2 - noH / 2 + noNode.offsetY
        svgContent += drawFlowNode(noNode, noX, noY, noW, noH, 'no')
        const noBox: FlowBox = { x: noX, y: noY, w: noW, h: noH, type: 'process' }
        boxById.set(noNode.id, noBox)
        if (!useManualConnections) {
          svgContent += edgeLineBetween(currentBox, noBox)
          const labelX2 = nx + nw + Math.max(18, branchGap * 0.34)
          const labelY2 = ny + nh / 2 - Math.max(12, style.fontSize * 0.65)
          svgContent += flowLabelSvg('否', labelX2, labelY2)
        }
        branchMerge.noNode = noBox
      }

      if (!useManualConnections && (yesNode || noNode)) {
        pendingBranchMerge = branchMerge
        const yesBottom = yesNode ? baseNy + nh + gap + flowNodeSize('yes', yesNode.text).h : baseNy + nh
        const noBottom = noNode ? baseNy + nh / 2 - flowNodeSize('no', noNode.text).h / 2 + flowNodeSize('no', noNode.text).h : baseNy + nh
        nextCy = Math.max(yesBottom, noBottom) + gap
      } else if (yesNode || noNode) {
        const yesBottom = yesNode ? baseNy + nh + gap + flowNodeSize('yes', yesNode.text).h : baseNy + nh
        const noBottom = noNode ? baseNy + nh / 2 - flowNodeSize('no', noNode.text).h / 2 + flowNodeSize('no', noNode.text).h : baseNy + nh
        nextCy = Math.max(yesBottom, noBottom) + gap
      }
    }

    prevBox = currentBox

    cy = nextCy
  })

  if (useManualConnections) {
    manualConnections.forEach((link) => {
      const from = boxById.get(link.fromId)
      const to = boxById.get(link.toId)
      if (!from || !to) return
      svgContent += edgeLineWithLabel(from, to, link.label)
    })
  }

  totalH = cy + 20 + dragMargin
  const background = `<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="${style.backgroundColor}"/>`
  return buildSvg(totalW, totalH, flowSvgStyle() + background + svgContent) + '</svg>'
}

function generateHorizontalFlowSVG(nodes: FlowNode[]): string {
  const style = flowchartStyle.value
  const manualConnections = getValidManualConnections()
  const useManualConnections = manualConnections.length > 0
  const boxById = new Map<number, FlowBox>()
  const dragMargin = 140
  const gap = Math.max(48, Math.round(style.horizontalGap * 0.22))
  const branchGap = Math.max(64, Math.round(style.verticalGap * 0.42))
  const mainNodes = nodes.filter(node => node.type !== 'yes' && node.type !== 'no')
  const y = dragMargin + 120
  let x = dragMargin + 32
  let content = ''
  let prev: FlowBox | null = null

  mainNodes.forEach((node, index) => {
    const size = flowNodeSize(node.type, node.text)
    const w = size.w
    const h = size.h
    const baseNx = x
    const baseNy = y - h / 2
    const nx = baseNx + node.offsetX
    const ny = baseNy + node.offsetY
    const currentBox: FlowBox = { x: nx, y: ny, w, h, type: node.type }
    boxById.set(node.id, currentBox)

    if (!useManualConnections && prev) {
      content += edgeLineBetween(prev, currentBox)
    }

    content += drawFlowNode(node, nx, ny, w, h)

    if (node.type === 'decision') {
      const originalIndex = nodes.findIndex((item) => item.id === node.id)
      const { yesNode, noNode } = getImmediateBranches(nodes, originalIndex === -1 ? index : originalIndex)
      if (yesNode) {
        const branchSize = flowNodeSize('yes', yesNode.text)
        const bw = branchSize.w
        const bh = branchSize.h
        const bx = baseNx + w / 2 - bw / 2 + yesNode.offsetX
        const by = baseNy - branchGap - bh + yesNode.offsetY
        const yesBox: FlowBox = { x: bx, y: by, w: bw, h: bh, type: 'yes' }
        boxById.set(yesNode.id, yesBox)
        if (!useManualConnections) {
          content += edgeLineBetween(currentBox, yesBox)
          content += flowLabelSvg('是', nx + w / 2 + 16, ny - Math.max(22, style.fontSize))
        }
        content += drawFlowNode(yesNode, bx, by, bw, bh, 'yes')
      }
      if (noNode) {
        const branchSize = flowNodeSize('no', noNode.text)
        const bw = branchSize.w
        const bh = branchSize.h
        const bx = baseNx + w / 2 - bw / 2 + noNode.offsetX
        const by = baseNy + h + branchGap + noNode.offsetY
        const noBox: FlowBox = { x: bx, y: by, w: bw, h: bh, type: 'no' }
        boxById.set(noNode.id, noBox)
        if (!useManualConnections) {
          content += edgeLineBetween(currentBox, noBox)
          content += flowLabelSvg('否', nx + w / 2 + 16, ny + h + Math.max(22, style.fontSize))
        }
        content += drawFlowNode(noNode, bx, by, bw, bh, 'no')
      }
    }

    prev = currentBox
    x += w + gap
  })

  if (useManualConnections) {
    manualConnections.forEach((link) => {
      const from = boxById.get(link.fromId)
      const to = boxById.get(link.toId)
      if (!from || !to) return
      content += edgeLineWithLabel(from, to, link.label)
    })
  }

  const totalW = Math.max(500 + dragMargin * 2, x + 24 + dragMargin)
  const totalH = 250 + dragMargin * 2
  const background = `<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="${style.backgroundColor}"/>`
  return buildSvg(totalW, totalH, flowSvgStyle() + background + content) + '</svg>'
}

function loadExample() {
  steps.value = [
    createStep('start', '开始'),
    createStep('decision', '用户是否已注册？'),
    createStep('yes', '输入用户名和密码'),
    createStep('no', '输入注册信息'),
    createStep('process', '验证用户信息'),
    createStep('decision', '信息是否有效？'),
    createStep('yes', '显示登录成功'),
    createStep('no', '显示登录失败'),
    createStep('io', '用户访问登录页面'),
    createStep('end', '结束'),
  ]
  connections.value = []
  manualConnectionsEnabled.value = false
  activeEditorTab.value = 'nodes'
  flowLayoutMode.value = 'default'
  window.clearTimeout(timer)
  nextTick(() => renderDiagram(true))
}

function loadStoredDiagram() {
  const cached = readDiagramStorage('diagram:flowchart')
  if (!cached) return false
  try {
    const data = JSON.parse(cached)
    if (!Array.isArray(data.steps)) return false
    steps.value = data.steps.map((step: any) => {
      const type = ['start', 'end', 'decision', 'process', 'io', 'yes', 'no'].includes(step.type)
        ? step.type as FlowNodeType
        : 'process'
      return createStep(type, String(step.text || ''))
    })
    connections.value = []
    manualConnectionsEnabled.value = false
    activeEditorTab.value = 'nodes'
    flowLayoutMode.value = data.layoutDir === 'LR' ? 'horizontal' : 'default'
    window.clearTimeout(timer)
    nextTick(() => renderDiagram(true))
    return true
  } catch {
    return false
  }
}

function clearAll() {
  steps.value = []
  connections.value = []
  manualConnectionsEnabled.value = false
  if (previewEl.value) previewEl.value.innerHTML = ''
}

async function exportPng() {
  if (!previewEl.value) return
  await exportToPng(previewEl.value, '流程图')
  ElMessage.success('PNG导出成功')
}

async function exportSvg() {
  if (!previewEl.value) return
  await exportToSvg(previewEl.value, '流程图')
  ElMessage.success('SVG导出成功')
}

function currentSvgSource() {
  const svgEl = previewEl.value?.querySelector('svg')
  if (!svgEl) return previewEl.value?.innerHTML || ''
  return new XMLSerializer().serializeToString(svgEl)
}

async function copySource() {
  await copyToClipboard(currentSvgSource())
  ElMessage.success('SVG源码已复制')
}

async function openDrawIo() {
  if (hasContent.value) {
    await copyToClipboard(currentSvgSource())
    ElMessage.success('已复制SVG源码，可在 Draw.io 中粘贴导入')
  }
  window.open('https://app.diagrams.net/?splash=0', '_blank', 'noopener,noreferrer')
}

loadStoredStyle()
if (!loadStoredDiagram()) {
  loadExample()
}
</script>

<style scoped>
.flow-editor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flow-connection-help {
  padding: 10px 12px 0;
  color: var(--t3);
  font-size: 12px;
  line-height: 1.6;
}

.flow-connection-row {
  display: grid;
  grid-template-columns: 22px minmax(90px, 1fr) minmax(72px, 0.72fr) 18px minmax(90px, 1fr) 28px;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 5px 8px;
  border: var(--border-subtle);
  border-radius: var(--r-xs);
  background: var(--glass-2);
}

.flow-connection-row .arrow-label {
  text-align: center;
  color: var(--t4);
  font-size: 13px;
}

.flow-empty-state {
  padding: 16px 10px;
  border: 1px dashed rgba(0, 0, 0, 0.12);
  border-radius: var(--r-xs);
  color: var(--t3);
  text-align: center;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.35);
}

:global(.flow-style-dialog.el-dialog) {
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow: hidden;
  background: #fff !important;
}

:global(.flow-style-dialog .el-dialog__header) {
  flex: 0 0 auto;
  padding: 18px 22px 12px !important;
  margin-right: 0 !important;
  background: #fff !important;
}

:global(.flow-style-dialog .el-dialog__title) {
  color: #1f2937 !important;
  font-size: 20px !important;
  font-weight: 500 !important;
}

:global(.flow-style-dialog .el-dialog__body) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 4px 18px 8px 22px !important;
  background: #fff !important;
}

:global(.flow-style-dialog .el-dialog__footer) {
  flex: 0 0 auto;
  padding: 10px 18px 16px !important;
  border-top: 1px solid #edf1f6 !important;
  background: #fff !important;
}

.flow-style-panel {
  max-height: calc(100vh - 158px);
  overflow: auto;
  padding: 0 10px 4px 0;
  background: #fff;
}

.flow-style-panel::-webkit-scrollbar {
  width: 6px;
}

.flow-style-panel::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #d0d7e2;
}

.flow-style-switches {
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
  .style-switch-row,
  .style-grid {
    grid-template-columns: 88px minmax(0, 1fr);
  }
}
</style>
