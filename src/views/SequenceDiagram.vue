<template>
  <DiagramLayout
    title="时序图"
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
        <div class="editor-hint">维护生命线与消息，可拖拽顺序后续再加；当前编辑会实时更新图表</div>

        <el-tabs v-model="activeTab" type="card">
          <el-tab-pane label="参与者" name="participants">
            <div class="editor-section">
              <div class="editor-section-title">
                <span>生命线（{{ participants.length }}）</span>
                <button class="editor-add" type="button" @click="addParticipant()">+ 新增生命线</button>
              </div>
              <div class="editor-list">
                <div v-for="(item, index) in participants" :key="item.id" class="editor-row participant-row">
                  <span class="editor-icon">↕</span>
                  <el-checkbox v-model="item.isActor">小人</el-checkbox>
                  <el-input v-model="item.name" :placeholder="`对象${index + 1}`" />
                  <button class="editor-action danger" type="button" @click="removeParticipant(index)">×</button>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="消息" name="messages">
            <div class="editor-section">
              <div class="editor-section-title">
                <span>消息交互（{{ messages.length }}）</span>
                <button class="editor-add" type="button" @click="addMessage()">+ 新增消息</button>
              </div>
              <div class="editor-list">
                <div v-for="(msg, index) in messages" :key="msg.id" class="sequence-message-row">
                  <span class="editor-icon">↕</span>
                  <el-select v-model="msg.type">
                    <el-option label="同步" value="sync" />
                    <el-option label="异步" value="async" />
                    <el-option label="返回" value="return" />
                    <el-option label="自调用" value="self" />
                  </el-select>
                  <el-select v-model="msg.from" filterable allow-create placeholder="发送方">
                    <el-option v-for="item in participantNames" :key="item" :label="item" :value="item" />
                  </el-select>
                  <span class="arrow-label">→</span>
                  <el-select v-model="msg.to" filterable allow-create placeholder="接收方">
                    <el-option v-for="item in participantNames" :key="item" :label="item" :value="item" />
                  </el-select>
                  <el-input v-model="msg.message" :placeholder="`消息${index + 1}`" />
                  <button class="editor-action" type="button" title="复制消息" @click="duplicateMessage(index)">⧉</button>
                  <button class="editor-action danger" type="button" title="删除消息" @click="removeMessage(index)">×</button>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="组合" name="fragments">
            <div class="editor-section">
              <div class="editor-section-title">
                <span>组合片段（{{ fragments.length }}）</span>
                <button class="editor-add" type="button" @click="addFragment()">+ 新增片段</button>
              </div>
              <div class="editor-list">
                <div v-for="(fragment, index) in fragments" :key="fragment.id" class="fragment-row">
                  <div class="fragment-main">
                    <el-select v-model="fragment.type">
                      <el-option label="alt（条件）" value="alt" />
                      <el-option label="loop（循环）" value="loop" />
                      <el-option label="opt（可选）" value="opt" />
                    </el-select>
                    <el-input v-model="fragment.condition" placeholder="条件说明" />
                    <button class="editor-action danger" type="button" @click="removeFragment(index)">×</button>
                  </div>
                  <div class="fragment-scope">
                    <span>范围：</span>
                    <el-select v-model="fragment.startMessageId" placeholder="开始消息">
                      <el-option v-for="item in messages" :key="item.id" :label="item.message || `消息${item.id}`" :value="item.id" />
                    </el-select>
                    <el-select v-model="fragment.endMessageId" placeholder="结束消息">
                      <el-option v-for="item in messages" :key="item.id" :label="item.message || `消息${item.id}`" :value="item.id" />
                    </el-select>
                  </div>
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
      <div v-if="!hasContent" class="diagram-placeholder">请添加生命线和消息</div>
      <div v-else ref="previewEl" style="width:100%;min-height:300px;"></div>
    </template>
  </DiagramLayout>

  <el-dialog v-model="quickFillVisible" title="快速填写时序图" width="640px">
    <div class="quick-fill-help">
      第一行填写参与对象；后续每行使用“发送方 -> 接收方：消息”格式，返回消息可写“发送方 --> 接收方：消息”。
    </div>
    <el-input
      v-model="quickFillText"
      type="textarea"
      :rows="12"
      placeholder="参与对象：用户、客户端、服务端&#10;用户 -> 客户端：点击操作&#10;客户端 -> 服务端：请求数据&#10;服务端 --> 客户端：返回结果"
    />
    <template #footer>
      <el-button @click="quickFillVisible = false">取消</el-button>
      <el-button type="primary" @click="applyQuickFill">确认填充</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="styleDialogVisible"
    title="时序图样式设置"
    width="620px"
    top="16px"
    class="sequence-style-dialog"
    append-to-body
  >
    <div v-if="styleDraft" class="sequence-style-panel">
      <div class="sequence-style-switches">
        <div class="style-switch-row">
          <span>实时渲染</span>
          <el-switch v-model="styleDraft.realTimeRender" />
          <em>开启后编辑器或样式变动会立即刷新图表。</em>
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">全局配置</div>
        <div class="style-grid">
          <label>背景颜色</label>
          <el-color-picker v-model="styleDraft.backgroundColor" size="small" show-alpha />
          <label>字体</label>
          <el-select v-model="styleDraft.fontFamily" size="small">
            <el-option label="宋体+Times" value="SimSun, 宋体, Times New Roman, serif" />
            <el-option label="微软雅黑" value="Microsoft YaHei, 微软雅黑, sans-serif" />
            <el-option label="黑体" value="SimHei, 黑体, sans-serif" />
          </el-select>
          <label>文字颜色</label>
          <el-color-picker v-model="styleDraft.fontColor" size="small" />
          <label>字体大小</label>
          <el-input-number v-model="styleDraft.fontSize" :min="10" :max="40" controls-position="right" size="small" />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">参与者配置</div>
        <div class="style-grid">
          <label>矩形宽度</label>
          <el-input-number v-model="styleDraft.participantWidth" :min="60" :max="260" controls-position="right" size="small" />
          <label>矩形高度</label>
          <el-input-number v-model="styleDraft.participantHeight" :min="26" :max="90" controls-position="right" size="small" />
          <label>宽度自适应</label>
          <el-switch v-model="styleDraft.participantAutoWidth" />
          <label>参与者方框</label>
          <el-color-picker v-model="styleDraft.participantBorderColor" size="small" />
          <label>填充颜色</label>
          <el-color-picker v-model="styleDraft.participantFill" size="small" show-alpha />
          <label>方框圆角</label>
          <el-input-number v-model="styleDraft.participantRadius" :min="0" :max="40" controls-position="right" size="small" />
          <label>小人样式</label>
          <el-radio-group class="wide-style-control" v-model="styleDraft.actorStyle" size="small">
            <el-radio value="actor">小人</el-radio>
            <el-radio value="box">方框</el-radio>
            <el-radio value="actorBox">小人+方框</el-radio>
          </el-radio-group>
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">生命线配置</div>
        <div class="style-grid">
          <label>生命线间距</label>
          <el-input-number v-model="styleDraft.lifelineGap" :min="120" :max="420" :step="10" controls-position="right" size="small" />
          <label>生命线颜色</label>
          <el-color-picker v-model="styleDraft.lifelineColor" size="small" />
          <label>宽度自适应</label>
          <el-switch v-model="styleDraft.lifelineAutoWidth" />
          <label>激活条颜色</label>
          <el-color-picker v-model="styleDraft.activationColor" size="small" show-alpha />
          <label>小人激活条</label>
          <el-switch v-model="styleDraft.compactActivation" />
          <label>自动延长激活</label>
          <el-switch v-model="styleDraft.autoExtendActivation" />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">消息配置</div>
        <div class="style-grid">
          <label>消息间距</label>
          <el-input-number v-model="styleDraft.messageGap" :min="36" :max="120" controls-position="right" size="small" />
          <label>线条宽度</label>
          <el-input-number v-model="styleDraft.messageLineWidth" :min="0.5" :max="6" :step="0.5" controls-position="right" size="small" />
          <label>同步消息箭头</label>
          <el-select v-model="styleDraft.syncArrow" size="small">
            <el-option label="开放箭头" value="open" />
            <el-option label="实心箭头" value="filled" />
            <el-option label="无箭头" value="none" />
          </el-select>
          <label>异步消息箭头</label>
          <el-select v-model="styleDraft.asyncArrow" size="small">
            <el-option label="开放箭头" value="open" />
            <el-option label="实心箭头" value="filled" />
            <el-option label="无箭头" value="none" />
          </el-select>
          <label>返回消息箭头</label>
          <el-select v-model="styleDraft.returnArrow" size="small">
            <el-option label="开放箭头" value="open" />
            <el-option label="实心箭头" value="filled" />
            <el-option label="无箭头" value="none" />
          </el-select>
          <label>自调用箭头</label>
          <el-select v-model="styleDraft.selfArrow" size="small">
            <el-option label="开放箭头" value="open" />
            <el-option label="实心箭头" value="filled" />
            <el-option label="无箭头" value="none" />
          </el-select>
          <label>消息线颜色</label>
          <el-color-picker v-model="styleDraft.messageLineColor" size="small" />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">组合配置</div>
        <div class="style-grid">
          <label>组合框颜色</label>
          <el-color-picker v-model="styleDraft.fragmentBorderColor" size="small" />
          <label>便签背景</label>
          <el-color-picker v-model="styleDraft.fragmentBackground" size="small" show-alpha />
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
import { computed, nextTick, ref, watch } from 'vue'
import DiagramLayout from '@/components/DiagramLayout.vue'
import { buildSvg, textWidth } from '@/utils/svg-style'
import { exportToPng, exportToSvg, copyToClipboard } from '@/utils/export'
import { readDiagramStorage } from '@/utils/diagramStorage'
import { ElMessage } from 'element-plus'

interface ParticipantItem {
  id: number
  name: string
  isActor: boolean
  offsetX: number
  offsetY: number
}

type MessageType = 'sync' | 'async' | 'return' | 'self'
type SequenceActorStyle = 'actor' | 'box' | 'actorBox'
type SequenceArrowStyle = 'open' | 'filled' | 'none'

interface MessageItem {
  id: number
  from: string
  to: string
  message: string
  type: MessageType
}

interface FragmentItem {
  id: number
  type: 'alt' | 'loop' | 'opt'
  condition: string
  startMessageId?: number
  endMessageId?: number
}

interface SequenceStyle {
  realTimeRender: boolean
  backgroundColor: string
  fontColor: string
  fontFamily: string
  fontSize: number
  participantWidth: number
  participantHeight: number
  participantAutoWidth: boolean
  participantBorderColor: string
  participantFill: string
  participantRadius: number
  actorStyle: SequenceActorStyle
  lifelineGap: number
  lifelineColor: string
  lifelineAutoWidth: boolean
  activationColor: string
  compactActivation: boolean
  autoExtendActivation: boolean
  messageGap: number
  messageLineWidth: number
  syncArrow: SequenceArrowStyle
  asyncArrow: SequenceArrowStyle
  returnArrow: SequenceArrowStyle
  selfArrow: SequenceArrowStyle
  messageLineColor: string
  fragmentBorderColor: string
  fragmentBackground: string
}

const SEQUENCE_STYLE_STORAGE_KEY = 'diagram:sequence-style'

const activeTab = ref('participants')
const participants = ref<ParticipantItem[]>([])
const messages = ref<MessageItem[]>([])
const fragments = ref<FragmentItem[]>([])
const sequenceStyle = ref<SequenceStyle>(createDefaultSequenceStyle())
const styleDraft = ref<SequenceStyle | null>(null)
const styleSnapshot = ref<SequenceStyle | null>(null)
const styleDialogVisible = ref(false)
const quickFillVisible = ref(false)
const quickFillText = ref('')
const previewEl = ref<HTMLElement>()
const layoutRef = ref<InstanceType<typeof DiagramLayout>>()

let timer: number | undefined
let nodeId = 0
let draggingParticipantIndex: number | null = null
let dragStartPoint = { x: 0, y: 0 }
let dragStartOffset = { x: 0, y: 0 }

const participantNames = computed(() => participants.value.map((item, index) => item.name.trim() || `对象${index + 1}`))

const hasContent = computed(() => {
  return Boolean(
    participants.value.some((item) => item.name.trim()) ||
    messages.value.some((item) => item.from.trim() || item.to.trim() || item.message.trim())
  )
})

watch([participants, messages, fragments, sequenceStyle], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(generate, 300)
}, { deep: true })

watch(styleDraft, (draft) => {
  if (!styleDialogVisible.value || !draft?.realTimeRender) return
  sequenceStyle.value = normalizeSequenceStyle(cloneSequenceStyle(draft))
  saveCurrentStyle()
  window.clearTimeout(timer)
  timer = window.setTimeout(generate, 120)
}, { deep: true })

function createDefaultSequenceStyle(): SequenceStyle {
  return {
    realTimeRender: true,
    backgroundColor: '#ffffff',
    fontColor: '#000000',
    fontFamily: 'SimSun, 宋体, Times New Roman, serif',
    fontSize: 16,
    participantWidth: 100,
    participantHeight: 40,
    participantAutoWidth: true,
    participantBorderColor: '#000000',
    participantFill: '#eaf6ff',
    participantRadius: 0,
    actorStyle: 'actor',
    lifelineGap: 200,
    lifelineColor: '#000000',
    lifelineAutoWidth: true,
    activationColor: '#ffffff',
    compactActivation: false,
    autoExtendActivation: false,
    messageGap: 60,
    messageLineWidth: 1.2,
    syncArrow: 'filled',
    asyncArrow: 'open',
    returnArrow: 'open',
    selfArrow: 'filled',
    messageLineColor: '#000000',
    fragmentBorderColor: '#000000',
    fragmentBackground: '#fff6c8',
  }
}

function normalizeSequenceStyle(style: SequenceStyle): SequenceStyle {
  const defaults = createDefaultSequenceStyle()
  return {
    ...defaults,
    ...style,
    fontSize: Math.max(10, Math.min(40, style.fontSize || defaults.fontSize)),
    participantWidth: Math.max(60, Math.min(260, style.participantWidth || defaults.participantWidth)),
    participantHeight: Math.max(26, Math.min(90, style.participantHeight || defaults.participantHeight)),
    lifelineGap: Math.max(120, Math.min(420, style.lifelineGap || defaults.lifelineGap)),
    messageGap: Math.max(36, Math.min(120, style.messageGap || defaults.messageGap)),
    messageLineWidth: Math.max(0.5, Math.min(6, style.messageLineWidth || defaults.messageLineWidth)),
  }
}

function cloneSequenceStyle(style: SequenceStyle): SequenceStyle {
  return JSON.parse(JSON.stringify(style))
}

function saveCurrentStyle() {
  localStorage.setItem(SEQUENCE_STYLE_STORAGE_KEY, JSON.stringify(sequenceStyle.value))
}

function loadStoredStyle() {
  const stored = localStorage.getItem(SEQUENCE_STYLE_STORAGE_KEY)
  if (!stored) return
  try {
    sequenceStyle.value = normalizeSequenceStyle({
      ...createDefaultSequenceStyle(),
      ...JSON.parse(stored),
    })
  } catch {
    localStorage.removeItem(SEQUENCE_STYLE_STORAGE_KEY)
  }
}

function createParticipant(name = '', isActor = false): ParticipantItem {
  return { id: ++nodeId, name, isActor, offsetX: 0, offsetY: 0 }
}

function createMessage(from = '', to = '', message = '', type: MessageType = 'sync'): MessageItem {
  return { id: ++nodeId, from, to, message, type }
}

function createFragment(type: FragmentItem['type'] = 'alt', condition = ''): FragmentItem {
  return {
    id: ++nodeId,
    type,
    condition,
    startMessageId: messages.value[0]?.id,
    endMessageId: messages.value[messages.value.length - 1]?.id,
  }
}

function addParticipant() {
  participants.value.push(createParticipant(`对象${participants.value.length + 1}`))
}

function removeParticipant(index: number) {
  participants.value.splice(index, 1)
}

function addMessage() {
  messages.value.push(createMessage(
    participantNames.value[0] || '对象1',
    participantNames.value[1] || '对象2',
    `消息${messages.value.length + 1}`,
  ))
}

function duplicateMessage(index: number) {
  const item = messages.value[index]
  if (!item) return
  messages.value.splice(index + 1, 0, createMessage(item.from, item.to, item.message, item.type))
}

function removeMessage(index: number) {
  messages.value.splice(index, 1)
}

function addFragment() {
  fragments.value.push(createFragment('alt', '条件'))
}

function removeFragment(index: number) {
  fragments.value.splice(index, 1)
}

function openStyleDialog() {
  styleSnapshot.value = cloneSequenceStyle(sequenceStyle.value)
  styleDraft.value = cloneSequenceStyle(sequenceStyle.value)
  styleDialogVisible.value = true
}

function applyStyleDialog() {
  if (!styleDraft.value) return
  sequenceStyle.value = normalizeSequenceStyle(cloneSequenceStyle(styleDraft.value))
  saveCurrentStyle()
  styleSnapshot.value = null
  styleDialogVisible.value = false
  nextTick(generate)
}

function cancelStyleDialog() {
  if (styleSnapshot.value) {
    sequenceStyle.value = cloneSequenceStyle(styleSnapshot.value)
  }
  styleDialogVisible.value = false
  styleDraft.value = null
  styleSnapshot.value = null
  nextTick(generate)
}

function restoreDefaultStyle() {
  styleDraft.value = createDefaultSequenceStyle()
  sequenceStyle.value = normalizeSequenceStyle(cloneSequenceStyle(styleDraft.value))
  saveCurrentStyle()
  nextTick(generate)
}

function aliasFor(index: number) {
  return `P${index}`
}

function buildMermaidCode(): string {
  let code = 'sequenceDiagram\n'
  const names = participantNames.value
  const aliasMap = new Map<string, string>()

  names.forEach((name, index) => {
    const alias = aliasFor(index)
    aliasMap.set(name, alias)
    const keyword = participants.value[index]?.isActor ? 'actor' : 'participant'
    code += `    ${keyword} ${alias} as ${name}\n`
  })

  function getAlias(name: string): string {
    const trimmed = name.trim()
    if (!trimmed) return ''
    if (aliasMap.has(trimmed)) return aliasMap.get(trimmed)!
    return trimmed.replace(/\s+/g, '_')
  }

  const fragmentStarts = new Map<number, FragmentItem[]>()
  const fragmentEnds = new Map<number, FragmentItem[]>()
  fragments.value.forEach((fragment) => {
    if (fragment.startMessageId) {
      const list = fragmentStarts.get(fragment.startMessageId) || []
      list.push(fragment)
      fragmentStarts.set(fragment.startMessageId, list)
    }
    if (fragment.endMessageId) {
      const list = fragmentEnds.get(fragment.endMessageId) || []
      list.push(fragment)
      fragmentEnds.set(fragment.endMessageId, list)
    }
  })

  messages.value.forEach((message, index) => {
    const starts = fragmentStarts.get(message.id) || []
    starts.forEach((fragment) => {
      code += `    ${fragment.type} ${fragment.condition || '条件'}\n`
    })

    const from = getAlias(message.from || names[0] || '对象1')
    const to = message.type === 'self' ? from : getAlias(message.to || names[1] || '对象2')
    const text = message.message.trim() || `消息${index + 1}`
    const arrow = message.type === 'async' ? '-->>' : message.type === 'return' ? '-->' : '->>'
    if (from && to) code += `    ${from}${arrow}${to}: ${text}\n`

    const ends = fragmentEnds.get(message.id) || []
    ends.slice().reverse().forEach(() => {
      code += `    end\n`
    })
  })

  return code
}

function generate() {
  if (!previewEl.value) return
  if (!hasContent.value) {
    previewEl.value.innerHTML = ''
    return
  }
  previewEl.value.innerHTML = generateSequenceSVG()
  bindParticipantDrag()
}

function bindParticipantDrag() {
  if (!previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  if (!svg) return

  previewEl.value.querySelectorAll<SVGGElement>('.draggable-sequence-participant').forEach((group) => {
    group.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()

      const index = Number(group.dataset.index)
      const target = participants.value[index]
      if (!target) return

      draggingParticipantIndex = index
      dragStartPoint = getSvgPoint(event, svg)
      dragStartOffset = { x: target.offsetX, y: target.offsetY }

      window.addEventListener('pointermove', handleParticipantDrag)
      window.addEventListener('pointerup', stopParticipantDrag, { once: true })
      window.addEventListener('pointercancel', stopParticipantDrag, { once: true })
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

function handleParticipantDrag(event: PointerEvent) {
  if (draggingParticipantIndex === null || !previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  const target = participants.value[draggingParticipantIndex]
  if (!svg || !target) return

  event.preventDefault()
  const current = getSvgPoint(event, svg)
  target.offsetX = Math.round(dragStartOffset.x + current.x - dragStartPoint.x)
  target.offsetY = Math.round(dragStartOffset.y + current.y - dragStartPoint.y)
  window.clearTimeout(timer)
  generate()
}

function stopParticipantDrag() {
  draggingParticipantIndex = null
  window.removeEventListener('pointermove', handleParticipantDrag)
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function participantBoxWidth(name: string) {
  const style = sequenceStyle.value
  return style.participantAutoWidth
    ? Math.max(style.participantWidth, textWidth(name, style.fontSize) + 34)
    : style.participantWidth
}

function sequenceSvgStyle() {
  const style = sequenceStyle.value
  return `<defs>
    <marker id="seq-arrow-filled" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${style.messageLineColor}"/>
    </marker>
    <marker id="seq-arrow-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="${style.messageLineColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <style>
      .seq-node-box { fill: ${style.participantFill}; stroke: ${style.participantBorderColor}; stroke-width: 1.2; }
      .seq-actor-line { stroke: ${style.participantBorderColor}; stroke-width: 1.5; fill: none; }
      .seq-life-line { stroke: ${style.lifelineColor}; stroke-width: 1.1; fill: none; stroke-dasharray: 6 4; }
      .seq-message-line { stroke: ${style.messageLineColor}; stroke-width: ${style.messageLineWidth}; fill: none; }
      .seq-message-return { stroke: ${style.messageLineColor}; stroke-width: ${style.messageLineWidth}; fill: none; stroke-dasharray: 6 4; }
      .seq-label { font-family: ${style.fontFamily}; fill: ${style.fontColor}; text-anchor: middle; dominant-baseline: central; font-size: ${style.fontSize}px; }
      .seq-actor-text { font-family: ${style.fontFamily}; fill: ${style.fontColor}; font-size: ${style.fontSize}px; text-anchor: middle; }
      .seq-message-label { font-family: ${style.fontFamily}; fill: ${style.fontColor}; font-size: ${Math.max(10, style.fontSize - 2)}px; }
      .seq-fragment { fill: none; stroke: ${style.fragmentBorderColor}; stroke-width: ${style.messageLineWidth}; }
      .seq-fragment-tag { fill: ${style.fragmentBackground}; stroke: ${style.fragmentBorderColor}; stroke-width: ${style.messageLineWidth}; }
      .seq-activation { fill: ${style.activationColor}; stroke: ${style.messageLineColor}; stroke-width: ${Math.max(0.8, style.messageLineWidth * 0.8)}; }
    </style>
  </defs>`
}

function arrowMarkerAttr(arrowStyle: SequenceArrowStyle) {
  if (arrowStyle === 'none') return ''
  return ` marker-end="url(#seq-arrow-${arrowStyle})"`
}

function arrowStyleForMessage(type: MessageType) {
  const style = sequenceStyle.value
  if (type === 'async') return style.asyncArrow
  if (type === 'return') return style.returnArrow
  if (type === 'self') return style.selfArrow
  return style.syncArrow
}

function generateSequenceSVG(): string {
  const style = sequenceStyle.value
  const dragMargin = 140
  const headerY = dragMargin + 38
  const rowGap = style.messageGap
  const names = participantNames.value.length ? participantNames.value : ['对象1']
  const widestBox = Math.max(...names.map((name) => participantBoxWidth(name)))
  const participantGap = style.lifelineAutoWidth ? Math.max(style.lifelineGap, widestBox + 80) : style.lifelineGap
  const width = Math.max(560 + dragMargin * 2, dragMargin * 2 + widestBox + (names.length - 1) * participantGap + 150)

  const positions = new Map<string, { x: number; headerY: number; index: number }>()
  names.forEach((name, index) => {
    const source = participants.value[index]
    positions.set(name, {
      x: dragMargin + 110 + index * participantGap + (source?.offsetX || 0),
      headerY: headerY + (source?.offsetY || 0),
      index,
    })
  })

  const participantLayouts = new Map<string, {
    shouldDrawActor: boolean
    shouldDrawBox: boolean
    boxW: number
    boxH: number
    actorY: number
    boxY: number
    lifeTop: number
  }>()
  let headerBottomY = headerY + style.participantHeight

  names.forEach((name, index) => {
    const source = participants.value[index]
    const pos = positions.get(name)!
    const shouldDrawActor = Boolean(source?.isActor) && style.actorStyle !== 'box'
    const shouldDrawBox = !source?.isActor || style.actorStyle !== 'actor'
    const boxW = participantBoxWidth(name)
    const boxH = style.participantHeight
    const actorY = pos.headerY + 8
    const actorFootY = actorY + 60
    const actorTextY = actorY + 84
    const boxY = shouldDrawActor && shouldDrawBox
      ? actorFootY + 18
      : pos.headerY
    const boxBottom = shouldDrawBox ? boxY + boxH : pos.headerY
    const lifeTop = shouldDrawActor
      ? (shouldDrawBox ? boxBottom : actorTextY + Math.max(14, style.fontSize * 0.7))
      : boxBottom

    participantLayouts.set(name, {
      shouldDrawActor,
      shouldDrawBox,
      boxW,
      boxH,
      actorY,
      boxY,
      lifeTop,
    })
    headerBottomY = Math.max(headerBottomY, lifeTop)
  })

  const messageStartY = Math.max(
    headerY + 142,
    Math.ceil(headerBottomY + Math.max(34, style.messageGap * 0.45))
  )
  const bottomY = messageStartY + Math.max(messages.value.length, 1) * rowGap + 86
  const height = bottomY + dragMargin

  let content = ''
  content += `<rect x="0" y="0" width="${width}" height="${height}" fill="${style.backgroundColor}"/>`

  names.forEach((name, index) => {
    const pos = positions.get(name)!
    const layout = participantLayouts.get(name)!
    content += `<g class="draggable-sequence-participant" data-index="${index}" style="cursor:move;">`

    if (layout.shouldDrawActor) {
      const ay = layout.actorY
      content += `<circle class="seq-actor-line" cx="${pos.x}" cy="${ay}" r="10"/>`
      content += `<line class="seq-actor-line" x1="${pos.x}" y1="${ay + 10}" x2="${pos.x}" y2="${ay + 38}"/>`
      content += `<line class="seq-actor-line" x1="${pos.x - 20}" y1="${ay + 22}" x2="${pos.x + 20}" y2="${ay + 22}"/>`
      content += `<line class="seq-actor-line" x1="${pos.x}" y1="${ay + 38}" x2="${pos.x - 16}" y2="${ay + 60}"/>`
      content += `<line class="seq-actor-line" x1="${pos.x}" y1="${ay + 38}" x2="${pos.x + 16}" y2="${ay + 60}"/>`
      if (!layout.shouldDrawBox) {
        content += `<text class="seq-actor-text" x="${pos.x}" y="${ay + 84}">${esc(name)}</text>`
      }
    }

    if (layout.shouldDrawBox) {
      content += `<rect class="seq-node-box" x="${pos.x - layout.boxW / 2}" y="${layout.boxY}" width="${layout.boxW}" height="${layout.boxH}" rx="${style.participantRadius}"/>`
      content += `<text class="seq-label" x="${pos.x}" y="${layout.boxY + layout.boxH / 2}">${esc(name)}</text>`
    }
    content += `</g>`

    content += `<line class="seq-life-line" x1="${pos.x}" y1="${layout.lifeTop}" x2="${pos.x}" y2="${bottomY}" />`
  })

  fragments.value.forEach((fragment) => {
    const startIndex = messages.value.findIndex((item) => item.id === fragment.startMessageId)
    const endIndex = messages.value.findIndex((item) => item.id === fragment.endMessageId)
    const fromIndex = startIndex === -1 ? 0 : startIndex
    const toIndex = endIndex === -1 ? fromIndex : Math.max(fromIndex, endIndex)
    const xs = [...positions.values()].map((item) => item.x)
    const x = Math.min(...xs) - 58
    const w = Math.max(...xs) - Math.min(...xs) + 116
    const y = messageStartY + fromIndex * rowGap - 28
    const h = (toIndex - fromIndex + 1) * rowGap + 22
    const tagW = Math.max(44, textWidth(fragment.type, Math.max(10, style.fontSize - 2)) + 22)
    content += `<rect class="seq-fragment" x="${x}" y="${y}" width="${w}" height="${h}" rx="0"/>`
    content += `<path class="seq-fragment-tag" d="M ${x} ${y} H ${x + tagW} L ${x + tagW - 12} ${y + 22} H ${x} Z"/>`
    content += `<text class="seq-message-label" x="${x + 10}" y="${y + 15}">${esc(fragment.type)}</text>`
    content += `<text class="seq-message-label" x="${x + tagW + 10}" y="${y + 17}">[${esc(fragment.condition || '条件')}]</text>`
  })

  if (style.autoExtendActivation) {
    messages.value.forEach((message, index) => {
      const fromName = message.from || names[0]
      const toName = message.type === 'self' ? fromName : (message.to || names[1] || fromName)
      const to = positions.get(toName) || positions.get(names[0])
      if (!to) return
      const y = messageStartY + index * rowGap
      const activationH = Math.max(24, rowGap - (style.compactActivation ? 24 : 14))
      content += `<rect class="seq-activation" x="${to.x - 4}" y="${y - 8}" width="8" height="${activationH}" rx="0"/>`
    })
  }

  messages.value.forEach((message, index) => {
    const y = messageStartY + index * rowGap
    const fromName = message.from || names[0]
    const toName = message.type === 'self' ? fromName : (message.to || names[1] || fromName)
    const from = positions.get(fromName) || positions.get(names[0])
    const to = positions.get(toName) || positions.get(names[0])
    if (!from || !to) return

    const text = message.message.trim() || `消息${index + 1}`
    if (message.type === 'self' || from.x === to.x) {
      const loopW = 70
      content += `<path class="seq-message-line" d="M ${from.x} ${y} H ${from.x + loopW} V ${y + 28} H ${from.x + 8}"${arrowMarkerAttr(arrowStyleForMessage('self'))}/>`
      content += `<text class="seq-message-label" x="${from.x + 12}" y="${y - 8}">${esc(text)}</text>`
      return
    }

    const lineClass = message.type === 'return' || message.type === 'async' ? 'seq-message-return' : 'seq-message-line'
    const startX = from.x
    const endX = to.x
    const labelX = (startX + endX) / 2
    content += `<line class="${lineClass}" x1="${startX}" y1="${y}" x2="${endX}" y2="${y}"${arrowMarkerAttr(arrowStyleForMessage(message.type))}/>`
    content += `<text class="seq-message-label" x="${labelX}" y="${y - 8}" text-anchor="middle">${esc(text)}</text>`
  })

  return buildSvg(width, height, sequenceSvgStyle() + content) + '</svg>'
}

function openQuickFill() {
  const lines = [`参与对象：${participantNames.value.join('、')}`]
  messages.value.forEach((item) => {
    const arrow = item.type === 'return' ? '-->' : '->'
    lines.push(`${item.from} ${arrow} ${item.to}：${item.message}`)
  })
  quickFillText.value = lines.join('\n')
  quickFillVisible.value = true
}

function applyQuickFill() {
  const parsed = parseQuickFillText(quickFillText.value)
  participants.value = parsed.participants
  messages.value = parsed.messages
  fragments.value = []
  quickFillVisible.value = false
}

function parseQuickFillText(text: string): { participants: ParticipantItem[]; messages: MessageItem[] } {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const parsedParticipants: ParticipantItem[] = []
  const parsedMessages: MessageItem[] = []

  lines.forEach((line) => {
    if (/^参与/.test(line)) {
      const idx = line.includes('：') ? line.indexOf('：') : line.indexOf(':')
      const names = (idx === -1 ? line : line.substring(idx + 1))
        .split(/[,，、]/)
        .map((item) => item.trim())
        .filter(Boolean)
      names.forEach((name, index) => parsedParticipants.push(createParticipant(name, index === 0)))
      return
    }

    const match = line.match(/^(.+?)\s*(-->|->|->>|-->>)\s*(.+?)\s*[：:]\s*(.+)$/)
    if (!match) return
    const from = match[1].trim()
    const arrow = match[2]
    const to = match[3].trim()
    const message = match[4].trim()
    const type: MessageType = arrow.includes('--') ? 'return' : from === to ? 'self' : 'sync'
    parsedMessages.push(createMessage(from, to, message, type))

    if (!parsedParticipants.some((item) => item.name === from)) parsedParticipants.push(createParticipant(from))
    if (!parsedParticipants.some((item) => item.name === to)) parsedParticipants.push(createParticipant(to))
  })

  return { participants: parsedParticipants, messages: parsedMessages }
}

function loadExample() {
  participants.value = [
    createParticipant('用户', true),
    createParticipant('客户端'),
    createParticipant('服务端'),
  ]
  messages.value = [
    createMessage('用户', '客户端', '点击操作', 'sync'),
    createMessage('客户端', '服务端', '请求数据', 'sync'),
    createMessage('服务端', '服务端', '内部处理', 'self'),
    createMessage('服务端', '客户端', '返回结果', 'return'),
    createMessage('客户端', '服务端', '异步通知', 'async'),
    createMessage('客户端', '用户', '呈现结果', 'return'),
  ]
  fragments.value = [
    {
      id: ++nodeId,
      type: 'alt',
      condition: '校验成功',
      startMessageId: messages.value[2]?.id,
      endMessageId: messages.value[3]?.id,
    },
  ]
}

function loadStoredDiagram() {
  const cached = readDiagramStorage('diagram:sequence')
  if (!cached) return false
  try {
    const data = JSON.parse(cached)
    if (!Array.isArray(data.participants) && !Array.isArray(data.messages)) return false
    participants.value = (data.participants || []).map((item: any) => (
      createParticipant(String(item.name || ''), Boolean(item.isActor))
    ))
    messages.value = (data.messages || []).map((item: any) => {
      const type = ['sync', 'async', 'return', 'self'].includes(item.type)
        ? item.type as MessageType
        : 'sync'
      return createMessage(String(item.from || ''), String(item.to || ''), String(item.message || ''), type)
    })
    fragments.value = (data.fragments || []).map((item: any) => {
      const type = ['alt', 'loop', 'opt'].includes(item.type) ? item.type : 'alt'
      return createFragment(type, String(item.condition || ''))
    })
    nextTick(generate)
    return true
  } catch {
    return false
  }
}

function clearAll() {
  participants.value = []
  messages.value = []
  fragments.value = []
  if (previewEl.value) previewEl.value.innerHTML = ''
}

async function exportPng() {
  if (!previewEl.value) return
  await exportToPng(previewEl.value, '时序图')
  ElMessage.success('PNG导出成功')
}

async function exportSvg() {
  if (!previewEl.value) return
  await exportToSvg(previewEl.value, '时序图')
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
  nextTick(generate)
}
</script>

<style scoped>
.participant-row {
  grid-template-columns: 22px 72px 1fr 28px;
}

.sequence-message-row {
  display: grid;
  grid-template-columns: 22px 76px minmax(82px, 1fr) 18px minmax(82px, 1fr) minmax(120px, 1.4fr) 28px 28px;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 4px 6px;
  border: var(--border-subtle);
  background: var(--glass-2);
}

.arrow-label {
  text-align: center;
  color: var(--t4);
}

.fragment-row {
  border: var(--border-subtle);
  background: var(--glass-2);
  padding: 8px;
}

.fragment-main,
.fragment-scope {
  display: grid;
  grid-template-columns: 118px 1fr 28px;
  gap: 6px;
  align-items: center;
}

.fragment-scope {
  grid-template-columns: 42px 1fr 1fr;
  margin-top: 8px;
  color: var(--t3);
  font-size: 12px;
}

:global(.sequence-style-dialog.el-dialog) {
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow: hidden;
  background: #fff !important;
  border: 1px solid #dcdfe6 !important;
  border-radius: 4px !important;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.28) !important;
}

:global(.sequence-style-dialog .el-dialog__header) {
  flex: 0 0 auto;
  padding: 18px 22px 12px !important;
  margin-right: 0 !important;
  background: #fff !important;
}

:global(.sequence-style-dialog .el-dialog__title) {
  color: #1f2937 !important;
  font-size: 20px !important;
  font-weight: 500 !important;
}

:global(.sequence-style-dialog .el-dialog__body) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 4px 18px 8px 22px !important;
  background: #fff !important;
}

:global(.sequence-style-dialog .el-dialog__footer) {
  flex: 0 0 auto;
  padding: 10px 18px 16px !important;
  border-top: 1px solid #edf1f6 !important;
  background: #fff !important;
}

.sequence-style-panel {
  max-height: calc(100vh - 158px);
  overflow: auto;
  padding: 0 10px 4px 0;
  background: #fff;
  scrollbar-width: thin;
  scrollbar-color: #d0d7e2 transparent;
}

.sequence-style-panel::-webkit-scrollbar {
  width: 6px;
}

.sequence-style-panel::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #d0d7e2;
}

.sequence-style-switches {
  display: grid;
  gap: 14px;
  padding: 4px 0 12px;
}

.style-switch-row {
  display: grid;
  grid-template-columns: 96px auto minmax(0, 1fr);
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
  font-size: 14px;
  font-weight: 700;
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
  color: #606b7c;
  font-size: 14px;
  text-align: right;
}

.style-grid :deep(.el-input-number),
.style-grid :deep(.el-select) {
  width: 100%;
}

.style-grid :deep(.el-radio-group) {
  width: 100%;
}

.style-grid :deep(.wide-style-control) {
  grid-column: span 3;
}

@media (max-width: 620px) {
  .style-switch-row,
  .style-grid {
    grid-template-columns: 88px minmax(0, 1fr);
  }
}
</style>
