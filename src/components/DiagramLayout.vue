<template>
  <div class="diagram-page" :class="{ 'embedded-preview': isEmbeddedPreview }">
    <div v-if="!isEmbeddedPreview" class="diagram-left">
      <el-card shadow="never" class="input-card">
        <template #header>
          <span class="card-header-title">{{ title }}</span>
        </template>
        <div v-if="!hideActions" class="input-toolbar">
          <div class="input-toolbar-label">快捷操作</div>
          <div class="input-toolbar-actions">
            <el-button @click="$emit('loadExample')" size="default" text>
              <el-icon style="margin-right:4px;"><Document /></el-icon>加载示例
            </el-button>
            <slot name="extraButtons" />
            <el-button @click="$emit('clear')" size="default" text :disabled="!hasContent">
              <el-icon style="margin-right:4px;"><Delete /></el-icon>清空
            </el-button>
          </div>
        </div>
        <slot name="input" />
      </el-card>
    </div>
    <div class="diagram-right">
      <div v-if="!isEmbeddedPreview" class="diagram-preview-header">
        <span class="diagram-preview-title">预览</span>
        <div class="diagram-preview-actions">
          <slot name="previewActions" />
          <template v-if="!hideDefaultPreviewActions">
            <el-button size="small" @click="zoomOut" :disabled="!hasContent">-</el-button>
            <span class="zoom-value">{{ zoomPercent }}%</span>
            <el-button size="small" @click="zoomIn" :disabled="!hasContent">+</el-button>
            <el-button size="small" @click="resetView" :disabled="!hasContent">重置</el-button>
            <el-button size="small" @click="$emit('exportPng')" :disabled="!hasContent">
              <el-icon style="margin-right:4px;"><Picture /></el-icon>导出PNG
            </el-button>
            <el-button size="small" @click="$emit('exportSvg')" :disabled="!hasContent">
              <el-icon style="margin-right:4px;"><Picture /></el-icon>导出SVG
            </el-button>
            <el-button size="small" @click="$emit('copySource')" :disabled="!hasContent">
              <el-icon style="margin-right:4px;"><CopyDocument /></el-icon>复制源码
            </el-button>
          </template>
        </div>
      </div>
      <div
        class="diagram-preview-body"
        ref="previewContainer"
        @wheel.prevent="handleWheel"
        @pointerdown="startPan"
        @pointermove="movePan"
        @pointerup="endPan"
        @pointercancel="endPan"
        @pointerleave="endPan"
      >
        <div
          class="diagram-zoom-canvas"
          :class="{ dragging: isDragging }"
          :style="canvasStyle"
        >
          <slot name="preview" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { CopyDocument, Delete, Document, Picture } from '@element-plus/icons-vue'

defineProps<{
  title: string
  hasContent: boolean
  hideActions?: boolean
  hideDefaultPreviewActions?: boolean
}>()

defineEmits<{
  loadExample: []
  clear: []
  exportPng: []
  exportSvg: []
  copySource: []
}>()

const previewContainer = ref<HTMLElement>()
const route = useRoute()
const isEmbeddedPreview = computed(() => route.query.embed === 'preview')
const defaultScale = 1.25
const scale = ref(defaultScale)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const viewStart = ref({ x: 0, y: 0 })

const zoomPercent = computed(() => Math.round(scale.value * 100))
const canvasStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
}))

function clampScale(value: number) {
  return Math.min(4, Math.max(0.25, value))
}

function zoomBy(delta: number) {
  scale.value = clampScale(Number((scale.value + delta).toFixed(2)))
  clampCurrentView()
}

function zoomIn() {
  zoomBy(0.1)
}

function zoomOut() {
  zoomBy(-0.1)
}

function resetView() {
  scale.value = defaultScale
  translateX.value = 0
  translateY.value = 0
  clampCurrentView()
}

interface FitViewOptions {
  padding?: number
  maxScale?: number
  selector?: string
}

interface SvgBounds {
  x: number
  y: number
  width: number
  height: number
}

async function fitView(options: FitViewOptions = {}) {
  await nextTick()
  const container = previewContainer.value
  const svg = container?.querySelector<SVGSVGElement>('svg')
  if (!container || !svg) return

  const padding = options.padding ?? 40
  const maxScale = options.maxScale ?? defaultScale
  const bounds = getSvgContentBounds(svg, options.selector)
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return

  const viewportW = Math.max(1, container.clientWidth)
  const viewportH = Math.max(1, container.clientHeight)
  const fitScale = Math.min(
    maxScale,
    (viewportW - padding * 2) / bounds.width,
    (viewportH - padding * 2) / bounds.height
  )
  scale.value = clampScale(Number(Math.max(0.25, fitScale).toFixed(2)))

  const viewBox = svg.viewBox.baseVal
  const svgWidth = viewBox?.width || Number(svg.getAttribute('width')) || bounds.width
  const boundsCenterX = bounds.x + bounds.width / 2
  const svgCenterX = (viewBox?.x || 0) + svgWidth / 2
  const nextX = -(boundsCenterX - svgCenterX) * scale.value
  const nextY = Math.max(padding, (viewportH - bounds.height * scale.value) / 2) - bounds.y * scale.value
  const clamped = clampTranslate(nextX, nextY)
  translateX.value = clamped.x
  translateY.value = clamped.y
}

function getSvgContentBounds(svg: SVGSVGElement, selector?: string): SvgBounds | null {
  const elements = selector
    ? Array.from(svg.querySelectorAll<SVGGraphicsElement>(selector))
    : []
  const visibleElements = elements.filter((element) => {
    const box = element.getBBox()
    return Number.isFinite(box.width) && Number.isFinite(box.height) && box.width > 0 && box.height > 0
  })

  if (visibleElements.length === 0) {
    const viewBox = svg.viewBox.baseVal
    if (viewBox?.width && viewBox?.height) {
      return { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height }
    }
    return null
  }

  const firstBox = visibleElements[0].getBBox()
  const initialBounds: SvgBounds = {
    x: firstBox.x,
    y: firstBox.y,
    width: firstBox.width,
    height: firstBox.height,
  }

  return visibleElements.reduce<SvgBounds>((bounds, element) => {
    const box = element.getBBox()
    const minX = Math.min(bounds.x, box.x)
    const minY = Math.min(bounds.y, box.y)
    const maxX = Math.max(bounds.x + bounds.width, box.x + box.width)
    const maxY = Math.max(bounds.y + bounds.height, box.y + box.height)
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }, initialBounds)
}

function handleWheel(event: WheelEvent) {
  const next = event.deltaY < 0 ? scale.value * 1.1 : scale.value / 1.1
  scale.value = clampScale(Number(next.toFixed(2)))
  clampCurrentView()
}

function startPan(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) return
  isDragging.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  viewStart.value = { x: translateX.value, y: translateY.value }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function movePan(event: PointerEvent) {
  if (!isDragging.value) return
  const next = clampTranslate(
    viewStart.value.x + event.clientX - dragStart.value.x,
    viewStart.value.y + event.clientY - dragStart.value.y
  )
  translateX.value = next.x
  translateY.value = next.y
}

function endPan(event: PointerEvent) {
  if (!isDragging.value) return
  isDragging.value = false
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture?.(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
}

function clampCurrentView() {
  const next = clampTranslate(translateX.value, translateY.value)
  translateX.value = next.x
  translateY.value = next.y
}

function clampTranslate(x: number, y: number) {
  const container = previewContainer.value
  const canvas = container?.querySelector<HTMLElement>('.diagram-zoom-canvas')
  if (!container || !canvas) return { x, y }

  const keepVisible = 96
  const viewportW = container.clientWidth || keepVisible * 2
  const viewportH = container.clientHeight || keepVisible * 2
  const canvasW = Math.max(canvas.scrollWidth, canvas.offsetWidth, viewportW) * scale.value
  const canvasH = Math.max(canvas.scrollHeight, canvas.offsetHeight, viewportH) * scale.value
  const limitX = Math.max(0, (canvasW + viewportW) / 2 - keepVisible)
  const minY = Math.min(0, keepVisible - canvasH)
  const maxY = Math.max(0, viewportH - keepVisible)

  return {
    x: Math.min(limitX, Math.max(-limitX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  }
}

defineExpose({ previewContainer, fitView, resetView })
</script>

<style scoped>
.input-card {
  /* Styled globally */
}

.input-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 0 14px;
  margin: 0 0 14px;
  border-bottom: var(--border-subtle);
}

.input-toolbar-label {
  color: var(--t3);
  font-size: 12px;
  font-weight: 600;
}

.input-toolbar-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
  gap: 8px;
}

.input-toolbar-actions :deep(.el-button) {
  width: 100%;
  min-width: 0;
  justify-content: center;
}

.input-toolbar-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 620px) {
  .input-toolbar-actions {
    grid-template-columns: 1fr;
  }
}

.embedded-preview {
  height: 100vh;
  gap: 0;
}

.embedded-preview .diagram-right {
  min-width: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: #fff;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.embedded-preview .diagram-right:hover {
  box-shadow: none;
}

.embedded-preview :global(.diagram-preview-body) {
  border-radius: 0;
  padding: 0;
}
</style>
