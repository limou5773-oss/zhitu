<template>
  <DiagramLayout
    title="用例图"
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
      <div class="structured-editor usecase-editor">
        <div class="editor-hint">直接编辑参与者、用例与关系，右侧实时生成 UML 用例图</div>

        <el-tabs v-model="activeEditorMode" type="card">
          <el-tab-pane label="用例编辑" name="cases">
            <div class="usecase-editor-panel">
              <div class="editor-section">
                <div class="editor-section-title">
                  <span>用例列表</span>
                  <button class="editor-add" type="button" @click="addActor()">+ 添加小人</button>
                </div>
                <div class="editor-list">
                  <template v-for="(actor, actorIndex) in actors" :key="actor.id">
                    <div class="editor-row usecase-actor-row">
                      <span class="editor-icon">人</span>
                      <el-input v-model="actor.name" :placeholder="`参与者${actorIndex + 1}`" />
                      <el-checkbox v-model="showBoundary" class="usecase-boundary-check">边界</el-checkbox>
                      <el-input v-model="systemName" class="usecase-system-input" placeholder="系统" />
                      <button class="editor-action" type="button" title="添加用例" @click="addUseCase(actorIndex)">+</button>
                      <button class="editor-action danger" type="button" title="删除参与者" @click="removeActor(actorIndex)">×</button>
                    </div>

                    <div
                      v-for="(useCase, caseIndex) in actor.useCases"
                      :key="useCase.id"
                      class="editor-row one-action indent"
                    >
                      <span class="editor-icon">○</span>
                      <el-input v-model="useCase.name" :placeholder="`用例${caseIndex + 1}`" />
                      <button class="editor-action danger" type="button" title="删除用例" @click="removeUseCase(actorIndex, caseIndex)">×</button>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="关系连线" name="relations">
            <div class="editor-section usecase-relation-section">
              <div class="editor-section-title">
                <span>连线列表（{{ relations.length }}）</span>
                <div class="usecase-relation-actions">
                  <button class="editor-add" type="button" @click="syncDefaultRelations()">自动连线</button>
                  <button class="editor-add" type="button" @click="addRelation()">+ 添加关系</button>
                </div>
              </div>
              <div class="usecase-relation-help">
                默认按参与者下的用例生成关联；需要调整时，选择“源节点 → 目标节点”，中间选择关系类型。
              </div>
              <div class="editor-list usecase-relation-list">
                <div
                  v-for="(relation, index) in relations"
                  :key="relation.id"
                  class="usecase-relation-row"
                >
                  <span class="editor-icon">↕</span>
                  <el-select v-model="relation.from" size="default" filterable placeholder="源节点">
                    <el-option
                      v-for="option in relationNodeOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                  <el-select v-model="relation.type" size="default">
                    <el-option
                      v-for="option in relationTypeOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                  <span class="arrow-label">→</span>
                  <el-select v-model="relation.to" size="default" filterable placeholder="目标节点">
                    <el-option
                      v-for="option in relationNodeOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                  <button class="editor-action danger" type="button" title="删除关系" @click="removeRelation(index)">×</button>
                </div>
                <div v-if="relations.length === 0" class="usecase-empty-state">
                  先添加参与者和用例，或点击“自动连线”生成默认连接关系。
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
      <div v-if="!hasContent" class="diagram-placeholder">请添加系统、参与者或用例</div>
      <div v-else ref="previewEl" style="width:100%;overflow:visible;"></div>
    </template>
  </DiagramLayout>

  <el-dialog v-model="quickFillVisible" title="快速填写用例图" width="640px">
    <div class="quick-fill-help">
      第一行填写系统名称；后续每行使用“参与者：用例1，用例2，用例3”的格式。
    </div>
    <el-input
      v-model="quickFillText"
      type="textarea"
      :rows="12"
      placeholder="系统&#10;参与者：用例1，用例2&#10;管理员：管理用户，管理数据"
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
    class="usecase-style-dialog"
    append-to-body
  >
    <div v-if="styleDraft" class="usecase-style-panel">
      <div class="usecase-style-switches">
        <div class="style-switch-row">
          <span>实时渲染</span>
          <el-switch v-model="styleDraft.realTimeRender" />
          <em>开启后编辑时自动更新图表</em>
        </div>
        <div class="style-switch-row">
          <span>文本自适应</span>
          <el-switch v-model="styleDraft.autoTextWidth" />
          <em>开启后节点宽度根据文本长度自动调整</em>
        </div>
        <div class="style-switch-row">
          <span>连线集中</span>
          <el-switch v-model="styleDraft.concentratedLines" />
          <em>开启后同侧连线更集中，关系线更利落</em>
        </div>
        <div class="style-switch-row">
          <span>边界包含子项</span>
          <el-switch v-model="styleDraft.boundaryContainsChildren" />
          <em>开启后，边界框将包含层级下对应的所有子用例</em>
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">布局间距配置</div>
        <div class="style-grid">
          <label>用例椭圆宽度</label>
          <el-input-number v-model="styleDraft.useCaseWidth" :min="70" :max="320" controls-position="right" size="small" />
          <label>用例椭圆高度</label>
          <el-input-number v-model="styleDraft.useCaseHeight" :min="34" :max="150" controls-position="right" size="small" />
          <label>用例横向</label>
          <el-input-number v-model="styleDraft.useCaseHorizontalGap" :min="120" :max="520" :step="10" controls-position="right" size="small" />
          <label>用例纵向</label>
          <el-input-number v-model="styleDraft.useCaseVerticalGap" :min="40" :max="220" :step="10" controls-position="right" size="small" />
          <label>参与者横向</label>
          <el-input-number v-model="styleDraft.actorHorizontalGap" :min="180" :max="620" :step="10" controls-position="right" size="small" />
          <label>组间纵向</label>
          <el-input-number v-model="styleDraft.groupVerticalGap" :min="30" :max="180" :step="10" controls-position="right" size="small" />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">样式配置</div>
        <div class="style-grid">
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
          <label>用例颜色</label>
          <el-color-picker v-model="styleDraft.useCaseFill" size="small" show-alpha />
          <label>参与者颜色</label>
          <el-color-picker v-model="styleDraft.actorColor" size="small" />
          <label>文本沿线排列</label>
          <el-switch v-model="styleDraft.textAlongLine" />
          <label>文本背景色</label>
          <el-color-picker v-model="styleDraft.textBackground" size="small" show-alpha />
          <label>边界颜色</label>
          <el-color-picker v-model="styleDraft.boundaryColor" size="small" />
          <label>边界样式</label>
          <el-switch v-model="styleDraft.boundaryDashed" inactive-text="实线" active-text="虚线" />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">箭头样式配置</div>
        <div class="style-grid">
          <label>关联箭头</label>
          <el-select v-model="styleDraft.associationArrow" size="small">
            <el-option label="开放箭头" value="open" />
            <el-option label="实心箭头" value="filled" />
            <el-option label="无箭头" value="none" />
          </el-select>
          <label>包含箭头</label>
          <el-select v-model="styleDraft.includeArrow" size="small">
            <el-option label="开放箭头" value="open" />
            <el-option label="实心箭头" value="filled" />
            <el-option label="无箭头" value="none" />
          </el-select>
          <label>扩展箭头</label>
          <el-select v-model="styleDraft.extendArrow" size="small">
            <el-option label="开放箭头" value="open" />
            <el-option label="实心箭头" value="filled" />
            <el-option label="无箭头" value="none" />
          </el-select>
          <label>泛化箭头</label>
          <el-select v-model="styleDraft.generalizationArrow" size="small">
            <el-option label="空心三角" value="triangle" />
            <el-option label="开放箭头" value="open" />
            <el-option label="无箭头" value="none" />
          </el-select>
          <label>扩展反向</label>
          <el-switch v-model="styleDraft.extendReverse" inactive-text="正向" active-text="反向" />
          <label>泛化反向</label>
          <el-switch v-model="styleDraft.generalizationReverse" inactive-text="正向" active-text="反向" />
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
import { computed, onMounted, nextTick, ref, watch } from 'vue'
import DiagramLayout from '@/components/DiagramLayout.vue'
import { exportToPng, exportToSvg, copyToClipboard } from '@/utils/export'
import { buildSvg, textWidth } from '@/utils/svg-style'
import { readDiagramStorage } from '@/utils/diagramStorage'
import { ElMessage } from 'element-plus'

type UseCaseArrowStyle = 'open' | 'filled' | 'none'
type UseCaseGeneralizationArrowStyle = 'triangle' | 'open' | 'none'
type UseCaseAnchorSide = 'top' | 'right' | 'bottom' | 'left'
type UseCaseEditorMode = 'cases' | 'relations'
type UseCaseRelationType = 'association' | 'include' | 'extend' | 'generalization' | 'line' | 'none'
type UseCaseRelationNodeKind = 'actor' | 'case'

interface UseCaseItem {
  id: number
  name: string
  offsetX: number
  offsetY: number
}

interface ActorItem {
  id: number
  name: string
  useCases: UseCaseItem[]
  offsetX: number
  offsetY: number
}

interface RenderUseCase {
  name: string
  offsetX: number
  offsetY: number
}

interface RenderActor {
  name: string
  offsetX: number
  offsetY: number
}

interface UseCaseRelation {
  id: number
  from: string
  to: string
  type: UseCaseRelationType
}

interface RenderRelation {
  fromKind: UseCaseRelationNodeKind
  fromName: string
  toKind: UseCaseRelationNodeKind
  toName: string
  type: UseCaseRelationType
}

interface UseCaseStyle {
  realTimeRender: boolean
  autoTextWidth: boolean
  concentratedLines: boolean
  boundaryContainsChildren: boolean
  useCaseWidth: number
  useCaseHeight: number
  useCaseHorizontalGap: number
  useCaseVerticalGap: number
  actorHorizontalGap: number
  groupVerticalGap: number
  backgroundColor: string
  fontColor: string
  fontFamily: string
  fontSize: number
  lineColor: string
  lineWidth: number
  useCaseFill: string
  actorColor: string
  textAlongLine: boolean
  textBackground: string
  boundaryColor: string
  boundaryDashed: boolean
  associationArrow: UseCaseArrowStyle
  includeArrow: UseCaseArrowStyle
  extendArrow: UseCaseArrowStyle
  generalizationArrow: UseCaseGeneralizationArrowStyle
  extendReverse: boolean
  generalizationReverse: boolean
}

interface UseCaseBox {
  cx: number
  cy: number
  w: number
  h: number
}

interface RelationNodeBox {
  kind: UseCaseRelationNodeKind
  name: string
  cx: number
  cy: number
  ax?: number
  ay?: number
  box?: UseCaseBox
}

const USECASE_STYLE_STORAGE_KEY = 'diagram:usecase-style'

const systemName = ref('')
const actors = ref<ActorItem[]>([])
const relations = ref<UseCaseRelation[]>([])
const activeEditorMode = ref<UseCaseEditorMode>('cases')
const showBoundary = ref(true)
const useCaseStyle = ref<UseCaseStyle>(createDefaultUseCaseStyle())
const styleDraft = ref<UseCaseStyle | null>(null)
const styleSnapshot = ref<UseCaseStyle | null>(null)
const styleDialogVisible = ref(false)
const quickFillVisible = ref(false)
const quickFillText = ref('')
const previewEl = ref<HTMLElement>()
const layoutRef = ref<InstanceType<typeof DiagramLayout>>()

let timer: number | undefined
let nodeId = 0
let relationId = 0
let draggingCaseName: string | null = null
let draggingActorIndex: number | null = null
let dragStartPoint = { x: 0, y: 0 }
let dragStartOffset = { x: 0, y: 0 }

const hasContent = computed(() => {
  return Boolean(
    systemName.value.trim() ||
    actors.value.some((actor) => actor.name.trim() || actor.useCases.some((item) => item.name.trim()))
  )
})

const editorToggleText = computed(() => activeEditorMode.value === 'cases' ? '关系连线' : '用例编辑')

const relationTypeOptions: Array<{ label: string; value: UseCaseRelationType }> = [
  { label: '关联', value: 'association' },
  { label: '包含', value: 'include' },
  { label: '扩展', value: 'extend' },
  { label: '泛化', value: 'generalization' },
  { label: '直线', value: 'line' },
  { label: '无', value: 'none' },
]

const relationNodeOptions = computed(() => {
  const options: Array<{ label: string; value: string }> = []
  actors.value.forEach((actor, actorIndex) => {
    const actorName = actor.name.trim() || `参与者${actorIndex + 1}`
    options.push({ label: `${actorName}（参与者）`, value: actorNodeValue(actor.id) })
    actor.useCases.forEach((useCase, caseIndex) => {
      const caseName = useCase.name.trim() || `用例${caseIndex + 1}`
      options.push({ label: `— ${caseName}`, value: caseNodeValue(useCase.id) })
    })
  })
  return options
})

watch([systemName, actors, relations, showBoundary, useCaseStyle], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(renderDiagram, 300)
}, { deep: true })

watch(activeEditorMode, (mode) => {
  if (mode === 'relations') ensureRelations()
})

watch(styleDraft, (draft) => {
  if (!styleDialogVisible.value || !draft?.realTimeRender) return
  useCaseStyle.value = normalizeUseCaseStyle(cloneUseCaseStyle(draft))
  saveCurrentStyle()
  window.clearTimeout(timer)
  timer = window.setTimeout(renderDiagram, 120)
}, { deep: true })

function createDefaultUseCaseStyle(): UseCaseStyle {
  return {
    realTimeRender: true,
    autoTextWidth: false,
    concentratedLines: true,
    boundaryContainsChildren: false,
    useCaseWidth: 150,
    useCaseHeight: 70,
    useCaseHorizontalGap: 250,
    useCaseVerticalGap: 100,
    actorHorizontalGap: 350,
    groupVerticalGap: 80,
    backgroundColor: '#ffffff',
    fontColor: '#000000',
    fontFamily: 'SimSun, 宋体, Times New Roman, serif',
    fontSize: 20,
    lineColor: '#000000',
    lineWidth: 1,
    useCaseFill: '#ffffff',
    actorColor: '#000000',
    textAlongLine: true,
    textBackground: '#ffffff',
    boundaryColor: '#000000',
    boundaryDashed: true,
    associationArrow: 'open',
    includeArrow: 'open',
    extendArrow: 'open',
    generalizationArrow: 'triangle',
    extendReverse: true,
    generalizationReverse: true,
  }
}

function normalizeUseCaseStyle(style: UseCaseStyle): UseCaseStyle {
  const defaults = createDefaultUseCaseStyle()
  return {
    ...defaults,
    ...style,
    useCaseWidth: Math.max(70, Math.min(320, style.useCaseWidth || defaults.useCaseWidth)),
    useCaseHeight: Math.max(34, Math.min(150, style.useCaseHeight || defaults.useCaseHeight)),
    useCaseHorizontalGap: Math.max(120, Math.min(520, style.useCaseHorizontalGap || defaults.useCaseHorizontalGap)),
    useCaseVerticalGap: Math.max(40, Math.min(220, style.useCaseVerticalGap || defaults.useCaseVerticalGap)),
    actorHorizontalGap: Math.max(180, Math.min(620, style.actorHorizontalGap || defaults.actorHorizontalGap)),
    groupVerticalGap: Math.max(30, Math.min(180, style.groupVerticalGap || defaults.groupVerticalGap)),
    fontSize: Math.max(10, Math.min(40, style.fontSize || defaults.fontSize)),
    lineWidth: Math.max(0.5, Math.min(8, style.lineWidth || defaults.lineWidth)),
  }
}

function cloneUseCaseStyle(style: UseCaseStyle): UseCaseStyle {
  return JSON.parse(JSON.stringify(style))
}

function saveCurrentStyle() {
  localStorage.setItem(USECASE_STYLE_STORAGE_KEY, JSON.stringify(useCaseStyle.value))
}

function loadStoredStyle() {
  const stored = localStorage.getItem(USECASE_STYLE_STORAGE_KEY)
  if (!stored) return
  try {
    useCaseStyle.value = normalizeUseCaseStyle({
      ...createDefaultUseCaseStyle(),
      ...JSON.parse(stored),
    })
  } catch {
    localStorage.removeItem(USECASE_STYLE_STORAGE_KEY)
  }
}

function createUseCase(name = ''): UseCaseItem {
  return { id: ++nodeId, name, offsetX: 0, offsetY: 0 }
}

function createActor(name = '', useCases: string[] = []): ActorItem {
  return {
    id: ++nodeId,
    name,
    offsetX: 0,
    offsetY: 0,
    useCases: useCases.map((item) => createUseCase(item)),
  }
}

function actorNodeValue(id: number) {
  return `actor:${id}`
}

function caseNodeValue(id: number) {
  return `case:${id}`
}

function findFirstUseCase() {
  for (const actor of actors.value) {
    if (actor.useCases[0]) return actor.useCases[0]
  }
  return null
}

function addActor() {
  actors.value.push(createActor(`参与者${actors.value.length + 1}`, ['用例1', '用例2']))
}

function removeActor(index: number) {
  actors.value.splice(index, 1)
  cleanupRelations()
}

function addUseCase(actorIndex: number, insertIndex?: number) {
  const actor = actors.value[actorIndex]
  if (!actor) return
  const item = createUseCase(`用例${actor.useCases.length + 1}`)
  if (typeof insertIndex === 'number') {
    actor.useCases.splice(insertIndex, 0, item)
  } else {
    actor.useCases.push(item)
  }
}

function removeUseCase(actorIndex: number, caseIndex: number) {
  const actor = actors.value[actorIndex]
  if (!actor) return
  actor.useCases.splice(caseIndex, 1)
  cleanupRelations()
}

function toggleEditorMode() {
  activeEditorMode.value = activeEditorMode.value === 'cases' ? 'relations' : 'cases'
  if (activeEditorMode.value === 'relations') ensureRelations()
}

function openAiGenerate() {
  ElMessage.info('AI生成功能待接入')
}

function generateUseCaseDiagram() {
  renderDiagram()
  ElMessage.success('已生成用例图')
}

function defaultRelationFrom() {
  return actors.value[0] ? actorNodeValue(actors.value[0].id) : ''
}

function defaultRelationTo() {
  const firstCase = findFirstUseCase()
  return firstCase ? caseNodeValue(firstCase.id) : ''
}

function addRelation() {
  relations.value.push({
    id: ++relationId,
    from: defaultRelationFrom(),
    to: defaultRelationTo(),
    type: 'association',
  })
}

function removeRelation(index: number) {
  relations.value.splice(index, 1)
}

function ensureRelations() {
  if (relations.value.length || !actors.value.length) return
  syncDefaultRelations()
}

function syncDefaultRelations() {
  relations.value = []
  actors.value.forEach((actor) => {
    actor.useCases.forEach((useCase) => {
      relations.value.push({
        id: ++relationId,
        from: actorNodeValue(actor.id),
        to: caseNodeValue(useCase.id),
        type: 'association',
      })
    })
  })
}

function cleanupRelations() {
  const validValues = new Set(relationNodeOptions.value.map((option) => option.value))
  relations.value = relations.value.filter((relation) => (
    validValues.has(relation.from) && validValues.has(relation.to)
  ))
}

function openStyleDialog() {
  styleSnapshot.value = cloneUseCaseStyle(useCaseStyle.value)
  styleDraft.value = cloneUseCaseStyle(useCaseStyle.value)
  styleDialogVisible.value = true
}

function applyStyleDialog() {
  if (!styleDraft.value) return
  useCaseStyle.value = normalizeUseCaseStyle(cloneUseCaseStyle(styleDraft.value))
  saveCurrentStyle()
  styleSnapshot.value = null
  styleDialogVisible.value = false
  nextTick(renderDiagram)
}

function cancelStyleDialog() {
  if (styleSnapshot.value) {
    useCaseStyle.value = cloneUseCaseStyle(styleSnapshot.value)
  }
  styleDialogVisible.value = false
  styleDraft.value = null
  styleSnapshot.value = null
  nextTick(renderDiagram)
}

function restoreDefaultStyle() {
  styleDraft.value = createDefaultUseCaseStyle()
  useCaseStyle.value = normalizeUseCaseStyle(cloneUseCaseStyle(styleDraft.value))
  saveCurrentStyle()
  nextTick(renderDiagram)
}

function openQuickFill() {
  const lines = [systemName.value || '系统']
  actors.value.forEach((actor) => {
    const useCases = actor.useCases.map((item) => item.name || '用例').join('，')
    lines.push(`${actor.name || '参与者'}：${useCases}`)
  })
  quickFillText.value = lines.join('\n')
  quickFillVisible.value = true
}

function applyQuickFill() {
  const parsed = parseQuickFillText(quickFillText.value)
  systemName.value = parsed.systemName
  actors.value = parsed.actors
  relations.value = []
  quickFillVisible.value = false
  nextTick(renderDiagram)
}

function parseQuickFillText(text: string): { systemName: string; actors: ActorItem[] } {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return { systemName: '', actors: [] }

  const first = lines[0]
  const firstIdx = first.includes('：') ? first.indexOf('：') : first.indexOf(':')
  const sys = firstIdx !== -1 && /系统|名称/.test(first.substring(0, firstIdx))
    ? first.substring(firstIdx + 1).trim() || '系统'
    : first

  const parsedActors = lines.slice(1).map((line, index) => {
    const idx = line.includes('：') ? line.indexOf('：') : line.indexOf(':')
    if (idx === -1) return createActor(line || `参与者${index + 1}`, [])
    const actor = line.substring(0, idx).trim() || `参与者${index + 1}`
    const useCases = line.substring(idx + 1).split(/[,，]/).map((item) => item.trim()).filter(Boolean)
    return createActor(actor, useCases)
  })

  return { systemName: sys, actors: parsedActors }
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function resolveRelationNode(value: string): { kind: UseCaseRelationNodeKind; name: string } | null {
  const [kind, rawId] = value.split(':')
  const id = Number(rawId)
  if (!Number.isFinite(id)) return null

  if (kind === 'actor') {
    const actorIndex = actors.value.findIndex((actor) => actor.id === id)
    const actor = actors.value[actorIndex]
    if (!actor) return null
    return {
      kind: 'actor',
      name: actor.name.trim() || `参与者${actorIndex + 1}`,
    }
  }

  if (kind === 'case') {
    for (const actor of actors.value) {
      const caseIndex = actor.useCases.findIndex((item) => item.id === id)
      const useCase = actor.useCases[caseIndex]
      if (useCase) {
        return {
          kind: 'case',
          name: useCase.name.trim() || `用例${caseIndex + 1}`,
        }
      }
    }
  }

  return null
}

function getRenderRelations(actorCases: Map<string, string[]>): RenderRelation[] {
  const explicitRelations = relations.value
    .map((relation) => {
      const from = resolveRelationNode(relation.from)
      const to = resolveRelationNode(relation.to)
      if (!from || !to || (from.kind === to.kind && from.name === to.name)) return null
      return {
        fromKind: from.kind,
        fromName: from.name,
        toKind: to.kind,
        toName: to.name,
        type: relation.type,
      } satisfies RenderRelation
    })
    .filter((relation): relation is RenderRelation => Boolean(relation))

  if (explicitRelations.length) return explicitRelations

  const fallbackRelations: RenderRelation[] = []
  actorCases.forEach((caseNames, actorName) => {
    caseNames.forEach((caseName) => {
      fallbackRelations.push({
        fromKind: 'actor',
        fromName: actorName,
        toKind: 'case',
        toName: caseName,
        type: 'association',
      })
    })
  })
  return fallbackRelations
}

function getRenderData() {
  const renderActors = actors.value.map((actor, index) => ({
    name: actor.name.trim() || `参与者${index + 1}`,
    offsetX: actor.offsetX || 0,
    offsetY: actor.offsetY || 0,
  }))
  const actorCases = new Map<string, string[]>()
  const uniqueCases = new Map<string, RenderUseCase>()

  actors.value.forEach((actor, actorIndex) => {
    const actorName = actor.name.trim() || `参与者${actorIndex + 1}`
    const cases = actor.useCases.map((item, caseIndex) => item.name.trim() || `用例${caseIndex + 1}`)
    actorCases.set(actorName, cases)
    cases.forEach((caseName, caseIndex) => {
      const source = actor.useCases[caseIndex]
      if (!uniqueCases.has(caseName)) {
        uniqueCases.set(caseName, {
          name: caseName,
          offsetX: source?.offsetX || 0,
          offsetY: source?.offsetY || 0,
        })
      }
    })
  })

  return {
    sysName: systemName.value.trim() || '系统',
    renderActors,
    actorCases,
    uniqueCases: [...uniqueCases.values()],
  }
}

function renderDiagram() {
  if (!previewEl.value) return
  if (!hasContent.value) {
    previewEl.value.innerHTML = ''
    return
  }

  const { sysName, renderActors, actorCases, uniqueCases } = getRenderData()
  previewEl.value.innerHTML = generateSVG(sysName, renderActors, uniqueCases, getRenderRelations(actorCases))
  bindUseCaseDrag()
}

function bindUseCaseDrag() {
  if (!previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  if (!svg) return

  previewEl.value.querySelectorAll<SVGGElement>('.draggable-use-case').forEach((group) => {
    group.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()

      const caseName = group.dataset.caseName
      if (!caseName) return

      const source = findUseCasesByRenderName(caseName)[0]
      draggingCaseName = caseName
      dragStartPoint = getSvgPoint(event, svg)
      dragStartOffset = {
        x: source?.offsetX || 0,
        y: source?.offsetY || 0,
      }

      window.addEventListener('pointermove', handleUseCaseDrag)
      window.addEventListener('pointerup', stopUseCaseDrag, { once: true })
      window.addEventListener('pointercancel', stopUseCaseDrag, { once: true })
    })
  })

  previewEl.value.querySelectorAll<SVGGElement>('.draggable-actor').forEach((group) => {
    group.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()

      const index = Number(group.dataset.actorIndex)
      const actor = actors.value[index]
      if (!Number.isFinite(index) || !actor) return

      draggingActorIndex = index
      dragStartPoint = getSvgPoint(event, svg)
      dragStartOffset = {
        x: actor.offsetX || 0,
        y: actor.offsetY || 0,
      }

      window.addEventListener('pointermove', handleActorDrag)
      window.addEventListener('pointerup', stopActorDrag, { once: true })
      window.addEventListener('pointercancel', stopActorDrag, { once: true })
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

function findUseCasesByRenderName(caseName: string) {
  const matches: UseCaseItem[] = []
  actors.value.forEach((actor) => {
    actor.useCases.forEach((item, index) => {
      const renderName = item.name.trim() || `用例${index + 1}`
      if (renderName === caseName) matches.push(item)
    })
  })
  return matches
}

function handleUseCaseDrag(event: PointerEvent) {
  if (!draggingCaseName || !previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  if (!svg) return

  event.preventDefault()
  const current = getSvgPoint(event, svg)
  const nextOffset = {
    x: Math.round(dragStartOffset.x + current.x - dragStartPoint.x),
    y: Math.round(dragStartOffset.y + current.y - dragStartPoint.y),
  }

  findUseCasesByRenderName(draggingCaseName).forEach((item) => {
    item.offsetX = nextOffset.x
    item.offsetY = nextOffset.y
  })
  window.clearTimeout(timer)
  renderDiagram()
}

function stopUseCaseDrag() {
  draggingCaseName = null
  window.removeEventListener('pointermove', handleUseCaseDrag)
}

function handleActorDrag(event: PointerEvent) {
  if (draggingActorIndex === null || !previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  const actor = actors.value[draggingActorIndex]
  if (!svg || !actor) return

  event.preventDefault()
  const current = getSvgPoint(event, svg)
  actor.offsetX = Math.round(dragStartOffset.x + current.x - dragStartPoint.x)
  actor.offsetY = Math.round(dragStartOffset.y + current.y - dragStartPoint.y)
  window.clearTimeout(timer)
  renderDiagram()
}

function stopActorDrag() {
  draggingActorIndex = null
  window.removeEventListener('pointermove', handleActorDrag)
}

function useCaseArrowMarker(id: string, arrowStyle: UseCaseArrowStyle | UseCaseGeneralizationArrowStyle, color: string) {
  if (arrowStyle === 'none') return ''
  if (arrowStyle === 'filled') {
    return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/>
    </marker>`
  }
  if (arrowStyle === 'triangle') {
    return `<marker id="${id}" viewBox="0 0 12 10" refX="11" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
      <path d="M 1 1 L 11 5 L 1 9 z" fill="#fff" stroke="${color}" stroke-width="1.3" stroke-linejoin="round"/>
    </marker>`
  }
  return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
    <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </marker>`
}

function arrowMarkerAttr(id: string, arrowStyle: UseCaseArrowStyle | UseCaseGeneralizationArrowStyle) {
  return arrowStyle === 'none' ? '' : ` marker-end="url(#${id})"`
}

function useCaseSvgDefs() {
  const style = useCaseStyle.value
  const boundaryDash = style.boundaryDashed ? 'stroke-dasharray: 6 4;' : ''
  return `<defs>
    ${useCaseArrowMarker('usecase-association-arrow', style.associationArrow, style.lineColor)}
    ${useCaseArrowMarker('usecase-include-arrow', style.includeArrow, style.lineColor)}
    ${useCaseArrowMarker('usecase-extend-arrow', style.extendArrow, style.lineColor)}
    ${useCaseArrowMarker('usecase-generalization-arrow', style.generalizationArrow, style.lineColor)}
    <style>
      .uc-system-boundary { fill: none; stroke: ${style.boundaryColor}; stroke-width: ${style.lineWidth}; ${boundaryDash} }
      .uc-system-label { font-family: ${style.fontFamily}; fill: ${style.fontColor}; font-size: ${style.fontSize}px; text-anchor: middle; dominant-baseline: central; }
      .uc-node-ellipse { fill: ${style.useCaseFill}; stroke: ${style.lineColor}; stroke-width: ${style.lineWidth}; }
      .uc-node-label { font-family: ${style.fontFamily}; fill: ${style.fontColor}; text-anchor: middle; dominant-baseline: central; font-size: ${style.fontSize}px; }
      .uc-edge-line { stroke: ${style.lineColor}; stroke-width: ${style.lineWidth}; fill: none; stroke-linecap: round; }
      .uc-edge-dashed { stroke-dasharray: 7 5; }
      .uc-actor-line { stroke: ${style.actorColor}; stroke-width: ${Math.max(1, style.lineWidth * 1.4)}; fill: none; stroke-linecap: round; stroke-linejoin: round; }
      .uc-actor-text { font-family: ${style.fontFamily}; fill: ${style.fontColor}; font-size: ${style.fontSize}px; text-anchor: middle; }
      .uc-edge-label-bg { fill: ${style.textBackground}; stroke: none; }
      .uc-edge-label { font-family: ${style.fontFamily}; fill: ${style.fontColor}; font-size: ${Math.max(10, style.fontSize - 2)}px; text-anchor: middle; dominant-baseline: central; }
    </style>
  </defs>`
}

function useCaseBoxWidth(name: string) {
  const style = useCaseStyle.value
  return style.autoTextWidth
    ? Math.max(style.useCaseWidth, textWidth(name, style.fontSize) + 58)
    : style.useCaseWidth
}

function useCaseLabelSvg(name: string, cx: number, cy: number, width: number) {
  const style = useCaseStyle.value
  const maxTextWidth = Math.max(48, width - 34)
  const lines: string[] = []
  let current = ''
  for (const char of name) {
    const next = `${current}${char}`
    if (current && textWidth(next, style.fontSize) > maxTextWidth) {
      lines.push(current)
      current = char
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  const safeLines = lines.length ? lines : ['']
  const lineHeight = Math.ceil(style.fontSize * 1.16)
  const firstY = cy - ((safeLines.length - 1) * lineHeight) / 2
  const label = safeLines.map((line, index) => (
    `<tspan x="${cx}" y="${firstY + index * lineHeight}">${esc(line)}</tspan>`
  )).join('')
  return `<text class="uc-node-label">${label}</text>`
}

function generateSVG(
  sysName: string,
  renderActors: RenderActor[],
  uniqueCases: RenderUseCase[],
  renderRelations: RenderRelation[]
): string {
  const style = useCaseStyle.value
  const dragMargin = 140
  const actorBaseX = dragMargin + 72
  const sysY = 36
  const baseBoundaryX = actorBaseX + style.actorHorizontalGap
  const baseBoundaryY = sysY + dragMargin
  const sysPadX = 64
  const sysPadTop = 76
  const sysPadBottom = 54
  const columnCount = uniqueCases.length > 6 ? 2 : 1
  const rowCount = Math.max(1, Math.ceil(Math.max(1, uniqueCases.length) / columnCount))
  const caseSizes = uniqueCases.map((item) => ({
    name: item.name,
    w: useCaseBoxWidth(item.name),
    h: style.useCaseHeight,
  }))
  const maxCaseW = Math.max(style.useCaseWidth, ...caseSizes.map((item) => item.w), 1)
  const maxCaseH = Math.max(style.useCaseHeight, ...caseSizes.map((item) => item.h), 1)
  const caseAreaW = columnCount * maxCaseW + Math.max(0, columnCount - 1) * style.useCaseHorizontalGap
  const sysW = Math.max(330, caseAreaW + sysPadX * 2)
  const sysH = Math.max(
    260,
    sysPadTop + rowCount * maxCaseH + Math.max(0, rowCount - 1) * style.useCaseVerticalGap + sysPadBottom
  )
  const baseBoundaryRight = baseBoundaryX + sysW
  const baseBoundaryBottom = baseBoundaryY + sysH
  const caseLayouts = uniqueCases.map((item, index) => {
    const col = index % columnCount
    const row = Math.floor(index / columnCount)
    const size = caseSizes[index]
    const colOffset = (col - (columnCount - 1) / 2) * (maxCaseW + style.useCaseHorizontalGap)
    return {
      name: item.name,
      cx: baseBoundaryX + sysW / 2 + colOffset + item.offsetX,
      cy: baseBoundaryY + sysPadTop + maxCaseH / 2 + row * (maxCaseH + style.useCaseVerticalGap) + item.offsetY,
      w: size?.w || style.useCaseWidth,
      h: size?.h || style.useCaseHeight,
    }
  })
  const actorLayouts = renderActors.map((actor, index) => ({
    name: actor.name,
    ax: actorBaseX + actor.offsetX,
    ay: baseBoundaryY + 86 + index * (88 + style.groupVerticalGap) + actor.offsetY,
    index,
  }))
  const caseLeft = caseLayouts.length ? Math.min(...caseLayouts.map((item) => item.cx - item.w / 2)) : baseBoundaryX
  const caseRight = caseLayouts.length ? Math.max(...caseLayouts.map((item) => item.cx + item.w / 2)) : baseBoundaryRight
  const caseTop = caseLayouts.length ? Math.min(...caseLayouts.map((item) => item.cy - item.h / 2)) : baseBoundaryY
  const caseBottom = caseLayouts.length ? Math.max(...caseLayouts.map((item) => item.cy + item.h / 2)) : baseBoundaryBottom
  const boundaryPadX = 38
  const boundaryPadTop = 52
  const boundaryPadBottom = 42
  const boundaryX = style.boundaryContainsChildren ? Math.min(baseBoundaryX, caseLeft - boundaryPadX) : baseBoundaryX
  const boundaryY = style.boundaryContainsChildren ? Math.min(baseBoundaryY, caseTop - boundaryPadTop) : baseBoundaryY
  const boundaryRight = style.boundaryContainsChildren ? Math.max(baseBoundaryRight, caseRight + boundaryPadX) : baseBoundaryRight
  const boundaryBottom = style.boundaryContainsChildren ? Math.max(baseBoundaryBottom, caseBottom + boundaryPadBottom) : baseBoundaryBottom
  const boundaryW = boundaryRight - boundaryX
  const boundaryH = boundaryBottom - boundaryY
  const actorRight = actorLayouts.length ? Math.max(...actorLayouts.map((item) => item.ax + 70)) : 0
  const actorBottom = actorLayouts.length ? Math.max(...actorLayouts.map((item) => item.ay + 112)) : 0
  const contentLeft = Math.min(boundaryX, caseLeft, actorLayouts.length ? Math.min(...actorLayouts.map((item) => item.ax - 70)) : boundaryX)
  const contentRight = Math.max(boundaryRight, caseRight + 64, actorRight + 64)
  const contentBottom = Math.max(boundaryBottom + 40, caseBottom + 64, actorBottom + 30)
  const totalW = Math.max(720, contentRight + Math.max(40, dragMargin - Math.min(contentLeft, dragMargin)))
  const totalH = Math.max(460, contentBottom)
  const svgStart = buildSvg(totalW, totalH, '')
  let content = ''

  content += useCaseSvgDefs()
  content += `<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="${style.backgroundColor}"/>`
  if (showBoundary.value) {
    content += `<rect class="uc-system-boundary" x="${boundaryX}" y="${boundaryY}" width="${boundaryW}" height="${boundaryH}" rx="0" />`
    content += `<text class="uc-system-label" x="${boundaryX + boundaryW / 2}" y="${boundaryY + Math.max(24, style.fontSize * 1.2)}">${esc(sysName)}</text>`
  }

  const casePositions = new Map<string, UseCaseBox>()
  caseLayouts.forEach((item) => {
    const { cx, cy } = item
    content += `<g class="draggable-use-case" data-case-name="${esc(item.name)}" style="cursor:move;">`
    content += `<ellipse class="uc-node-ellipse" cx="${cx}" cy="${cy}" rx="${item.w / 2}" ry="${item.h / 2}" />`
    content += useCaseLabelSvg(item.name, cx, cy, item.w)
    content += `</g>`
    casePositions.set(item.name, { cx, cy, w: item.w, h: item.h })
  })

  const actorPositions = new Map<string, { ax: number; ay: number }>()

  actorLayouts.forEach((actor) => {
    const { ax, ay } = actor
    actorPositions.set(actor.name, { ax, ay })
    content += `<g class="draggable-actor" data-actor-index="${actor.index}" style="cursor:move;">`
    content += `<circle class="uc-actor-line" cx="${ax}" cy="${ay - 28}" r="16"/>`
    content += `<line class="uc-actor-line" x1="${ax}" y1="${ay - 12}" x2="${ax}" y2="${ay + 36}"/>`
    content += `<line class="uc-actor-line" x1="${ax - 31}" y1="${ay + 6}" x2="${ax + 31}" y2="${ay + 6}"/>`
    content += `<line class="uc-actor-line" x1="${ax}" y1="${ay + 36}" x2="${ax - 24}" y2="${ay + 72}"/>`
    content += `<line class="uc-actor-line" x1="${ax}" y1="${ay + 36}" x2="${ax + 24}" y2="${ay + 72}"/>`
    content += `<text class="uc-actor-text" x="${ax}" y="${ay + 96}">${esc(actor.name)}</text>`
    content += `</g>`
  })

  renderRelations.forEach((relation) => {
    if (relation.type === 'none') return
    const sourceNode = getRelationNodeBox(relation.fromKind, relation.fromName, actorPositions, casePositions)
    const targetNode = getRelationNodeBox(relation.toKind, relation.toName, actorPositions, casePositions)
    if (!sourceNode || !targetNode) return

    const reverseArrow = (
      (relation.type === 'extend' && style.extendReverse) ||
      (relation.type === 'generalization' && style.generalizationReverse)
    )
    const lineSource = reverseArrow ? targetNode : sourceNode
    const lineTarget = reverseArrow ? sourceNode : targetNode
    const start = relationAnchorPoint(lineSource, lineTarget.cx, lineTarget.cy)
    const target = relationAnchorPoint(lineTarget, lineSource.cx, lineSource.cy)
    const label = relationLineLabel(relation.type)
    const markerId = relationMarkerId(relation.type)
    const arrowStyle = relationArrowStyle(relation.type)
    const dashedClass = relation.type === 'include' || relation.type === 'extend' ? ' uc-edge-dashed' : ''

    content += `<line class="uc-edge-line${dashedClass}" x1="${start.x}" y1="${start.y}" x2="${target.x}" y2="${target.y}"${arrowMarkerAttr(markerId, arrowStyle)} />`
    if (label) {
      const midX = (start.x + target.x) / 2
      const midY = (start.y + target.y) / 2
      const labelW = textWidth(label, Math.max(10, style.fontSize - 2)) + 10
      content += `<rect class="uc-edge-label-bg" x="${midX - labelW / 2}" y="${midY - 10}" width="${labelW}" height="20" rx="2"/>`
      content += `<text class="uc-edge-label" x="${midX}" y="${midY}">${esc(label)}</text>`
    }
  })

  return svgStart + content + '</svg>'
}

function getRelationNodeBox(
  kind: UseCaseRelationNodeKind,
  name: string,
  actorPositions: Map<string, { ax: number; ay: number }>,
  casePositions: Map<string, UseCaseBox>
): RelationNodeBox | null {
  if (kind === 'actor') {
    const actor = actorPositions.get(name)
    if (!actor) return null
    return {
      kind,
      name,
      cx: actor.ax,
      cy: actor.ay + 10,
      ax: actor.ax,
      ay: actor.ay,
    }
  }

  const box = casePositions.get(name)
  if (!box) return null
  return {
    kind,
    name,
    cx: box.cx,
    cy: box.cy,
    box,
  }
}

function relationAnchorPoint(node: RelationNodeBox, targetX: number, targetY: number) {
  if (node.kind === 'actor' && typeof node.ax === 'number' && typeof node.ay === 'number') {
    return actorAnchorPoint(node.ax, node.ay, targetX, targetY)
  }
  if (node.box) return useCaseAnchorPoint(node.box, targetX, targetY)
  return { x: node.cx, y: node.cy }
}

function relationMarkerId(type: UseCaseRelationType) {
  if (type === 'include') return 'usecase-include-arrow'
  if (type === 'extend') return 'usecase-extend-arrow'
  if (type === 'generalization') return 'usecase-generalization-arrow'
  return 'usecase-association-arrow'
}

function relationArrowStyle(type: UseCaseRelationType): UseCaseArrowStyle | UseCaseGeneralizationArrowStyle {
  const style = useCaseStyle.value
  if (type === 'include') return style.includeArrow
  if (type === 'extend') return style.extendArrow
  if (type === 'generalization') return style.generalizationArrow
  if (type === 'line' || type === 'none') return 'none'
  return style.associationArrow
}

function relationLineLabel(type: UseCaseRelationType) {
  if (type === 'include') return '<<include>>'
  if (type === 'extend') return '<<extend>>'
  return ''
}

function chooseAnchorSide(cx: number, cy: number, targetX: number, targetY: number): UseCaseAnchorSide {
  const dx = targetX - cx
  const dy = targetY - cy
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

function actorAnchorPoint(ax: number, ay: number, targetX: number, targetY: number) {
  const side = chooseAnchorSide(ax, ay + 10, targetX, targetY)
  const gap = 10
  if (side === 'top') return { x: ax, y: ay - 44 - gap }
  if (side === 'right') return { x: ax + 31 + gap, y: ay + 6 }
  if (side === 'bottom') return { x: ax, y: ay + 72 + gap }
  return { x: ax - 31 - gap, y: ay + 6 }
}

function useCaseAnchorPoint(box: UseCaseBox, fromX: number, fromY: number) {
  const side = chooseAnchorSide(box.cx, box.cy, fromX, fromY)
  if (side === 'top') return { x: box.cx, y: box.cy - box.h / 2 }
  if (side === 'right') return { x: box.cx + box.w / 2, y: box.cy }
  if (side === 'bottom') return { x: box.cx, y: box.cy + box.h / 2 }
  return { x: box.cx - box.w / 2, y: box.cy }
}

function loadExample() {
  systemName.value = '系统'
  actors.value = [
    createActor('参与者', ['用例1', '用例2']),
  ]
  relations.value = []
  activeEditorMode.value = 'cases'
}

function clearAll() {
  systemName.value = ''
  actors.value = []
  relations.value = []
  if (previewEl.value) previewEl.value.innerHTML = ''
}

async function exportPng() {
  if (!previewEl.value) return
  await exportToPng(previewEl.value, '用例图')
  ElMessage.success('PNG导出成功')
}

async function exportSvg() {
  if (!previewEl.value) return
  await exportToSvg(previewEl.value, '用例图')
  ElMessage.success('SVG导出成功')
}

async function copySource() {
  const svg = previewEl.value?.innerHTML || ''
  await copyToClipboard(svg)
  ElMessage.success('SVG源码已复制')
}

async function openDrawIo() {
  const svg = previewEl.value?.innerHTML || ''
  if (svg) {
    await copyToClipboard(svg)
  }
  window.open('https://app.diagrams.net/', '_blank')
  ElMessage.success('已复制SVG源码，可粘贴到 Draw.io 中编辑')
}

loadStoredStyle()

onMounted(() => {
  const cached = readDiagramStorage('diagram:usecase')
  if (cached) {
    try {
      const data = JSON.parse(cached)
      if (data.systemName) systemName.value = data.systemName
      if (data.actors) {
        let nextId = Date.now()
        actors.value = data.actors.map((a: any) => ({
          id: nextId++,
          name: a.name,
          useCases: (a.useCases || []).map((uc: any) => ({
            id: nextId++,
            name: typeof uc === 'string' ? uc : uc.name,
            offsetX: 0,
            offsetY: 0,
          })),
          offsetX: 0,
          offsetY: 0,
        }))
      }
      relations.value = []
      nextTick(renderDiagram)
      return
    } catch { /* ignore */ }
  }
  loadExample()
  nextTick(renderDiagram)
})
</script>

<style scoped>
.usecase-editor {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.usecase-editor-topbar {
  position: sticky;
  top: 0;
  z-index: 8;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  padding: 12px;
  border: 1px solid #d8e6f7;
  border-radius: 8px;
  background: linear-gradient(180deg, #f7fbff 0%, #eef6ff 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.usecase-mode-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 32px;
  min-width: 0;
}

.usecase-toolbar-label {
  flex: 0 0 auto;
  color: var(--t3);
  font-size: 12px;
  font-weight: 600;
}

.usecase-input-actions {
  display: grid;
  grid-template-columns: minmax(74px, 0.95fr) minmax(82px, 1fr) minmax(92px, 1.15fr) minmax(98px, 1.15fr);
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid rgba(64, 158, 255, 0.14);
}

.usecase-input-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.usecase-input-actions :deep(.el-button) {
  width: 100%;
  min-width: 0;
  padding-left: 10px;
  padding-right: 10px;
  font-weight: 600;
}

.usecase-input-actions :deep(.usecase-action-button) {
  border: 1px solid #c8dcf4;
  background: #fff;
  color: #315b86;
  box-shadow: 0 2px 6px rgba(42, 91, 142, 0.06);
}

.usecase-input-actions :deep(.usecase-action-button:hover) {
  border-color: #409eff;
  background: #eef6ff;
  color: #1677d2;
}

.usecase-input-actions :deep(.usecase-action-button.strong) {
  border-color: #9dccff;
  background: #eaf4ff;
  color: #1f73c9;
}

.usecase-input-actions :deep(.usecase-action-button.success) {
  border-color: #b8e3a9;
  background: #f0faeb;
  color: #48a723;
}

.usecase-input-actions :deep(.usecase-generate-button) {
  --el-button-bg-color: #409eff;
  --el-button-border-color: #409eff;
  --el-button-text-color: #fff;
  --el-button-hover-bg-color: #2f8df0;
  --el-button-hover-border-color: #2f8df0;
  --el-button-hover-text-color: #fff;
  --el-button-active-bg-color: #247fe0;
  --el-button-active-border-color: #247fe0;
  width: 100%;
  min-width: 0;
  height: 32px;
  font-weight: 700;
  border-color: #409eff !important;
  background: #409eff !important;
  color: #fff !important;
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.24);
}

.usecase-input-actions :deep(.usecase-generate-button:hover),
.usecase-input-actions :deep(.usecase-generate-button:focus) {
  border-color: #2f8df0 !important;
  background: #2f8df0 !important;
  color: #fff !important;
}

.usecase-input-actions :deep(.usecase-generate-button.is-disabled) {
  --el-button-disabled-bg-color: #d8ebff;
  --el-button-disabled-border-color: #bfdcff;
  --el-button-disabled-text-color: #fff;
  border-color: #bfdcff !important;
  background: #d8ebff !important;
  color: #fff !important;
  box-shadow: none;
}

.usecase-editor-panel {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
}

.editor-row.usecase-actor-row {
  grid-template-columns: 22px minmax(120px, 1fr) auto minmax(86px, 120px) 28px 28px;
}

.usecase-boundary-check {
  min-width: 54px;
  justify-content: center;
}

.usecase-boundary-check :deep(.el-checkbox__label) {
  padding-left: 4px;
  color: #409eff;
  font-size: 12px;
  font-weight: 600;
}

.usecase-system-input :deep(.el-input__wrapper) {
  min-height: 30px;
}

.usecase-relation-section {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 0;
}

.usecase-relation-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.usecase-relation-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.usecase-relation-help {
  padding: 10px 12px 0;
  color: var(--t3);
  font-size: 12px;
  line-height: 1.6;
}

.usecase-relation-row {
  display: grid;
  grid-template-columns: 22px minmax(90px, 1fr) minmax(72px, 0.72fr) 18px minmax(90px, 1fr) 28px;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 5px 8px;
  border: var(--border-subtle);
  border-radius: var(--r-xs);
  background: rgba(255, 255, 255, 0.55);
  margin-bottom: 6px;
}

.usecase-relation-row :deep(.el-select) {
  width: 100%;
}

.usecase-relation-row .arrow-label {
  text-align: center;
  color: var(--t4);
  font-size: 13px;
}

.usecase-empty-state {
  padding: 16px 10px;
  border: 1px dashed rgba(0, 0, 0, 0.12);
  border-radius: var(--r-xs);
  color: var(--t3);
  text-align: center;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.35);
}

:global(.usecase-style-dialog.el-dialog) {
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

:global(.usecase-style-dialog .el-dialog__header) {
  flex: 0 0 auto;
  padding: 18px 22px 12px !important;
  margin-right: 0 !important;
  background: #fff !important;
}

:global(.usecase-style-dialog .el-dialog__title) {
  color: #1f2937 !important;
  font-size: 20px !important;
  font-weight: 500 !important;
}

:global(.usecase-style-dialog .el-dialog__body) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 4px 18px 8px 22px !important;
  background: #fff !important;
}

:global(.usecase-style-dialog .el-dialog__footer) {
  flex: 0 0 auto;
  padding: 10px 18px 16px !important;
  border-top: 1px solid #edf1f6 !important;
  background: #fff !important;
}

.usecase-style-panel {
  max-height: calc(100vh - 158px);
  overflow: auto;
  padding: 0 10px 4px 0;
  background: #fff;
}

.usecase-style-panel::-webkit-scrollbar {
  width: 6px;
}

.usecase-style-panel::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #d0d7e2;
}

.usecase-style-switches {
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

.style-grid :deep(.el-switch__label) {
  color: #409eff;
}

@media (max-width: 620px) {
  .style-switch-row,
  .style-grid {
    grid-template-columns: 88px minmax(0, 1fr);
  }
}
</style>
