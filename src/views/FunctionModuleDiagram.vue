<template>
  <DiagramLayout
    title="功能模块图"
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
      <div class="structured-editor module-editor">
        <div class="editor-hint">直接编辑节点内容，右侧实时生成</div>

        <div class="editor-section">
          <div class="editor-section-title">
            <span>功能模块（{{ modules.length }}）</span>
            <button class="editor-add" type="button" @click="addModule()">+ 添加模块</button>
          </div>

          <div class="module-tree-list">
            <div class="tree-row system-row">
              <span class="tree-toggle">▾</span>
              <span class="node-icon system-icon">▦</span>
              <el-input v-model="systemName" placeholder="系统" />
            </div>

            <div
              v-for="(module, moduleIndex) in modules"
              :key="module.id"
              class="module-group"
            >
              <div class="tree-row module-row">
                <span class="tree-toggle">▾</span>
                <span class="node-icon module-icon">□</span>
                <el-input v-model="module.name" :placeholder="`模块${moduleIndex + 1}`" />
                <button class="tree-action" type="button" title="添加功能" @click="addFunction(moduleIndex)">+</button>
                <button class="tree-action danger" type="button" title="删除模块" @click="removeModule(moduleIndex)">×</button>
              </div>

              <div
                v-for="(func, funcIndex) in module.functions"
                :key="func.id"
                class="tree-row function-row"
              >
                <span class="tree-spacer"></span>
                <span class="node-icon function-icon">▤</span>
                <el-input v-model="func.name" :placeholder="`功能${funcIndex + 1}`" />
                <button class="tree-action" type="button" title="继续添加功能" @click="addFunction(moduleIndex, funcIndex + 1)">+</button>
                <button class="tree-action danger" type="button" title="删除功能" @click="removeFunction(moduleIndex, funcIndex)">×</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #extraButtons>
      <el-button @click="openQuickFill" size="default" text>快速填写</el-button>
    </template>
    <template #previewActions>
      <el-button size="small" plain @click="openStyleDialog">修改样式</el-button>
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
      <div v-if="!hasContent" class="diagram-placeholder">请添加系统、模块或功能</div>
      <div v-else ref="previewEl" style="width:100%;overflow:visible;"></div>
    </template>
  </DiagramLayout>

  <el-dialog v-model="quickFillVisible" title="快速填写功能模块" width="640px">
    <div class="quick-fill-help">
      第一行填写系统名称，后续通过缩进表示“模块-功能”层级；也支持“模块：功能1，功能2”的格式。
    </div>
    <el-input
      v-model="quickFillText"
      type="textarea"
      :rows="12"
      placeholder="系统&#10;  模块1&#10;    功能1&#10;    功能2&#10;  模块2&#10;    功能1&#10;    功能2"
    />
    <template #footer>
      <el-button @click="quickFillVisible = false">取消</el-button>
      <el-button type="primary" @click="applyQuickFill">确认填充</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="styleDialogVisible"
    title="图表样式设置"
    width="620px"
    top="16px"
    class="module-style-dialog"
    append-to-body
  >
    <div v-if="styleDraft" class="module-style-panel">
      <div class="module-style-switches">
        <div class="style-switch-row">
          <span>实时渲染</span>
          <el-switch v-model="styleDraft.realTimeRender" />
          <em>开启后编辑时自动更新图表</em>
        </div>
        <div class="style-switch-row">
          <span>同层对齐</span>
          <el-switch v-model="styleDraft.alignSameLevel" />
          <em>开启后同层同类节点宽高对齐</em>
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">布局配置</div>
        <div class="style-grid">
          <label>纵向层级间距</label>
          <el-input-number v-model="styleDraft.verticalLevelGap" :min="80" :max="320" :step="10" controls-position="right" size="small" />
          <label>横向节点间距</label>
          <el-input-number v-model="styleDraft.horizontalNodeGap" :min="20" :max="180" :step="5" controls-position="right" size="small" />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">样式配置</div>
        <div class="style-grid">
          <label>连线箭头样式</label>
          <el-select v-model="styleDraft.arrowStyle" size="small">
            <el-option label="无箭头" value="none" />
            <el-option label="末端箭头" value="end" />
          </el-select>
          <label>全局背景</label>
          <el-color-picker v-model="styleDraft.backgroundColor" size="small" show-alpha />
          <label>文字颜色</label>
          <el-color-picker v-model="styleDraft.fontColor" size="small" />
          <label>字体大小</label>
          <el-input-number v-model="styleDraft.fontSize" :min="10" :max="40" controls-position="right" size="small" />
          <label>字体</label>
          <el-select v-model="styleDraft.fontFamily" size="small">
            <el-option label="宋体+Times" value="SimSun, 宋体, Times New Roman, serif" />
            <el-option label="微软雅黑" value="Microsoft YaHei, 微软雅黑, sans-serif" />
            <el-option label="黑体" value="SimHei, 黑体, sans-serif" />
          </el-select>
          <label>连线颜色</label>
          <el-color-picker v-model="styleDraft.lineColor" size="small" />
          <label>连线粗细</label>
          <el-input-number v-model="styleDraft.lineWidth" :min="0.5" :max="8" :step="0.5" controls-position="right" size="small" />
          <label>边框粗细</label>
          <el-input-number v-model="styleDraft.borderWidth" :min="0.5" :max="8" :step="0.5" controls-position="right" size="small" />
          <label>矩形圆角</label>
          <el-input-number v-model="styleDraft.rectRadius" :min="0" :max="40" controls-position="right" size="small" />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">文字方向配置</div>
        <div class="style-grid">
          <label>系统文字方向</label>
          <el-select v-model="styleDraft.systemTextDirection" size="small">
            <el-option label="横向" value="horizontal" />
            <el-option label="竖向" value="vertical" />
          </el-select>
          <label>模块文字方向</label>
          <el-select v-model="styleDraft.moduleTextDirection" size="small">
            <el-option label="横向" value="horizontal" />
            <el-option label="竖向" value="vertical" />
          </el-select>
          <label>功能文字方向</label>
          <el-select v-model="styleDraft.functionTextDirection" size="small">
            <el-option label="横向" value="horizontal" />
            <el-option label="竖向" value="vertical" />
          </el-select>
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">节点尺寸配置</div>
        <div class="module-auto-size-row">
          <span>自动计算尺寸</span>
          <el-switch v-model="styleDraft.autoNodeSize" />
          <em>根据文字长度自动计算节点尺寸，同父节点取最大值</em>
        </div>
        <div class="style-grid">
          <label>系统最小宽度</label>
          <el-input-number v-model="styleDraft.systemMinWidth" :min="80" :max="420" :step="10" controls-position="right" size="small" />
          <label>系统最小高度</label>
          <el-input-number v-model="styleDraft.systemMinHeight" :min="30" :max="180" :step="5" controls-position="right" size="small" />
          <label>模块最小宽度</label>
          <el-input-number v-model="styleDraft.moduleMinWidth" :min="60" :max="360" :step="10" controls-position="right" size="small" />
          <label>模块最小高度</label>
          <el-input-number v-model="styleDraft.moduleMinHeight" :min="30" :max="180" :step="5" controls-position="right" size="small" />
          <label>功能最小宽度</label>
          <el-input-number v-model="styleDraft.functionMinWidth" :min="30" :max="300" :step="5" controls-position="right" size="small" />
          <label>功能最小高度</label>
          <el-input-number v-model="styleDraft.functionMinHeight" :min="40" :max="320" :step="10" controls-position="right" size="small" />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">节点颜色配置</div>
        <div class="style-grid">
          <label>系统颜色</label>
          <el-color-picker v-model="styleDraft.systemFill" size="small" show-alpha />
          <label>系统边框颜色</label>
          <el-color-picker v-model="styleDraft.systemStroke" size="small" />
          <label>模块颜色</label>
          <el-color-picker v-model="styleDraft.moduleFill" size="small" show-alpha />
          <label>模块边框颜色</label>
          <el-color-picker v-model="styleDraft.moduleStroke" size="small" />
          <label>功能颜色</label>
          <el-color-picker v-model="styleDraft.functionFill" size="small" show-alpha />
          <label>功能边框颜色</label>
          <el-color-picker v-model="styleDraft.functionStroke" size="small" />
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="restoreDefaultStyle">恢复默认</el-button>
      <el-button @click="cancelStyleDialog">关闭</el-button>
      <el-button type="primary" @click="applyStyleDialog">应用</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import DiagramLayout from '@/components/DiagramLayout.vue'
import { exportToPng, exportToSvg, copyToClipboard } from '@/utils/export'
import { buildSvg, textWidth } from '@/utils/svg-style'
import { readDiagramStorage } from '@/utils/diagramStorage'
import { ElMessage } from 'element-plus'

type ModuleTextDirection = 'horizontal' | 'vertical'
type ModuleArrowStyle = 'none' | 'end'

interface FunctionModuleStyle {
  realTimeRender: boolean
  alignSameLevel: boolean
  verticalLevelGap: number
  horizontalNodeGap: number
  arrowStyle: ModuleArrowStyle
  backgroundColor: string
  fontColor: string
  fontFamily: string
  fontSize: number
  lineColor: string
  lineWidth: number
  borderWidth: number
  rectRadius: number
  systemTextDirection: ModuleTextDirection
  moduleTextDirection: ModuleTextDirection
  functionTextDirection: ModuleTextDirection
  autoNodeSize: boolean
  systemMinWidth: number
  systemMinHeight: number
  moduleMinWidth: number
  moduleMinHeight: number
  functionMinWidth: number
  functionMinHeight: number
  systemFill: string
  systemStroke: string
  moduleFill: string
  moduleStroke: string
  functionFill: string
  functionStroke: string
}

interface NodeSize {
  width: number
  height: number
}

const MODULE_STYLE_STORAGE_KEY = 'diagram:function-module-style'

const systemName = ref('')
const systemOffsetX = ref(0)
const systemOffsetY = ref(0)
const modules = ref<Module[]>([])
const moduleStyle = ref<FunctionModuleStyle>(createDefaultFunctionModuleStyle())
const styleDraft = ref<FunctionModuleStyle | null>(null)
const styleSnapshot = ref<FunctionModuleStyle | null>(null)
const styleDialogVisible = ref(false)
const quickFillVisible = ref(false)
const quickFillText = ref('')
const previewEl = ref<HTMLElement>()
const layoutRef = ref<InstanceType<typeof DiagramLayout>>()

let timer: number | undefined
let nodeId = 0
let draggingSystem = false
let draggingModuleIndex: number | null = null
let draggingFunctionIndex: { moduleIndex: number; functionIndex: number } | null = null
let dragStartPoint = { x: 0, y: 0 }
let dragStartOffset = { x: 0, y: 0 }

watch([systemName, systemOffsetX, systemOffsetY, modules, moduleStyle], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => { renderDiagram() }, 300)
}, { deep: true })

watch(styleDraft, (draft) => {
  if (!styleDialogVisible.value || !draft?.realTimeRender) return
  moduleStyle.value = normalizeFunctionModuleStyle(cloneFunctionModuleStyle(draft))
  saveCurrentStyle()
  window.clearTimeout(timer)
  timer = window.setTimeout(() => { renderDiagram() }, 120)
}, { deep: true })

function createDefaultFunctionModuleStyle(): FunctionModuleStyle {
  return {
    realTimeRender: true,
    alignSameLevel: true,
    verticalLevelGap: 150,
    horizontalNodeGap: 50,
    arrowStyle: 'none',
    backgroundColor: '#ffffff',
    fontColor: '#000000',
    fontFamily: 'SimSun, 宋体, Times New Roman, serif',
    fontSize: 20,
    lineColor: '#000000',
    lineWidth: 2,
    borderWidth: 2,
    rectRadius: 0,
    systemTextDirection: 'horizontal',
    moduleTextDirection: 'horizontal',
    functionTextDirection: 'vertical',
    autoNodeSize: true,
    systemMinWidth: 200,
    systemMinHeight: 50,
    moduleMinWidth: 150,
    moduleMinHeight: 50,
    functionMinWidth: 40,
    functionMinHeight: 120,
    systemFill: '#ffffff',
    systemStroke: '#000000',
    moduleFill: '#ffffff',
    moduleStroke: '#000000',
    functionFill: '#ffffff',
    functionStroke: '#000000',
  }
}

function normalizeFunctionModuleStyle(style: FunctionModuleStyle): FunctionModuleStyle {
  const defaults = createDefaultFunctionModuleStyle()
  return {
    ...defaults,
    ...style,
    verticalLevelGap: clampNumber(style.verticalLevelGap, 80, 320, defaults.verticalLevelGap),
    horizontalNodeGap: clampNumber(style.horizontalNodeGap, 20, 180, defaults.horizontalNodeGap),
    fontSize: clampNumber(style.fontSize, 10, 40, defaults.fontSize),
    lineWidth: clampNumber(style.lineWidth, 0.5, 8, defaults.lineWidth),
    borderWidth: clampNumber(style.borderWidth, 0.5, 8, defaults.borderWidth),
    rectRadius: clampNumber(style.rectRadius, 0, 40, defaults.rectRadius),
    systemMinWidth: clampNumber(style.systemMinWidth, 80, 420, defaults.systemMinWidth),
    systemMinHeight: clampNumber(style.systemMinHeight, 30, 180, defaults.systemMinHeight),
    moduleMinWidth: clampNumber(style.moduleMinWidth, 60, 360, defaults.moduleMinWidth),
    moduleMinHeight: clampNumber(style.moduleMinHeight, 30, 180, defaults.moduleMinHeight),
    functionMinWidth: clampNumber(style.functionMinWidth, 30, 300, defaults.functionMinWidth),
    functionMinHeight: clampNumber(style.functionMinHeight, 40, 320, defaults.functionMinHeight),
  }
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.max(min, Math.min(max, next))
}

function cloneFunctionModuleStyle(style: FunctionModuleStyle): FunctionModuleStyle {
  return JSON.parse(JSON.stringify(style))
}

function saveCurrentStyle() {
  localStorage.setItem(MODULE_STYLE_STORAGE_KEY, JSON.stringify(moduleStyle.value))
}

function loadStoredStyle() {
  const stored = localStorage.getItem(MODULE_STYLE_STORAGE_KEY)
  if (!stored) return
  try {
    moduleStyle.value = normalizeFunctionModuleStyle({
      ...createDefaultFunctionModuleStyle(),
      ...JSON.parse(stored),
    })
  } catch {
    localStorage.removeItem(MODULE_STYLE_STORAGE_KEY)
  }
}

interface Module {
  id: number
  name: string
  functions: ModuleFunction[]
  offsetX: number
  offsetY: number
}

interface ModuleFunction {
  id: number
  name: string
  offsetX: number
  offsetY: number
}

interface RenderModule {
  name: string
  functions: string[]
  offsetX: number
  offsetY: number
}

const hasContent = computed(() => {
  return Boolean(
    systemName.value.trim() ||
    modules.value.some((mod) => mod.name.trim() || mod.functions.some((func) => func.name.trim()))
  )
})

function renderDiagram() {
  if (!previewEl.value) return
  const renderModules = getRenderModules()
  const sysName = systemName.value.trim() || '系统'

  if (!hasContent.value) {
    previewEl.value.innerHTML = ''
    return
  }

  try {
    previewEl.value.innerHTML = generateSVG(sysName, renderModules)
    bindModuleDrag()
  } catch (e: any) {
    previewEl.value.innerHTML = `<div class="diagram-error">图表渲染失败：${e.message || ''}</div>`
  }
}

function bindModuleDrag() {
  if (!previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  if (!svg) return

  previewEl.value.querySelectorAll<SVGGElement>('.draggable-system').forEach((group) => {
    group.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()

      draggingSystem = true
      dragStartPoint = getSvgPoint(event, svg)
      dragStartOffset = {
        x: systemOffsetX.value,
        y: systemOffsetY.value,
      }

      window.addEventListener('pointermove', handleSystemDrag)
      window.addEventListener('pointerup', stopSystemDrag, { once: true })
      window.addEventListener('pointercancel', stopSystemDrag, { once: true })
    })
  })

  previewEl.value.querySelectorAll<SVGGElement>('.draggable-module').forEach((group) => {
    group.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()

      const index = Number(group.dataset.moduleIndex)
      if (!Number.isFinite(index) || !modules.value[index]) return

      draggingModuleIndex = index
      dragStartPoint = getSvgPoint(event, svg)
      dragStartOffset = {
        x: modules.value[index].offsetX,
        y: modules.value[index].offsetY,
      }

      window.addEventListener('pointermove', handleModuleDrag)
      window.addEventListener('pointerup', stopModuleDrag, { once: true })
      window.addEventListener('pointercancel', stopModuleDrag, { once: true })
    })
  })

  previewEl.value.querySelectorAll<SVGGElement>('.draggable-function').forEach((group) => {
    group.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()

      const moduleIndex = Number(group.dataset.moduleIndex)
      const functionIndex = Number(group.dataset.functionIndex)
      const func = modules.value[moduleIndex]?.functions[functionIndex]
      if (!Number.isFinite(moduleIndex) || !Number.isFinite(functionIndex) || !func) return

      draggingFunctionIndex = { moduleIndex, functionIndex }
      dragStartPoint = getSvgPoint(event, svg)
      dragStartOffset = {
        x: func.offsetX,
        y: func.offsetY,
      }

      window.addEventListener('pointermove', handleFunctionDrag)
      window.addEventListener('pointerup', stopFunctionDrag, { once: true })
      window.addEventListener('pointercancel', stopFunctionDrag, { once: true })
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

function handleSystemDrag(event: PointerEvent) {
  if (!draggingSystem || !previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  if (!svg) return

  event.preventDefault()
  const current = getSvgPoint(event, svg)
  systemOffsetX.value = Math.round(dragStartOffset.x + current.x - dragStartPoint.x)
  systemOffsetY.value = Math.round(dragStartOffset.y + current.y - dragStartPoint.y)
  window.clearTimeout(timer)
  renderDiagram()
}

function stopSystemDrag() {
  draggingSystem = false
  window.removeEventListener('pointermove', handleSystemDrag)
}

function handleModuleDrag(event: PointerEvent) {
  if (draggingModuleIndex === null || !previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  const module = modules.value[draggingModuleIndex]
  if (!svg || !module) return

  event.preventDefault()
  const current = getSvgPoint(event, svg)
  module.offsetX = Math.round(dragStartOffset.x + current.x - dragStartPoint.x)
  module.offsetY = Math.round(dragStartOffset.y + current.y - dragStartPoint.y)
  window.clearTimeout(timer)
  renderDiagram()
}

function stopModuleDrag() {
  draggingModuleIndex = null
  window.removeEventListener('pointermove', handleModuleDrag)
}

function handleFunctionDrag(event: PointerEvent) {
  if (!draggingFunctionIndex || !previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  const func = modules.value[draggingFunctionIndex.moduleIndex]?.functions[draggingFunctionIndex.functionIndex]
  if (!svg || !func) return

  event.preventDefault()
  const current = getSvgPoint(event, svg)
  func.offsetX = Math.round(dragStartOffset.x + current.x - dragStartPoint.x)
  func.offsetY = Math.round(dragStartOffset.y + current.y - dragStartPoint.y)
  window.clearTimeout(timer)
  renderDiagram()
}

function stopFunctionDrag() {
  draggingFunctionIndex = null
  window.removeEventListener('pointermove', handleFunctionDrag)
}

function getRenderModules(): RenderModule[] {
  return modules.value
    .map((mod, index) => ({
      name: mod.name.trim() || `模块${index + 1}`,
      functions: mod.functions
        .map((func, funcIndex) => func.name.trim() || `功能${funcIndex + 1}`)
        .filter(Boolean),
      offsetX: mod.offsetX,
      offsetY: mod.offsetY,
    }))
    .filter((mod) => mod.name || mod.functions.length > 0)
}

function generateSVG(sysName: string, renderModules: RenderModule[]): string {
  const style = moduleStyle.value
  const dragMargin = 180
  const funcGap = Math.max(20, Math.round(style.horizontalNodeGap * 0.45))
  const laneGap = style.horizontalNodeGap
  const levelGap = style.verticalLevelGap

  const sysSize = measureNode(sysName, style.systemMinWidth, style.systemMinHeight, style.systemTextDirection, false)

  if (renderModules.length === 0) {
    const w = sysSize.width + 80 + dragMargin * 2
    const h = sysSize.height + 80 + dragMargin * 2
    const sysOnlyX = (w - sysSize.width) / 2 + systemOffsetX.value
    const sysOnlyY = (h - sysSize.height) / 2 + systemOffsetY.value
    const content = `${moduleSvgOverrides(w, h)}
    <g class="draggable-system" style="cursor:move;">
      <rect class="node-rect module-system-node" x="${sysOnlyX}" y="${sysOnlyY}" width="${sysSize.width}" height="${sysSize.height}" rx="${style.rectRadius}"/>
      ${renderNodeText(sysName, sysOnlyX + sysSize.width / 2, sysOnlyY + sysSize.height / 2, style.systemTextDirection, true)}
    </g>`
    return buildSvg(w, h, content) + '</svg>'
  }

  const moduleRawSizes = renderModules.map((mod) =>
    measureNode(mod.name, style.moduleMinWidth, style.moduleMinHeight, style.moduleTextDirection, false)
  )
  const functionRawSizes = renderModules.map((mod) =>
    mod.functions.map((func) =>
      measureNode(func, style.functionMinWidth, style.functionMinHeight, style.functionTextDirection, false)
    )
  )
  const alignedModuleW = Math.max(...moduleRawSizes.map((size) => size.width))
  const alignedModuleH = Math.max(...moduleRawSizes.map((size) => size.height))
  const allFunctionSizes = functionRawSizes.flat()
  const alignedFunctionW = allFunctionSizes.length ? Math.max(...allFunctionSizes.map((size) => size.width)) : style.functionMinWidth
  const alignedFunctionH = allFunctionSizes.length ? Math.max(...allFunctionSizes.map((size) => size.height)) : style.functionMinHeight

  const lanes = renderModules.map((mod, index) => {
    const moduleSize = style.alignSameLevel
      ? { width: alignedModuleW, height: alignedModuleH }
      : moduleRawSizes[index]
    const functionSizes = functionRawSizes[index].map((size) => style.alignSameLevel
      ? { width: alignedFunctionW, height: alignedFunctionH }
      : size
    )
    const funcGroupW = functionSizes.length > 0
      ? functionSizes.reduce((sum, size) => sum + size.width, 0) + (functionSizes.length - 1) * funcGap
      : 0
    const laneW = Math.max(moduleSize.width + 24, funcGroupW + 24, 132)
    return { moduleSize, functionSizes, funcGroupW, laneW }
  })

  const baseWidth = Math.max(
    360,
    lanes.reduce((sum, lane) => sum + lane.laneW, 0) + (renderModules.length - 1) * laneGap + 80,
    sysSize.width + 120
  )
  const totalWidth = baseWidth + dragMargin * 2
  const sysY = 30
  const busY = sysY + sysSize.height + Math.round(levelGap * 0.32)
  const modY = sysY + sysSize.height + Math.round(levelGap * 0.48)
  const maxModuleH = Math.max(...lanes.map((lane) => lane.moduleSize.height))
  const funcBusY = modY + maxModuleH + Math.round(levelGap * 0.25)
  const funcY = modY + maxModuleH + Math.round(levelGap * 0.4)
  const maxFuncH = Math.max(0, ...lanes.flatMap((lane) => lane.functionSizes.map((size) => size.height)))
  const baseHeight = funcY + maxFuncH + 52
  const totalHeight = baseHeight + dragMargin * 2

  let content = moduleSvgOverrides(totalWidth, totalHeight)

  const sysX = dragMargin + (baseWidth - sysSize.width) / 2 + systemOffsetX.value
  const yOffset = dragMargin
  const sysTopY = sysY + yOffset + systemOffsetY.value
  const sysCenterX = sysX + sysSize.width / 2
  content += `<g class="draggable-system" style="cursor:move;">`
  content += `<rect class="node-rect module-system-node" x="${sysX}" y="${sysTopY}" width="${sysSize.width}" height="${sysSize.height}" rx="${style.rectRadius}"/>`
  content += renderNodeText(sysName, sysCenterX, sysTopY + sysSize.height / 2, style.systemTextDirection, true)
  content += `</g>`

  const lanesWidth = lanes.reduce((sum, lane) => sum + lane.laneW, 0) + (renderModules.length - 1) * laneGap
  let cursorX = dragMargin + (baseWidth - lanesWidth) / 2
  const moduleCenters: number[] = []
  lanes.forEach((lane) => {
    const moduleIndex = moduleCenters.length
    moduleCenters.push(cursorX + lane.laneW / 2 + renderModules[moduleIndex].offsetX)
    cursorX += lane.laneW + laneGap
  })

  const firstCenter = Math.min(sysCenterX, ...moduleCenters)
  const lastCenter = Math.max(sysCenterX, ...moduleCenters)
  content += `<line class="edge-line" x1="${sysCenterX}" y1="${sysTopY + sysSize.height}" x2="${sysCenterX}" y2="${busY + yOffset}"/>`
  if (moduleCenters.length > 1) {
    content += `<line class="edge-line" x1="${firstCenter}" y1="${busY + yOffset}" x2="${lastCenter}" y2="${busY + yOffset}"/>`
  }

  renderModules.forEach((mod, mi) => {
    const lane = lanes[mi]
    const moduleSize = lane.moduleSize
    const mcx = moduleCenters[mi]
    const mx = mcx - moduleSize.width / 2
    const moduleY = modY + yOffset + mod.offsetY
    const moduleBottomY = moduleY + moduleSize.height
    const localFuncBusY = funcBusY + yOffset + mod.offsetY
    const localFuncY = funcY + yOffset + mod.offsetY

    content += `<g class="draggable-module" data-module-index="${mi}" style="cursor:move;">`
    content += `<line class="edge-line" x1="${mcx}" y1="${busY + yOffset}" x2="${mcx}" y2="${moduleY}"${arrowEndAttr()}/>`
    content += `<rect class="node-rect module-module-node module-drag-handle" x="${mx}" y="${moduleY}" width="${moduleSize.width}" height="${moduleSize.height}" rx="${style.rectRadius}"/>`
    content += renderNodeText(mod.name, mcx, moduleY + moduleSize.height / 2, style.moduleTextDirection, true)

    const functionLayouts = mod.functions.map((func, fi) => {
      const funcSize = lane.functionSizes[fi]
      const modelFunc = modules.value[mi]?.functions[fi]
      const funcOffsetX = modelFunc?.offsetX || 0
      const funcOffsetY = modelFunc?.offsetY || 0
      const previousWidth = lane.functionSizes.slice(0, fi).reduce((sum, size) => sum + size.width, 0)
      const fx = mcx - lane.funcGroupW / 2 + previousWidth + fi * funcGap + funcOffsetX
      const fcx = fx + funcSize.width / 2
      const draggedFuncY = localFuncY + funcOffsetY
      const functionAnchorY = draggedFuncY >= localFuncBusY ? draggedFuncY : draggedFuncY + funcSize.height
      return { func, fi, funcSize, fx, fcx, draggedFuncY, functionAnchorY }
    })

    if (functionLayouts.length > 0) {
      const functionCenters = functionLayouts.map((item) => item.fcx)
      const busStartX = Math.min(mcx, ...functionCenters)
      const busEndX = Math.max(mcx, ...functionCenters)
      content += `<line class="edge-line" x1="${mcx}" y1="${moduleBottomY}" x2="${mcx}" y2="${localFuncBusY}"/>`
      if (Math.abs(busEndX - busStartX) > 0.5) {
        content += `<line class="edge-line" x1="${busStartX}" y1="${localFuncBusY}" x2="${busEndX}" y2="${localFuncBusY}"/>`
      }
    }

    functionLayouts.forEach(({ func, fi, funcSize, fx, fcx, draggedFuncY, functionAnchorY }) => {
      content += `<line class="edge-line" x1="${fcx}" y1="${localFuncBusY}" x2="${fcx}" y2="${functionAnchorY}"${arrowEndAttr()}/>`
      content += `<g class="draggable-function" data-module-index="${mi}" data-function-index="${fi}" style="cursor:move;">`
      content += `<rect class="node-rect module-function-node" x="${fx}" y="${draggedFuncY}" width="${funcSize.width}" height="${funcSize.height}" rx="${style.rectRadius}"/>`
      content += renderNodeText(func, fcx, draggedFuncY + funcSize.height / 2, style.functionTextDirection)
      content += `</g>`
    })
    content += `</g>`
  })

  return buildSvg(totalWidth, totalHeight, content) + '</svg>'
}

function measureNode(text: string, minWidth: number, minHeight: number, direction: ModuleTextDirection, forceAuto: boolean): NodeSize {
  const style = moduleStyle.value
  if (!style.autoNodeSize && !forceAuto) {
    return { width: minWidth, height: minHeight }
  }

  const fontSize = style.fontSize
  if (direction === 'vertical') {
    const charCount = Math.max(1, Array.from(text).length)
    return {
      width: Math.max(minWidth, fontSize + 24),
      height: Math.max(minHeight, charCount * (fontSize + 3) + 18),
    }
  }

  return {
    width: Math.max(minWidth, textWidth(text, fontSize) + 34),
    height: Math.max(minHeight, fontSize + 26),
  }
}

function renderNodeText(text: string, x: number, centerY: number, direction: ModuleTextDirection, bold = false): string {
  if (direction === 'vertical') return verticalText(text, x, centerY, bold)
  return `<text class="node-label" x="${x}" y="${centerY}"${bold ? ' font-weight="bold"' : ''}>${esc(text)}</text>`
}

function verticalText(text: string, x: number, centerY: number, bold = false): string {
  const chars = Array.from(text)
  const lineH = moduleStyle.value.fontSize + 3
  const startY = centerY - ((chars.length - 1) * lineH) / 2
  return chars.map((char, i) =>
    `<text class="node-label" x="${x}" y="${startY + i * lineH}"${bold ? ' font-weight="bold"' : ''}>${esc(char)}</text>`
  ).join('')
}

function arrowEndAttr() {
  return moduleStyle.value.arrowStyle === 'end' ? ' marker-end="url(#module-arrow)"' : ''
}

function moduleSvgOverrides(width: number, height: number): string {
  const style = moduleStyle.value
  const safeFontFamily = style.fontFamily.replace(/"/g, '')
  return `<defs>
    <marker id="module-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${style.lineColor}"/>
    </marker>
  </defs>
  <style>
    .node-label { font-family: ${safeFontFamily}; fill: ${style.fontColor}; font-size: ${style.fontSize}px; }
    .edge-line { stroke: ${style.lineColor}; stroke-width: ${style.lineWidth}; fill: none; }
    .module-system-node { fill: ${style.systemFill}; stroke: ${style.systemStroke}; stroke-width: ${style.borderWidth}; }
    .module-module-node { fill: ${style.moduleFill}; stroke: ${style.moduleStroke}; stroke-width: ${style.borderWidth}; }
    .module-function-node { fill: ${style.functionFill}; stroke: ${style.functionStroke}; stroke-width: ${style.borderWidth}; }
  </style>
  <rect x="0" y="0" width="${width}" height="${height}" fill="${style.backgroundColor}" stroke="none"/>`
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function loadExample() {
  systemName.value = '系统'
  systemOffsetX.value = 0
  systemOffsetY.value = 0
  modules.value = [
    createModule('模块1', ['功能1', '功能2']),
    createModule('模块2', ['功能1', '功能2']),
  ]
}

function clearAll() {
  systemName.value = ''
  systemOffsetX.value = 0
  systemOffsetY.value = 0
  modules.value = []
  if (previewEl.value) previewEl.value.innerHTML = ''
}

function createModule(name = '', functions: string[] = []): Module {
  return {
    id: ++nodeId,
    name,
    offsetX: 0,
    offsetY: 0,
    functions: functions.map((func) => createFunction(func)),
  }
}

function createFunction(name = ''): ModuleFunction {
  return {
    id: ++nodeId,
    name,
    offsetX: 0,
    offsetY: 0,
  }
}

function addModule() {
  modules.value.push(createModule(`模块${modules.value.length + 1}`, ['功能1', '功能2']))
}

function removeModule(index: number) {
  modules.value.splice(index, 1)
}

function addFunction(moduleIndex: number, insertIndex?: number) {
  const target = modules.value[moduleIndex]
  if (!target) return
  const nextName = `功能${target.functions.length + 1}`
  const nextFunc = createFunction(nextName)
  if (typeof insertIndex === 'number') {
    target.functions.splice(insertIndex, 0, nextFunc)
  } else {
    target.functions.push(nextFunc)
  }
}

function removeFunction(moduleIndex: number, funcIndex: number) {
  const target = modules.value[moduleIndex]
  if (!target) return
  target.functions.splice(funcIndex, 1)
}

function openStyleDialog() {
  styleSnapshot.value = cloneFunctionModuleStyle(moduleStyle.value)
  styleDraft.value = cloneFunctionModuleStyle(moduleStyle.value)
  styleDialogVisible.value = true
}

function applyStyleDialog() {
  if (!styleDraft.value) return
  moduleStyle.value = normalizeFunctionModuleStyle(cloneFunctionModuleStyle(styleDraft.value))
  saveCurrentStyle()
  styleSnapshot.value = null
  styleDialogVisible.value = false
  nextTick(() => { renderDiagram() })
}

function cancelStyleDialog() {
  if (styleSnapshot.value) {
    moduleStyle.value = cloneFunctionModuleStyle(styleSnapshot.value)
  }
  styleDialogVisible.value = false
  styleDraft.value = null
  styleSnapshot.value = null
  nextTick(() => { renderDiagram() })
}

function restoreDefaultStyle() {
  styleDraft.value = createDefaultFunctionModuleStyle()
  moduleStyle.value = normalizeFunctionModuleStyle(cloneFunctionModuleStyle(styleDraft.value))
  saveCurrentStyle()
  nextTick(() => { renderDiagram() })
}

function openQuickFill() {
  const lines = [systemName.value || '系统']
  modules.value.forEach((mod) => {
    lines.push(`  ${mod.name || '模块'}`)
    mod.functions.forEach((func) => {
      lines.push(`    ${func.name || '功能'}`)
    })
  })
  quickFillText.value = lines.join('\n')
  quickFillVisible.value = true
}

function applyQuickFill() {
  const parsed = parseQuickFillText(quickFillText.value)
  systemName.value = parsed.systemName
  systemOffsetX.value = 0
  systemOffsetY.value = 0
  modules.value = parsed.modules
  quickFillVisible.value = false
}

function parseQuickFillText(text: string): { systemName: string; modules: Module[] } {
  const lines = text
    .replace(/\t/g, '  ')
    .split('\n')
    .map((line) => ({ raw: line, text: line.trim(), indent: line.match(/^\s*/)?.[0].length || 0 }))
    .filter((line) => line.text)

  if (!lines.length) return { systemName: '', modules: [] }

  const first = lines[0].text
  const sys = first.includes('：') || first.includes(':')
    ? first.substring((first.includes('：') ? first.indexOf('：') : first.indexOf(':')) + 1).trim() || '系统'
    : first

  const parsedModules: Module[] = []
  let current: Module | null = null

  lines.slice(1).forEach((line) => {
    const idx = line.text.includes('：') ? line.text.indexOf('：') : line.text.indexOf(':')
    if (idx !== -1) {
      const name = line.text.substring(0, idx).trim()
      const funcs = line.text.substring(idx + 1).split(/[,，]/).map((item) => item.trim()).filter(Boolean)
      current = createModule(name, funcs)
      parsedModules.push(current)
      return
    }

    if (line.indent <= 2 || !current) {
      current = createModule(line.text, [])
      parsedModules.push(current)
    } else {
      current.functions.push(createFunction(line.text))
    }
  })

  return { systemName: sys, modules: parsedModules }
}

async function exportPng() {
  if (!previewEl.value) return
  await exportToPng(previewEl.value, '功能模块图')
  ElMessage.success('PNG导出成功')
}

async function exportSvg() {
  if (!previewEl.value) return
  await exportToSvg(previewEl.value, '功能模块图')
  ElMessage.success('SVG导出成功')
}

async function copySource() {
  await copyToClipboard(currentSvgSource())
  ElMessage.success('SVG源码已复制')
}

function currentSvgSource() {
  return previewEl.value?.innerHTML || ''
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
  const cached = readDiagramStorage('diagram:module')
  if (cached) {
    try {
      const data = JSON.parse(cached)
      if (data.systemName) systemName.value = data.systemName
      if (data.modules) {
        let nextId = Date.now()
        modules.value = data.modules.map((m: any) => ({
          id: nextId++,
          name: m.name,
          functions: (m.functions || []).map((f: any) => ({
            id: nextId++,
            name: typeof f === 'string' ? f : f.name,
            offsetX: 0,
            offsetY: 0,
          })),
          offsetX: 0,
          offsetY: 0,
        }))
      }
      nextTick(() => { renderDiagram() })
      return
    } catch { /* ignore invalid cache */ }
  }
  loadExample()
  nextTick(() => { renderDiagram() })
})
</script>

<style scoped>
.module-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editor-hint {
  color: var(--t3);
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 4px;
}

.module-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.module-tree-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.tree-row {
  display: grid;
  grid-template-columns: 18px 22px 1fr 28px 28px;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 4px 6px;
  border: var(--border-soft);
  background: var(--glass-2);
}

.system-row {
  grid-template-columns: 18px 22px 1fr;
  border-color: rgba(0, 0, 0, 0.12);
}

.module-row {
  margin-left: 16px;
}

.function-row {
  margin-left: 48px;
}

.tree-toggle,
.tree-spacer {
  color: var(--t3);
  font-size: 12px;
  text-align: center;
}

.node-icon {
  color: var(--t1);
  font-size: 13px;
  text-align: center;
  font-family: 'SimSun', '宋体', serif;
}

.tree-action {
  width: 26px;
  height: 26px;
  border: var(--border-clear);
  background: var(--glass-1);
  color: var(--t1);
  cursor: pointer;
  line-height: 22px;
  font-size: 16px;
  font-family: Arial, sans-serif;
}

.tree-action:hover {
  border-color: rgba(0, 0, 0, 0.24);
  background: var(--glass-3);
}

.tree-action.danger {
  color: #e74c3c;
}

:global(.module-style-dialog.el-dialog) {
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  margin-bottom: 0;
  border-radius: 4px;
}

:global(.module-style-dialog .el-dialog__header) {
  flex: 0 0 auto;
  padding: 18px 22px 12px !important;
  margin-right: 0 !important;
}

:global(.module-style-dialog .el-dialog__title) {
  color: #1f2937 !important;
  font-size: 20px !important;
  font-weight: 500 !important;
}

:global(.module-style-dialog .el-dialog__body) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 0 20px !important;
}

:global(.module-style-dialog .el-dialog__footer) {
  flex: 0 0 auto;
  padding: 10px 18px 16px !important;
  border-top: 1px solid #edf1f6 !important;
}

.module-style-panel {
  max-height: calc(100vh - 158px);
  overflow: auto;
  padding: 0 10px 4px 0;
  color: #1f2937;
  font-family: "Microsoft YaHei", "微软雅黑", sans-serif;
}

.module-style-panel::-webkit-scrollbar {
  width: 6px;
}

.module-style-panel::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #d0d7e2;
}

.module-style-switches {
  display: grid;
  gap: 14px;
  padding: 4px 0 12px;
}

.style-switch-row,
.module-auto-size-row {
  display: grid;
  grid-template-columns: 90px auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  color: #606b7c;
  font-size: 14px;
}

.style-switch-row > span,
.module-auto-size-row > span {
  text-align: right;
}

.style-switch-row em,
.module-auto-size-row em {
  color: #8b95a5;
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
}

.style-grid {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 112px minmax(0, 1fr);
  align-items: center;
  gap: 14px 16px;
  margin-top: -2px;
  padding: 2px 0 8px;
}

.style-grid label {
  color: #606b7c;
  font-size: 14px;
  text-align: right;
}

.style-grid :deep(.el-input-number),
.style-grid :deep(.el-select) {
  width: 100%;
}

@media (max-width: 720px) {
  .style-grid {
    grid-template-columns: 88px minmax(0, 1fr);
  }

  .style-switch-row,
  .module-auto-size-row {
    grid-template-columns: 88px auto;
  }

  .style-switch-row em,
  .module-auto-size-row em {
    grid-column: 2;
  }
}
</style>
