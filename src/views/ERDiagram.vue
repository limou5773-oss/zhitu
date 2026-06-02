<template>
  <DiagramLayout
    title="ER图"
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
      <input
        ref="sqlFileInput"
        type="file"
        accept=".sql,.txt,text/plain"
        style="display:none"
        @change="handleSqlFileChange"
      />
      <div class="structured-editor er-editor">
        <div class="editor-hint">导入 SQL 后可切换到手动输入继续微调，右侧实时预览 ER 图</div>

        <div class="er-input-panels">
          <div v-if="inputMode === 'sql'" class="er-input-panel">
            <div class="editor-section er-sql-section">
              <div class="editor-section-title">
                <span>SQL 语句</span>
              </div>
              <div class="sql-editor-panel">
                <el-input
                  v-model="sqlText"
                  type="textarea"
                  resize="none"
                  placeholder="请粘贴 CREATE TABLE 建表语句，或点击“导入 SQL”选择 .sql 文件"
                />
              </div>
            </div>
          </div>

          <div v-else class="er-input-panel">
            <div class="er-manual-editor">
              <el-tabs v-model="activeManualTab" type="card" class="er-manual-tabs-card">
                <el-tab-pane label="实体和属性" name="entities">
                  <div class="editor-section er-manual-panel">
                    <div class="er-manual-panel-head editor-section-title">
                      <span>实体和属性（{{ entities.length }}）</span>
                      <div class="er-manual-panel-actions">
                        <button class="editor-add" type="button" @click="optimizeEntityText">AI文本优化</button>
                        <button class="editor-add" type="button" @click="addEntity()">+ 添加实体</button>
                      </div>
                    </div>
                    <div class="er-entity-list">
                      <div
                        v-for="(entity, entityIndex) in entities"
                        :key="entity.id"
                        class="er-entity-block"
                        :class="{ collapsed: isEntityCollapsed(entity, entityIndex) }"
                      >
                        <div class="er-entity-line">
                          <button class="er-collapse-toggle" type="button" @click="toggleEntityCollapse(entity, entityIndex)">
                            {{ isEntityCollapsed(entity, entityIndex) ? '›' : '⌄' }}
                          </button>
                          <el-input v-model="entity.name" :placeholder="`实体${entityIndex + 1}`" />
                          <button class="er-inline-action" type="button" title="添加属性" @click="addAttribute(entityIndex)">+</button>
                          <button class="er-delete-action" type="button" title="删除实体" @click="removeEntity(entityIndex)">×</button>
                        </div>
                        <div v-if="!isEntityCollapsed(entity, entityIndex)" class="er-attribute-list">
                          <div
                            v-for="(attr, attrIndex) in entity.attributes"
                            :key="attr.id"
                            class="er-attribute-line"
                          >
                            <button
                              class="er-pk-badge"
                              :class="{ active: attr.isPK }"
                              type="button"
                              title="切换主键"
                              @click="attr.isPK = !attr.isPK"
                            >{{ attr.isPK ? '主键' : 'PK' }}</button>
                            <el-input v-model="attr.name" :placeholder="`属性${attrIndex + 1}`" />
                            <button class="er-delete-action" type="button" title="删除属性" @click="removeAttribute(entityIndex, attrIndex)">×</button>
                          </div>
                        </div>
                      </div>
                      <button v-if="!entities.length" class="er-empty-add" type="button" @click="addEntity()">+ 添加第一个实体</button>
                    </div>
                  </div>
                </el-tab-pane>

                <el-tab-pane label="关联关系" name="relations">
                  <div class="editor-section er-manual-panel">
                    <div class="er-manual-panel-head editor-section-title">
                      <span>关联关系（{{ relationships.length }}）</span>
                      <button class="editor-add" type="button" @click="addRelationship()">+ 添加关系</button>
                    </div>
                    <div class="er-relation-list">
                      <div
                        v-for="(rel, index) in relationships"
                        :key="rel.id"
                        class="er-relation-line"
                      >
                        <el-input v-model="rel.from" placeholder="实体A" />
                        <el-select v-model="rel.cardinality">
                          <el-option label="1:1" value="1:1" />
                          <el-option label="1:N" value="1:N" />
                          <el-option label="N:1" value="N:1" />
                          <el-option label="M:N" value="M:N" />
                        </el-select>
                        <el-input v-model="rel.to" placeholder="实体B" />
                        <el-input v-model="rel.label" :placeholder="`关系${index + 1}`" />
                        <button class="er-delete-action" type="button" title="删除关系" @click="removeRelationship(index)">×</button>
                      </div>
                      <button v-if="!relationships.length" class="er-empty-add" type="button" @click="addRelationship()">+ 添加第一条关系</button>
                    </div>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #extraButtons>
      <el-button v-if="inputMode === 'sql'" @click="triggerSqlImport" size="default" text>
        <el-icon style="margin-right:4px;"><FolderOpened /></el-icon>导入SQL
      </el-button>
      <el-button v-else @click="fillManualExample" size="default" text>快速填写</el-button>
      <el-button
        @click="toggleInputMode"
        size="default"
        text
      >SQL切换</el-button>
    </template>

    <template #previewActions>
      <el-button size="small" type="success" plain @click="openThemeDialog">
        主题
      </el-button>
      <el-button size="small" plain @click="openStyleDialog">
        <el-icon style="margin-right:4px;"><Setting /></el-icon>修改样式
      </el-button>
      <el-button size="small" type="success" :disabled="!hasContent" @click="cycleLayout">
        <el-icon style="margin-right:4px;"><Grid /></el-icon>{{ layoutCycleButtonText }}
      </el-button>
      <el-button size="small" type="success" :disabled="!hasContent" @click="toggleAttributesVisible">
        {{ erStyle.showAttributes ? '隐藏属性' : '显示属性' }}
      </el-button>
      <el-dropdown split-button type="primary" size="small" :disabled="!hasContent" @click="exportPng">
        导出图片
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="openDrawIo">在 Draw.io 中编辑</el-dropdown-item>
            <el-dropdown-item @click="exportPng">导出 PNG</el-dropdown-item>
            <el-dropdown-item @click="exportSvg">导出 SVG</el-dropdown-item>
            <el-dropdown-item @click="copySource">复制源码</el-dropdown-item>
            <el-dropdown-item divided @click="openEntityVisibilityDialog">指定显示实体</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </template>

    <template #preview>
      <div v-if="!hasContent" class="diagram-placeholder">请添加实体、属性或关系</div>
      <div v-else ref="previewEl" style="width:100%;overflow:visible;"></div>
    </template>
  </DiagramLayout>

  <el-dialog
    v-model="styleDialogVisible"
    title="图表样式设置"
    width="600px"
    top="16px"
    class="er-style-dialog"
    append-to-body
  >
    <div v-if="styleDraft" class="er-style-panel">
      <div class="er-style-switches">
        <div class="style-switch-row">
          <span>显示属性</span>
          <el-switch v-model="styleDraft.showAttributes" />
          <em>开启后将显示实体的属性节点</em>
        </div>
        <div class="style-switch-row">
          <span>显示关联</span>
          <el-switch v-model="styleDraft.showRelationships" />
          <em>开启后将显示实体之间的外键关联关系</em>
        </div>
        <div class="style-switch-row">
          <span>关系文本</span>
          <el-switch v-model="styleDraft.showRelationText" />
          <em>开启后在线上显示关系文本（1:N等）</em>
        </div>
        <div class="style-switch-row split">
          <span>主键下划线</span>
          <el-switch v-model="styleDraft.underlinePrimaryKey" />
          <em>开启后为主键属性名称添加下划线标识</em>
          <label>粗细：</label>
          <el-input-number v-model="styleDraft.primaryKeyUnderlineWidth" :min="1" :max="8" :step="0.5" controls-position="right" size="small" />
        </div>
        <div class="style-switch-row">
          <span>自适应宽度</span>
          <el-switch v-model="styleDraft.autoAttributeWidth" />
          <em>开启后属性节点宽度将根据文本长度自动调整</em>
        </div>
        <div class="style-switch-row">
          <span>智能连接线</span>
          <el-switch v-model="styleDraft.smartConnect" />
          <em>连接线自动选择到节点边缘的最佳位置</em>
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">全局样式</div>
        <div class="style-grid">
          <label>连线文本背景</label>
          <el-color-picker v-model="styleDraft.edgeLabelBackground" size="small" show-alpha />
          <label>排版密集度</label>
          <el-slider v-model="styleDraft.layoutDensity" :min="0" :max="100" />
          <label>文字颜色</label>
          <el-color-picker v-model="styleDraft.fontColor" size="small" />
          <label>全局字体</label>
          <el-select v-model="styleDraft.fontFamily" size="small">
            <el-option label="宋体" value="SimSun, 宋体, Songti SC, serif" />
            <el-option label="微软雅黑" value="Microsoft YaHei, 微软雅黑, sans-serif" />
            <el-option label="黑体" value="SimHei, 黑体, sans-serif" />
            <el-option label="楷体" value="KaiTi, 楷体, serif" />
          </el-select>
          <label>字号</label>
          <el-input-number v-model="styleDraft.fontSize" :min="10" :max="36" controls-position="right" size="small" />
          <label>字体粗细</label>
          <el-select v-model="styleDraft.fontWeight" size="small">
            <el-option label="正常" value="normal" />
            <el-option label="加粗" value="bold" />
          </el-select>
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">实体节点</div>
        <div class="style-grid">
          <label>宽度</label>
          <el-input-number v-model="styleDraft.entityWidth" :min="60" :max="260" controls-position="right" size="small" />
          <label>高度</label>
          <el-input-number v-model="styleDraft.entityHeight" :min="28" :max="120" controls-position="right" size="small" />
          <label>填充颜色</label>
          <el-color-picker v-model="styleDraft.entityFill" size="small" show-alpha />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">属性节点</div>
        <div class="style-grid">
          <label>宽度</label>
          <el-input-number v-model="styleDraft.attributeWidth" :min="40" :max="240" controls-position="right" size="small" />
          <label>高度</label>
          <el-input-number v-model="styleDraft.attributeHeight" :min="24" :max="100" controls-position="right" size="small" />
          <label>形状</label>
          <el-select v-model="styleDraft.attributeShape" size="small">
            <el-option label="椭圆" value="ellipse" />
            <el-option label="矩形" value="rect" />
          </el-select>
          <label>填充颜色</label>
          <el-color-picker v-model="styleDraft.attributeFill" size="small" show-alpha />
          <label>布局方式</label>
          <el-select v-model="styleDraft.attributeLayout" size="small">
            <el-option label="圆形分布" value="radial" />
            <el-option label="纵向分布" value="vertical" />
          </el-select>
          <label>连接线长度</label>
          <el-input-number v-model="styleDraft.attributeLinkLength" :min="0" :max="200" controls-position="right" size="small" />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">关系节点</div>
        <div class="style-grid">
          <label>宽度</label>
          <el-input-number v-model="styleDraft.relationshipWidth" :min="40" :max="180" controls-position="right" size="small" />
          <label>高度</label>
          <el-input-number v-model="styleDraft.relationshipHeight" :min="26" :max="120" controls-position="right" size="small" />
          <label>形状</label>
          <el-select v-model="styleDraft.relationshipShape" size="small">
            <el-option label="菱形" value="diamond" />
            <el-option label="矩形" value="rect" />
          </el-select>
          <label>填充颜色</label>
          <el-color-picker v-model="styleDraft.relationshipFill" size="small" show-alpha />
        </div>
      </div>

      <div class="style-section">
        <div class="style-section-title">通用样式</div>
        <div class="style-grid">
          <label>连线颜色</label>
          <el-color-picker v-model="styleDraft.lineColor" size="small" />
          <label>连线粗细</label>
          <el-input-number v-model="styleDraft.lineWidth" :min="0.5" :max="8" :step="0.5" controls-position="right" size="small" />
          <label>边框粗细</label>
          <el-input-number v-model="styleDraft.borderWidth" :min="0.5" :max="8" :step="0.5" controls-position="right" size="small" />
          <label>矩形圆角</label>
          <el-input-number v-model="styleDraft.rectRadius" :min="0" :max="24" controls-position="right" size="small" />
        </div>
      </div>

      <div class="style-tip">按住 Ctrl 键拖动属性节点，可以固定半径围绕父节点移动。</div>
    </div>

    <template #footer>
      <el-button @click="restoreDefaultStyle">恢复默认值</el-button>
      <el-button @click="styleDialogVisible = false">关闭</el-button>
      <el-button type="primary" @click="applyStyleDialog">应用</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="themeDialogVisible"
    title="主题选择"
    width="760px"
    class="er-theme-dialog"
    append-to-body
  >
    <div class="er-theme-grid">
      <button
        v-for="theme in erThemes"
        :key="theme.id"
        class="er-theme-card"
        :class="{ active: selectedThemeId === theme.id }"
        type="button"
        :style="{ background: theme.previewBg }"
        @click="applyTheme(theme)"
      >
        <svg viewBox="0 0 220 92" aria-hidden="true">
          <line x1="48" y1="46" x2="176" y2="46" :stroke="theme.line" stroke-width="2" />
          <ellipse cx="42" cy="46" rx="28" ry="11" :fill="theme.attrFill" :stroke="theme.line" stroke-width="2" />
          <rect x="94" y="32" width="54" height="28" :fill="theme.entityFill" :stroke="theme.line" stroke-width="2" />
          <polygon points="180,46 198,30 216,46 198,62" :fill="theme.relationshipFill" :stroke="theme.line" stroke-width="2" />
          <text x="42" y="50" text-anchor="middle" :fill="theme.text" font-size="11">属性</text>
          <text x="121" y="50" text-anchor="middle" :fill="theme.text" font-size="12">实体</text>
          <text x="198" y="50" text-anchor="middle" :fill="theme.text" font-size="10">关系</text>
        </svg>
      </button>
    </div>
  </el-dialog>

  <el-dialog
    v-model="entityVisibilityDialogVisible"
    title="选择要显示的实体"
    width="500px"
    class="er-visibility-dialog"
    append-to-body
  >
    <div class="er-visibility-tools">
      <el-checkbox :model-value="isAllEntityTempSelected" @change="toggleAllVisibleEntities">全选</el-checkbox>
      <button class="er-text-action" type="button" @click="invertVisibleEntities">反选</button>
    </div>
    <div class="er-visibility-list">
      <el-checkbox-group v-model="draftVisibleEntityNames">
        <label
          v-for="name in entityDisplayNames"
          :key="name"
          class="er-visibility-item"
        >
          <el-checkbox :label="name" :value="name">{{ name }}</el-checkbox>
        </label>
      </el-checkbox-group>
    </div>
    <template #footer>
      <el-button @click="entityVisibilityDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmEntityVisibility">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, nextTick, ref, watch } from 'vue'
import DiagramLayout from '@/components/DiagramLayout.vue'
import { exportToPng, exportToSvg, copyToClipboard } from '@/utils/export'
import { buildSvg, textWidth } from '@/utils/svg-style'
import { readDiagramStorage } from '@/utils/diagramStorage'
import { FolderOpened, Grid, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Attribute {
  id?: number
  name: string
  isPK: boolean
  offsetX: number
  offsetY: number
}

interface Entity {
  id?: number
  name: string
  attributes: Attribute[]
  offsetX: number
  offsetY: number
}

interface Relationship {
  id?: number
  from: string
  to: string
  label: string
  cardinality: string
  offsetX: number
  offsetY: number
  fromCardOffsetX: number
  fromCardOffsetY: number
  toCardOffsetX: number
  toCardOffsetY: number
}

interface RenderAttribute {
  name: string
  isPK: boolean
  offsetX: number
  offsetY: number
}

interface RenderEntity {
  name: string
  attributes: RenderAttribute[]
  offsetX: number
  offsetY: number
}

interface RenderRelationship {
  from: string
  to: string
  label: string
  cardinality: string
  offsetX: number
  offsetY: number
  fromCardOffsetX: number
  fromCardOffsetY: number
  toCardOffsetX: number
  toCardOffsetY: number
  sourceIndex: number
}

interface SqlColumn {
  name: string
  displayName: string
  isPK: boolean
}

interface SqlForeignKey {
  columns: string[]
  refTable: string
  refColumns: string[]
}

interface SqlTable {
  name: string
  displayName: string
  columns: SqlColumn[]
  primaryKeys: Set<string>
  foreignKeys: SqlForeignKey[]
}

const LAYOUT_CYCLE = ['default', 'balanced', 'top', 'wide', 'vertical'] as const

type ERLayoutMode = typeof LAYOUT_CYCLE[number]
type ERInputMode = 'sql' | 'manual'
type ERShape = 'ellipse' | 'rect'
type ERRelationshipShape = 'diamond' | 'rect'
type ERAttributeLayout = 'radial' | 'vertical'

interface ERDiagramStyle {
  showAttributes: boolean
  showRelationships: boolean
  showRelationText: boolean
  underlinePrimaryKey: boolean
  primaryKeyUnderlineWidth: number
  autoAttributeWidth: boolean
  smartConnect: boolean
  edgeLabelBackground: string
  globalBackground: string
  fontFamily: string
  fontColor: string
  fontSize: number
  fontWeight: string
  layoutDensity: number
  entityWidth: number
  entityHeight: number
  entityFill: string
  attributeWidth: number
  attributeHeight: number
  attributeShape: ERShape
  attributeFill: string
  attributeLayout: ERAttributeLayout
  attributeLinkLength: number
  relationshipWidth: number
  relationshipHeight: number
  relationshipShape: ERRelationshipShape
  relationshipFill: string
  lineColor: string
  lineWidth: number
  borderWidth: number
  rectRadius: number
}

interface ERTheme {
  id: string
  previewBg: string
  entityFill: string
  attrFill: string
  relationshipFill: string
  line: string
  text: string
  fontWeight?: string
}

const erThemes: ERTheme[] = [
  { id: 'classic', previewBg: '#ffffff', entityFill: '#ffffff', attrFill: '#ffffff', relationshipFill: '#ffffff', line: '#000000', text: '#000000' },
  { id: 'green', previewBg: '#f1faea', entityFill: '#d8f0d1', attrFill: '#f4fbef', relationshipFill: '#eaf7de', line: '#57984a', text: '#2f6330' },
  { id: 'light', previewBg: '#ffffff', entityFill: '#e8f5f7', attrFill: '#fff7b0', relationshipFill: '#f3eef8', line: '#272727', text: '#111827' },
  { id: 'dark', previewBg: '#202020', entityFill: '#262626', attrFill: '#2c2c2c', relationshipFill: '#252525', line: '#d6dde7', text: '#f8fafc' },
  { id: 'blue-gray', previewBg: '#f1f6fb', entityFill: '#dff0ff', attrFill: '#f3f8ff', relationshipFill: '#e7f0fb', line: '#355a7a', text: '#17324d' },
  { id: 'warm', previewBg: '#fff7e8', entityFill: '#fff2c7', attrFill: '#fff8db', relationshipFill: '#ffe9d8', line: '#9b6045', text: '#6b3b25' },
  { id: 'minimal', previewBg: '#ffffff', entityFill: '#f7fbfc', attrFill: '#ffffff', relationshipFill: '#eef3f5', line: '#9aa7ad', text: '#44525a' },
  { id: 'deep-blue', previewBg: '#1555ab', entityFill: '#1555ab', attrFill: '#1555ab', relationshipFill: '#1555ab', line: '#e7f2ff', text: '#ffffff', fontWeight: 'bold' },
  { id: 'rose', previewBg: '#fff0f0', entityFill: '#ffc8c8', attrFill: '#fff4f4', relationshipFill: '#ffd7df', line: '#ef4444', text: '#8f1d1d' },
  { id: 'orange', previewBg: '#fff3df', entityFill: '#ffe4bd', attrFill: '#fff6df', relationshipFill: '#ffe6c9', line: '#fb7c00', text: '#9a4a00' },
  { id: 'paper', previewBg: '#ffffee', entityFill: '#fffef5', attrFill: '#fffff9', relationshipFill: '#fffef5', line: '#40454a', text: '#2d3338' },
  { id: 'pink', previewBg: '#ffeaf2', entityFill: '#ffd0e8', attrFill: '#ffe3f0', relationshipFill: '#ffc2dc', line: '#d83c8e', text: '#8b1e56' },
]

const entities = ref<Entity[]>([])
const relationships = ref<Relationship[]>([])
const previewEl = ref<HTMLElement>()
const sqlFileInput = ref<HTMLInputElement>()
const layoutRef = ref<InstanceType<typeof DiagramLayout>>()
const erLayoutMode = ref<ERLayoutMode>('default')
const inputMode = ref<ERInputMode>('sql')
const activeManualTab = ref<'entities' | 'relations'>('entities')
const collapsedEntityIds = ref<number[]>([])
const themeDialogVisible = ref(false)
const entityVisibilityDialogVisible = ref(false)
const selectedThemeId = ref('classic')
const customEntityVisibility = ref(false)
const visibleEntityNames = ref<string[]>([])
const draftVisibleEntityNames = ref<string[]>([])
const sqlText = ref('')
const styleDialogVisible = ref(false)
const erStyle = ref<ERDiagramStyle>(createDefaultERStyle())
const styleDraft = ref<ERDiagramStyle | null>(null)
const ER_STYLE_STORAGE_KEY = 'diagram:er-style'

let timer: number | undefined
let nodeId = 0
let draggingNode:
  | { kind: 'entity'; entityIndex: number }
  | { kind: 'attribute'; entityIndex: number; attrIndex: number }
  | { kind: 'relationship'; relIndex: number }
  | { kind: 'cardinality'; relIndex: number; side: 'from' | 'to' }
  | null = null
let editingAttribute: { entityIndex: number; attrIndex: number } | null = null
let editingRelationshipLabel: number | null = null
let editingCardinality: { relIndex: number; side: 'from' | 'to' } | null = null
let dragStartPoint = { x: 0, y: 0 }
let dragStartOffset = { x: 0, y: 0 }

const hasContent = computed(() => {
  return Boolean(
    entities.value.some((entity) => entity.name.trim() || entity.attributes.some((attr) => attr.name.trim())) ||
    relationships.value.some((rel) => rel.from.trim() || rel.to.trim() || rel.label.trim())
  )
})

const entityDisplayNames = computed(() => entities.value.map((entity, index) => entity.name.trim() || `实体${index + 1}`))

const isAllEntityTempSelected = computed(() => {
  return entityDisplayNames.value.length > 0 && draftVisibleEntityNames.value.length === entityDisplayNames.value.length
})
const layoutCycleButtonText = computed(() => erLayoutMode.value === 'default' ? '默认排版' : '美化排版')

watch([entities, relationships, erLayoutMode, erStyle], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(renderDiagram, 300)
}, { deep: true })

function createDefaultERStyle(): ERDiagramStyle {
  return {
    showAttributes: true,
    showRelationships: true,
    showRelationText: true,
    underlinePrimaryKey: true,
    primaryKeyUnderlineWidth: 3.5,
    autoAttributeWidth: true,
    smartConnect: true,
    edgeLabelBackground: 'rgba(255, 255, 255, 0)',
    globalBackground: '#ffffff',
    fontFamily: 'SimSun, 宋体, Songti SC, serif',
    fontColor: '#000000',
    fontSize: 13,
    fontWeight: 'normal',
    layoutDensity: 45,
    entityWidth: 120,
    entityHeight: 50,
    entityFill: '#ffffff',
    attributeWidth: 100,
    attributeHeight: 50,
    attributeShape: 'ellipse',
    attributeFill: '#ffffff',
    attributeLayout: 'radial',
    attributeLinkLength: 0,
    relationshipWidth: 65,
    relationshipHeight: 50,
    relationshipShape: 'diamond',
    relationshipFill: '#ffffff',
    lineColor: '#000000',
    lineWidth: 1,
    borderWidth: 1,
    rectRadius: 0,
  }
}

function cloneStyle(style: ERDiagramStyle): ERDiagramStyle {
  return { ...style }
}

function loadStoredStyle() {
  try {
    const cached = localStorage.getItem(ER_STYLE_STORAGE_KEY)
    if (!cached) return
    const defaults = createDefaultERStyle()
    const parsed = JSON.parse(cached)
    erStyle.value = { ...defaults, ...parsed }
    erStyle.value.lineWidth = Number(erStyle.value.lineWidth) || defaults.lineWidth
    erStyle.value.borderWidth = Number(erStyle.value.borderWidth) || defaults.borderWidth
    if (parsed.edgeLabelBackground === '#ffffff') {
      erStyle.value.edgeLabelBackground = defaults.edgeLabelBackground
      localStorage.setItem(ER_STYLE_STORAGE_KEY, JSON.stringify(erStyle.value))
    }
  } catch {
    localStorage.removeItem(ER_STYLE_STORAGE_KEY)
  }
}

function openStyleDialog() {
  styleDraft.value = cloneStyle(erStyle.value)
  styleDialogVisible.value = true
}

function openThemeDialog() {
  themeDialogVisible.value = true
}

function applyTheme(theme: ERTheme) {
  selectedThemeId.value = theme.id
  erStyle.value = {
    ...erStyle.value,
    entityFill: theme.entityFill,
    attributeFill: theme.attrFill,
    relationshipFill: theme.relationshipFill,
    lineColor: theme.line,
    fontColor: theme.text,
    fontWeight: theme.fontWeight || 'normal',
  }
  saveCurrentStyle()
  window.clearTimeout(timer)
  nextTick(renderDiagram)
}

function applyStyleDialog() {
  if (!styleDraft.value) return
  erStyle.value = cloneStyle(styleDraft.value)
  saveCurrentStyle()
  styleDialogVisible.value = false
  nextTick(renderDiagram)
}

function restoreDefaultStyle() {
  styleDraft.value = createDefaultERStyle()
  erStyle.value = cloneStyle(styleDraft.value)
  localStorage.removeItem(ER_STYLE_STORAGE_KEY)
  nextTick(renderDiagram)
}

function saveCurrentStyle() {
  localStorage.setItem(ER_STYLE_STORAGE_KEY, JSON.stringify(erStyle.value))
}

function openEntityVisibilityDialog() {
  draftVisibleEntityNames.value = customEntityVisibility.value
    ? visibleEntityNames.value.filter((name) => entityDisplayNames.value.includes(name))
    : [...entityDisplayNames.value]
  entityVisibilityDialogVisible.value = true
}

function toggleAllVisibleEntities(value: string | number | boolean) {
  draftVisibleEntityNames.value = value ? [...entityDisplayNames.value] : []
}

function invertVisibleEntities() {
  const selected = new Set(draftVisibleEntityNames.value)
  draftVisibleEntityNames.value = entityDisplayNames.value.filter((name) => !selected.has(name))
}

function confirmEntityVisibility() {
  customEntityVisibility.value = true
  visibleEntityNames.value = [...draftVisibleEntityNames.value]
  entityVisibilityDialogVisible.value = false
  window.clearTimeout(timer)
  nextTick(renderDiagram)
}

function createAttribute(name = '', isPK = false): Attribute {
  return { id: ++nodeId, name, isPK, offsetX: 0, offsetY: 0 }
}

function createEntity(name = '', attrs: Array<string | { name: string; isPK: boolean }> = []): Entity {
  return {
    id: ++nodeId,
    name,
    offsetX: 0,
    offsetY: 0,
    attributes: attrs.map((attr) => typeof attr === 'string' ? createAttribute(attr) : createAttribute(attr.name, attr.isPK)),
  }
}

function createRelationship(from = '', to = '', cardinality = '1:N', label = '关联'): Relationship {
  return {
    id: ++nodeId,
    from,
    to,
    cardinality,
    label,
    offsetX: 0,
    offsetY: 0,
    fromCardOffsetX: 0,
    fromCardOffsetY: 0,
    toCardOffsetX: 0,
    toCardOffsetY: 0,
  }
}

function addEntity() {
  const next = createEntity(`实体${entities.value.length + 1}`, ['属性1', '属性2'])
  entities.value.push(next)
  const key = next.id || entities.value.length - 1
  collapsedEntityIds.value = collapsedEntityIds.value.filter((id) => id !== key)
}

function removeEntity(index: number) {
  const [removed] = entities.value.splice(index, 1)
  if (removed?.id) {
    collapsedEntityIds.value = collapsedEntityIds.value.filter((id) => id !== removed.id)
  }
}

function addAttribute(entityIndex: number) {
  const entity = entities.value[entityIndex]
  if (!entity) return
  entity.attributes.push(createAttribute(`属性${entity.attributes.length + 1}`))
}

function removeAttribute(entityIndex: number, attrIndex: number) {
  const entity = entities.value[entityIndex]
  if (!entity) return
  entity.attributes.splice(attrIndex, 1)
}

function addRelationship() {
  const from = entities.value[0]?.name || '实体1'
  const to = entities.value[1]?.name || '实体2'
  relationships.value.push(createRelationship(from, to, '1:N', `关系${relationships.value.length + 1}`))
}

function removeRelationship(index: number) {
  relationships.value.splice(index, 1)
}

function triggerSqlImport() {
  sqlFileInput.value?.click()
}

function handleGenerateClick() {
  if (inputMode.value === 'sql') {
    generateFromSql()
    return
  }
  renderManualDiagram()
}

function toggleInputMode() {
  inputMode.value = inputMode.value === 'sql' ? 'manual' : 'sql'
}

function generateFromSql() {
  const sql = sqlText.value.trim()
  if (!sql) {
    ElMessage.warning('请先输入或导入 SQL 建表语句')
    return
  }

  const parsed = parseSqlToER(sql)
  if (!parsed.entities.length) {
    ElMessage.warning('没有识别到 CREATE TABLE 建表语句')
    return
  }

  applyParsedER(parsed)
  ElMessage.success(`已生成 ${parsed.entities.length} 个实体，${parsed.relationships.length} 个关系`)
}

function fillManualExample() {
  loadExample()
  inputMode.value = 'manual'
  activeManualTab.value = 'entities'
  collapsedEntityIds.value = []
  window.clearTimeout(timer)
  nextTick(renderDiagram)
}

function renderManualDiagram() {
  window.clearTimeout(timer)
  renderDiagram()
  ElMessage.success('ER图已更新')
}

function optimizeEntityText() {
  entities.value.forEach((entity, entityIndex) => {
    entity.name = entity.name.trim() || `实体${entityIndex + 1}`
    entity.attributes.forEach((attr, attrIndex) => {
      attr.name = attr.name.trim() || `属性${attrIndex + 1}`
    })
  })
  ElMessage.success('已整理空白实体与属性名称')
}

function entityCollapseKey(entity: Entity, index: number) {
  return entity.id ?? -(index + 1)
}

function isEntityCollapsed(entity: Entity, index: number) {
  return collapsedEntityIds.value.includes(entityCollapseKey(entity, index))
}

function toggleEntityCollapse(entity: Entity, index: number) {
  const key = entityCollapseKey(entity, index)
  collapsedEntityIds.value = collapsedEntityIds.value.includes(key)
    ? collapsedEntityIds.value.filter((id) => id !== key)
    : [...collapsedEntityIds.value, key]
}

async function handleSqlFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const sql = await readSqlFile(file)
    sqlText.value = sql
    inputMode.value = 'sql'
    const parsed = parseSqlToER(sql)
    if (!parsed.entities.length) {
      ElMessage.warning('没有识别到 CREATE TABLE 建表语句')
      return
    }

    applyParsedER(parsed)
    ElMessage.success(`已导入 ${parsed.entities.length} 个实体，${parsed.relationships.length} 个关系`)
  } catch (error: any) {
    ElMessage.error(`SQL导入失败：${error?.message || '文件无法读取'}`)
  }
}

function applyParsedER(parsed: { entities: Entity[]; relationships: Relationship[] }) {
  entities.value = parsed.entities
  relationships.value = parsed.relationships
  customEntityVisibility.value = false
  visibleEntityNames.value = []
  draftVisibleEntityNames.value = []
  editingAttribute = null
  editingRelationshipLabel = null
  editingCardinality = null
  resetDiagramOffsets()
  erLayoutMode.value = 'default'
  window.clearTimeout(timer)
  nextTick(renderDiagram)
}

function cycleLayout(showMessage = true) {
  if (!hasContent.value) return
  const currentIndex = LAYOUT_CYCLE.indexOf(erLayoutMode.value)
  const nextMode = LAYOUT_CYCLE[(Math.max(0, currentIndex) + 1) % LAYOUT_CYCLE.length]
  erLayoutMode.value = nextMode
  resetDiagramOffsets()
  editingAttribute = null
  editingRelationshipLabel = null
  editingCardinality = null
  window.clearTimeout(timer)
  nextTick(renderDiagram)
  if (showMessage) ElMessage.success(`已切换排版：${layoutModeName(nextMode)}`)
}

function toggleAttributesVisible() {
  erStyle.value = {
    ...erStyle.value,
    showAttributes: !erStyle.value.showAttributes,
  }
  saveCurrentStyle()
  window.clearTimeout(timer)
  nextTick(renderDiagram)
}

function applyDefaultTheme() {
  erStyle.value = {
    ...erStyle.value,
    entityFill: '#ffffff',
    attributeFill: '#ffffff',
    relationshipFill: '#ffffff',
    lineColor: '#000000',
    fontColor: '#000000',
  }
  saveCurrentStyle()
  window.clearTimeout(timer)
  nextTick(renderDiagram)
  ElMessage.success('已应用默认主题')
}

function layoutModeName(mode: ERLayoutMode) {
  const names: Record<ERLayoutMode, string> = {
    balanced: '下方关联',
    top: '上方关联',
    wide: '横向展开',
    vertical: '纵向排列',
    default: '默认排版',
  }
  return names[mode]
}

function resetDiagramOffsets() {
  entities.value.forEach((entity) => {
    entity.offsetX = 0
    entity.offsetY = 0
    entity.attributes.forEach((attr) => {
      attr.offsetX = 0
      attr.offsetY = 0
    })
  })
  relationships.value.forEach((rel) => {
    rel.offsetX = 0
    rel.offsetY = 0
    rel.fromCardOffsetX = 0
    rel.fromCardOffsetY = 0
    rel.toCardOffsetX = 0
    rel.toCardOffsetY = 0
  })
}

async function readSqlFile(file: File) {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  try {
    const gbk = new TextDecoder('gbk').decode(buffer)
    return mojibakeScore(gbk) < mojibakeScore(utf8) ? gbk : utf8
  } catch {
    return utf8
  }
}

function mojibakeScore(text: string) {
  const commonNoise = text.match(/�|鍚|鍊|鎻|浼|笟|琛|層|涓|姝|绋|棰|鏍|閰|疆|鎵|睘|鐢|绉|粙|鐘|舶/g)
  return commonNoise ? commonNoise.length : 0
}

function parseSqlToER(sql: string): { entities: Entity[]; relationships: Relationship[] } {
  const tables = parseCreateTableStatements(sql)
  const tableMap = new Map(tables.map((table) => [table.name.toLowerCase(), table]))

  const parsedEntities = tables.map((table) => {
    table.columns.forEach((column) => {
      column.isPK = column.isPK || table.primaryKeys.has(column.name.toLowerCase())
    })
    return createEntity(
      table.displayName,
      table.columns.map((column) => ({
        name: column.displayName,
        isPK: column.isPK,
      }))
    )
  })

  const parsedRelationships: Relationship[] = []
  const seen = new Set<string>()
  tables.forEach((table) => {
    table.foreignKeys.forEach((fk) => {
      const refTable = tableMap.get(fk.refTable.toLowerCase())
      if (!refTable) return
      const key = `${refTable.displayName}->${table.displayName}:${fk.columns.join(',')}`
      if (seen.has(key)) return
      seen.add(key)
      const label = fk.columns.length
        ? fk.columns.map((columnName) => {
            const column = table.columns.find((item) => item.name.toLowerCase() === columnName.toLowerCase())
            return column?.displayName || columnName
          }).join(',')
        : '关联'
      parsedRelationships.push(createRelationship(refTable.displayName, table.displayName, '1:N', label))
    })
  })

  return { entities: parsedEntities, relationships: parsedRelationships }
}

function parseCreateTableStatements(sql: string): SqlTable[] {
  const cleaned = stripSqlComments(sql)
  const tables: SqlTable[] = []
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$]+)(?:\s*\.\s*(?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$]+))?)\s*\(/gi
  let match: RegExpExecArray | null

  while ((match = createRe.exec(cleaned))) {
    const tableName = cleanSqlIdentifier(match[1])
    const openParen = cleaned.indexOf('(', match.index)
    const closeParen = findMatchingParen(cleaned, openParen)
    if (!tableName || closeParen === -1) continue

    const body = cleaned.slice(openParen + 1, closeParen)
    const suffixEnd = cleaned.indexOf(';', closeParen)
    const suffix = cleaned.slice(closeParen + 1, suffixEnd === -1 ? closeParen + 240 : suffixEnd)
    const table = parseTableBody(tableName, body, suffix)
    if (table.columns.length) tables.push(table)
    createRe.lastIndex = closeParen + 1
  }

  return tables
}

function stripSqlComments(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\r\n]*/g, '')
    .replace(/#[^\r\n]*/g, '')
}

function findMatchingParen(text: string, openIndex: number) {
  let depth = 0
  let quote = ''
  for (let i = openIndex; i < text.length; i++) {
    const char = text[i]
    const prev = text[i - 1]
    if (quote) {
      if (char === quote && prev !== '\\') quote = ''
      continue
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === '(') depth++
    if (char === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function parseTableBody(tableName: string, body: string, suffix: string): SqlTable {
  const table: SqlTable = {
    name: tableName,
    displayName: extractSqlComment(suffix) || tableName,
    columns: [],
    primaryKeys: new Set<string>(),
    foreignKeys: [],
  }

  splitSqlTopLevel(body).forEach((part) => {
    const item = part.trim()
    if (!item) return

    const upper = item.toUpperCase()
    if (/\bPRIMARY\s+KEY\b/.test(upper) && !isColumnDefinition(item)) {
      parseSqlIdentifierList(item).forEach((key) => table.primaryKeys.add(key.toLowerCase()))
      return
    }

    const fk = parseForeignKey(item)
    if (fk) {
      table.foreignKeys.push(fk)
      return
    }

    if (/^(CONSTRAINT|KEY|INDEX|UNIQUE|FULLTEXT|SPATIAL|CHECK)\b/i.test(item)) return

    const column = parseColumnDefinition(item)
    if (column) {
      table.columns.push(column)
      if (column.isPK) table.primaryKeys.add(column.name.toLowerCase())
    }
  })

  table.columns.forEach((column) => {
    column.isPK = column.isPK || table.primaryKeys.has(column.name.toLowerCase())
  })

  return table
}

function isColumnDefinition(text: string) {
  const first = firstSqlToken(text).toUpperCase()
  return !['PRIMARY', 'FOREIGN', 'CONSTRAINT', 'KEY', 'INDEX', 'UNIQUE', 'FULLTEXT', 'SPATIAL', 'CHECK'].includes(first)
}

function parseColumnDefinition(text: string): SqlColumn | null {
  const token = firstSqlToken(text)
  if (!token) return null
  const name = cleanSqlIdentifier(token)
  if (!name) return null
  const upper = text.toUpperCase()
  return {
    name,
    displayName: extractSqlComment(text) || name,
    isPK: /\bPRIMARY\s+KEY\b/.test(upper),
  }
}

function parseForeignKey(text: string): SqlForeignKey | null {
  const match = text.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+((?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$]+)(?:\s*\.\s*(?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$]+))?)\s*\(([^)]+)\)/i)
  if (!match) return null
  return {
    columns: splitSqlIdentifierList(match[1]),
    refTable: cleanSqlIdentifier(match[2]),
    refColumns: splitSqlIdentifierList(match[3]),
  }
}

function splitSqlTopLevel(text: string) {
  const result: string[] = []
  let depth = 0
  let quote = ''
  let start = 0

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const prev = text[i - 1]
    if (quote) {
      if (char === quote && prev !== '\\') quote = ''
      continue
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      result.push(text.slice(start, i))
      start = i + 1
    }
  }
  result.push(text.slice(start))
  return result
}

function firstSqlToken(text: string) {
  return text.trim().match(/^(`[^`]+`|"[^"]+"|\[[^\]]+\]|[^\s]+)/)?.[1] || ''
}

function parseSqlIdentifierList(text: string) {
  const inside = text.match(/\(([^)]+)\)/)?.[1] || text
  return splitSqlTopLevel(inside)
    .map((item) => cleanSqlIdentifier(item))
    .filter(Boolean)
}

function splitSqlIdentifierList(text: string) {
  return splitSqlTopLevel(text)
    .map((item) => cleanSqlIdentifier(item))
    .filter(Boolean)
}

function cleanSqlIdentifier(raw: string) {
  const normalized = raw.trim().replace(/\s+/g, '')
  const parts = normalized.split('.')
  const last = parts[parts.length - 1] || ''
  return last.replace(/^`|`$/g, '').replace(/^"|"$/g, '').replace(/^\[|\]$/g, '').trim()
}

function extractSqlComment(text: string) {
  const match = text.match(/\bCOMMENT\s*=?\s*'((?:\\'|''|[^'])*)'/i)
  if (!match) return ''
  return match[1].replace(/\\'/g, '\'').replace(/''/g, '\'').trim()
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function erSvgStyleTag() {
  const style = erStyle.value
  return `<style>
    .er-diagram-root .edge-line { stroke: ${style.lineColor}; stroke-width: ${style.lineWidth}; fill: none; }
    .er-diagram-root .er-entity-shape { fill: ${style.entityFill}; stroke: ${style.lineColor}; stroke-width: ${style.borderWidth}; }
    .er-diagram-root .er-attribute-shape { fill: ${style.attributeFill}; stroke: ${style.lineColor}; stroke-width: ${style.borderWidth}; }
    .er-diagram-root .er-relationship-shape { fill: ${style.relationshipFill}; stroke: ${style.lineColor}; stroke-width: ${style.borderWidth}; }
    .er-diagram-root .node-label,
    .er-diagram-root .node-label-pk,
    .er-diagram-root .edge-label,
    .er-diagram-root .cardinality {
      font-family: ${style.fontFamily};
      fill: ${style.fontColor};
      font-size: ${style.fontSize}px;
      font-weight: ${style.fontWeight};
    }
    .er-diagram-root .node-label-pk {
      text-decoration: ${style.underlinePrimaryKey ? 'underline' : 'none'};
      text-decoration-thickness: ${style.primaryKeyUnderlineWidth}px;
    }
    .er-diagram-root .edge-label,
    .er-diagram-root .cardinality {
      font-size: ${Math.max(10, style.fontSize - 1)}px;
    }
  </style>`
}

function styleDensityScale() {
  return Math.max(0.55, Math.min(1.35, 1.35 - erStyle.value.layoutDensity / 100))
}

function styledLineClass() {
  return 'edge-line'
}

function inlineInputSvg(
  className: string,
  x: number,
  y: number,
  width: number,
  height: number,
  value: string,
  data: { relIndex?: number; side?: 'from' | 'to'; entityIndex?: number; attrIndex?: number }
) {
  const attrs = [
    `class="er-inline-edit-input ${className}"`,
    data.relIndex !== undefined ? `data-rel-index="${data.relIndex}"` : '',
    data.side ? `data-side="${data.side}"` : '',
    data.entityIndex !== undefined ? `data-entity-index="${data.entityIndex}"` : '',
    data.attrIndex !== undefined ? `data-attr-index="${data.attrIndex}"` : '',
    `value="${esc(value)}"`,
    `style="box-sizing:border-box;width:100%;height:100%;border:${erStyle.value.borderWidth}px solid ${erStyle.value.lineColor};background:#fff;text-align:center;font:${Math.max(10, erStyle.value.fontSize - 1)}px ${erStyle.value.fontFamily};color:${erStyle.value.fontColor};outline:none;padding:0 2px;"`,
  ].filter(Boolean).join(' ')
  return `<foreignObject x="${x}" y="${y}" width="${width}" height="${height}"><input xmlns="http://www.w3.org/1999/xhtml" ${attrs}/></foreignObject>`
}

function cardinalityTextSvg(relIndex: number, side: 'from' | 'to', x: number, y: number, value: string) {
  if (!erStyle.value.showRelationText) return ''
  return `<g class="editable-er-cardinality" data-rel-index="${relIndex}" data-side="${side}" style="cursor:move;" pointer-events="all">
    <rect class="draggable-er-node er-cardinality-hit" data-kind="cardinality" data-rel-index="${relIndex}" data-side="${side}" x="${x - 22}" y="${y - 17}" width="44" height="28" fill="transparent" pointer-events="all" style="cursor:move;"/>
    <text class="cardinality" x="${x}" y="${y}" text-anchor="middle" pointer-events="none">${esc(value)}</text>
  </g>`
}

function cardinalityPoint(rel: RenderRelationship, side: 'from' | 'to', x: number, y: number) {
  return side === 'from'
    ? { x: x + rel.fromCardOffsetX, y: y + rel.fromCardOffsetY }
    : { x: x + rel.toCardOffsetX, y: y + rel.toCardOffsetY }
}

function getRenderData() {
  const selectedNames = customEntityVisibility.value ? new Set(visibleEntityNames.value) : null
  const renderEntities = entities.value
    .map((entity, entityIndex) => ({
      name: entity.name.trim() || `实体${entityIndex + 1}`,
      attributes: entity.attributes
        .map((attr, attrIndex) => ({
          name: attr.name.trim() || `属性${attrIndex + 1}`,
          isPK: attr.isPK,
          offsetX: attr.offsetX || 0,
          offsetY: attr.offsetY || 0,
        }))
        .filter((attr) => attr.name),
      offsetX: entity.offsetX || 0,
      offsetY: entity.offsetY || 0,
    }))
    .filter((entity) => entity.name || entity.attributes.length)
    .filter((entity) => !selectedNames || selectedNames.has(entity.name))
  const renderEntityNames = new Set(renderEntities.map((entity) => entity.name))

  const renderRelationships = relationships.value
    .map((rel, index) => ({
      from: rel.from.trim(),
      to: rel.to.trim(),
      cardinality: rel.cardinality || '1:N',
      label: rel.label.trim() || `关系${index + 1}`,
      offsetX: rel.offsetX || 0,
      offsetY: rel.offsetY || 0,
      fromCardOffsetX: rel.fromCardOffsetX || 0,
      fromCardOffsetY: rel.fromCardOffsetY || 0,
      toCardOffsetX: rel.toCardOffsetX || 0,
      toCardOffsetY: rel.toCardOffsetY || 0,
      sourceIndex: index,
    }))
    .filter((rel) => rel.from && rel.to)
    .filter((rel) => renderEntityNames.has(rel.from) && renderEntityNames.has(rel.to))

  return { entities: renderEntities, relationships: renderRelationships }
}

function renderDiagram() {
  if (!previewEl.value) return
  const data = getRenderData()

  if (!data.entities.length) {
    previewEl.value.innerHTML = ''
    return
  }

  try {
    previewEl.value.innerHTML = generateERSVG(data.entities, data.relationships)
    bindNodeDrag()
    bindInlineAttributeEditors()
    bindInlineRelationshipEditors()
  } catch (e: any) {
    previewEl.value.innerHTML = `<div class="diagram-error">渲染失败：${e.message || ''}</div>`
  }
}

function bindNodeDrag() {
  if (!previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  if (!svg) return

  previewEl.value.querySelectorAll<SVGElement>('.draggable-er-node').forEach((group) => {
    group.addEventListener('pointerdown', (event) => {
      if ((event.target as Element | null)?.closest?.('.er-inline-edit-input')) return
      event.preventDefault()
      event.stopPropagation()

      const kind = group.dataset.kind
      const entityIndex = Number(group.dataset.entityIndex)
      const attrIndex = Number(group.dataset.attrIndex)
      const relIndex = Number(group.dataset.relIndex)
      const target = getDragTarget(kind, entityIndex, attrIndex, relIndex)
      if (!target) return

      if (kind === 'entity') draggingNode = { kind: 'entity', entityIndex }
      if (kind === 'attribute') draggingNode = { kind: 'attribute', entityIndex, attrIndex }
      if (kind === 'relationship') draggingNode = { kind: 'relationship', relIndex }
      if (kind === 'cardinality') draggingNode = { kind: 'cardinality', relIndex, side: group.dataset.side === 'to' ? 'to' : 'from' }
      dragStartPoint = getSvgPoint(event, svg)
      dragStartOffset = kind === 'cardinality'
        ? (group.dataset.side === 'to'
            ? { x: (target as Relationship).toCardOffsetX || 0, y: (target as Relationship).toCardOffsetY || 0 }
            : { x: (target as Relationship).fromCardOffsetX || 0, y: (target as Relationship).fromCardOffsetY || 0 })
        : { x: target.offsetX || 0, y: target.offsetY || 0 }

      window.addEventListener('pointermove', handleNodeDrag)
      window.addEventListener('pointerup', stopNodeDrag, { once: true })
      window.addEventListener('pointercancel', stopNodeDrag, { once: true })
    })

    group.addEventListener('dblclick', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (group.dataset.kind === 'relationship') {
        const relIndex = Number(group.dataset.relIndex)
        if (!relationships.value[relIndex]) return
        editingRelationshipLabel = relIndex
        renderDiagram()
        return
      }

      if (group.dataset.kind !== 'attribute') return
      const entityIndex = Number(group.dataset.entityIndex)
      const attrIndex = Number(group.dataset.attrIndex)
      if (!entities.value[entityIndex]?.attributes[attrIndex]) return
      editingAttribute = { entityIndex, attrIndex }
      renderDiagram()
    })
  })
}

function bindInlineAttributeEditors() {
  previewEl.value?.querySelectorAll<SVGGElement>('.editable-er-attribute').forEach((group) => {
    group.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
    })
    group.addEventListener('dblclick', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const entityIndex = Number(group.dataset.entityIndex)
      const attrIndex = Number(group.dataset.attrIndex)
      if (!entities.value[entityIndex]?.attributes[attrIndex]) return
      editingAttribute = { entityIndex, attrIndex }
      renderDiagram()
    })
  })

  const input = previewEl.value?.querySelector<HTMLInputElement>('.er-inline-attr-input')
  if (!input) return

  input.focus()
  input.select()

  input.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
  })
  input.addEventListener('dblclick', (event) => {
    event.stopPropagation()
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitAttributeEdit(input)
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelAttributeEdit()
    }
  })
  input.addEventListener('blur', () => {
    commitAttributeEdit(input)
  }, { once: true })
}

function bindInlineRelationshipEditors() {
  previewEl.value?.querySelectorAll<SVGGElement>('.editable-er-relationship-label').forEach((group) => {
    group.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
    })
    group.addEventListener('dblclick', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const relIndex = Number(group.dataset.relIndex)
      if (!relationships.value[relIndex]) return
      editingRelationshipLabel = relIndex
      renderDiagram()
    })
  })

  previewEl.value?.querySelectorAll<SVGGElement>('.editable-er-cardinality').forEach((group) => {
    group.addEventListener('pointerdown', (event) => {
      const svg = previewEl.value?.querySelector('svg')
      if (!svg || (event.target as Element | null)?.closest?.('.er-inline-edit-input')) return
      const relIndex = Number(group.dataset.relIndex)
      const side = group.dataset.side === 'to' ? 'to' : 'from'
      const rel = relationships.value[relIndex]
      if (!rel) return
      event.preventDefault()
      event.stopPropagation()

      draggingNode = { kind: 'cardinality', relIndex, side }
      dragStartPoint = getSvgPoint(event, svg)
      dragStartOffset = side === 'from'
        ? { x: rel.fromCardOffsetX || 0, y: rel.fromCardOffsetY || 0 }
        : { x: rel.toCardOffsetX || 0, y: rel.toCardOffsetY || 0 }

      window.addEventListener('pointermove', handleNodeDrag)
      window.addEventListener('pointerup', stopNodeDrag, { once: true })
      window.addEventListener('pointercancel', stopNodeDrag, { once: true })
    })
    group.addEventListener('click', (event) => {
      event.stopPropagation()
    })
    group.addEventListener('dblclick', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const relIndex = Number(group.dataset.relIndex)
      const side = group.dataset.side === 'to' ? 'to' : 'from'
      if (!relationships.value[relIndex]) return
      editingCardinality = { relIndex, side }
      renderDiagram()
    })
  })

  const labelInput = previewEl.value?.querySelector<HTMLInputElement>('.er-inline-relation-input')
  if (labelInput) {
    focusInlineInput(labelInput)
    labelInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commitRelationshipLabelEdit(labelInput)
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelRelationshipEdit()
      }
    })
    labelInput.addEventListener('blur', () => {
      commitRelationshipLabelEdit(labelInput)
    }, { once: true })
  }

  const cardinalityInput = previewEl.value?.querySelector<HTMLInputElement>('.er-inline-cardinality-input')
  if (cardinalityInput) {
    focusInlineInput(cardinalityInput)
    cardinalityInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commitCardinalityEdit(cardinalityInput)
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelRelationshipEdit()
      }
    })
    cardinalityInput.addEventListener('blur', () => {
      commitCardinalityEdit(cardinalityInput)
    }, { once: true })
  }
}

function focusInlineInput(input: HTMLInputElement) {
  input.focus()
  input.select()
  input.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
  })
  input.addEventListener('dblclick', (event) => {
    event.stopPropagation()
  })
}

function commitAttributeEdit(input: HTMLInputElement) {
  if (!editingAttribute) return
  const entityIndex = Number(input.dataset.entityIndex)
  const attrIndex = Number(input.dataset.attrIndex)
  const target = entities.value[entityIndex]?.attributes[attrIndex]
  if (target) {
    target.name = input.value.trim() || `属性${attrIndex + 1}`
  }
  editingAttribute = null
  window.clearTimeout(timer)
  renderDiagram()
}

function commitRelationshipLabelEdit(input: HTMLInputElement) {
  if (editingRelationshipLabel === null) return
  const relIndex = Number(input.dataset.relIndex)
  const target = relationships.value[relIndex]
  if (target) {
    target.label = input.value.trim() || `关系${relIndex + 1}`
  }
  editingRelationshipLabel = null
  window.clearTimeout(timer)
  renderDiagram()
}

function commitCardinalityEdit(input: HTMLInputElement) {
  if (!editingCardinality) return
  const relIndex = Number(input.dataset.relIndex)
  const side = input.dataset.side === 'to' ? 'to' : 'from'
  const target = relationships.value[relIndex]
  if (target) {
    const parts = (target.cardinality || '1:N').split(':')
    const from = side === 'from' ? input.value.trim() || '1' : parts[0] || '1'
    const to = side === 'to' ? input.value.trim() || 'N' : parts[1] || 'N'
    target.cardinality = `${from}:${to}`
  }
  editingCardinality = null
  window.clearTimeout(timer)
  renderDiagram()
}

function cancelRelationshipEdit() {
  editingRelationshipLabel = null
  editingCardinality = null
  window.clearTimeout(timer)
  renderDiagram()
}

function cancelAttributeEdit() {
  if (!editingAttribute) return
  editingAttribute = null
  window.clearTimeout(timer)
  renderDiagram()
}

function getDragTarget(kind: string | undefined, entityIndex: number, attrIndex: number, relIndex: number) {
  if (kind === 'entity') return entities.value[entityIndex]
  if (kind === 'attribute') return entities.value[entityIndex]?.attributes[attrIndex]
  if (kind === 'relationship') return relationships.value[relIndex]
  if (kind === 'cardinality') return relationships.value[relIndex]
  return undefined
}

function getSvgPoint(event: PointerEvent, svg: SVGSVGElement) {
  const rect = svg.getBoundingClientRect()
  const viewBox = svg.viewBox.baseVal
  const width = rect.width || svg.clientWidth || viewBox.width || 1
  const height = rect.height || svg.clientHeight || viewBox.height || 1
  return {
    x: viewBox.x + ((event.clientX - rect.left) / width) * viewBox.width,
    y: viewBox.y + ((event.clientY - rect.top) / height) * viewBox.height,
  }
}

function handleNodeDrag(event: PointerEvent) {
  if (!draggingNode || !previewEl.value) return
  const svg = previewEl.value.querySelector('svg')
  if (!svg) return

  let target: Entity | Attribute | Relationship | undefined
  if (draggingNode.kind === 'entity') target = entities.value[draggingNode.entityIndex]
  if (draggingNode.kind === 'attribute') target = entities.value[draggingNode.entityIndex]?.attributes[draggingNode.attrIndex]
  if (draggingNode.kind === 'relationship') target = relationships.value[draggingNode.relIndex]
  if (draggingNode.kind === 'cardinality') target = relationships.value[draggingNode.relIndex]
  if (!target) return

  event.preventDefault()
  const current = getSvgPoint(event, svg)
  const nextX = Math.round(dragStartOffset.x + current.x - dragStartPoint.x)
  const nextY = Math.round(dragStartOffset.y + current.y - dragStartPoint.y)
  if (draggingNode.kind === 'cardinality') {
    const rel = target as Relationship
    if (draggingNode.side === 'from') {
      rel.fromCardOffsetX = nextX
      rel.fromCardOffsetY = nextY
    } else {
      rel.toCardOffsetX = nextX
      rel.toCardOffsetY = nextY
    }
  } else {
    target.offsetX = nextX
    target.offsetY = nextY
  }
  window.clearTimeout(timer)
  renderDiagram()
}

function stopNodeDrag() {
  draggingNode = null
  window.removeEventListener('pointermove', handleNodeDrag)
}

interface DiagramPoint {
  x: number
  y: number
}

interface CompactEntityPosition {
  cx: number
  cy: number
  x: number
  y: number
  w: number
  h: number
  entityIndex: number
}

function trimTextToWidth(text: string, maxWidth: number, fontSize = 12) {
  if (textWidth(text, fontSize) <= maxWidth) return text
  let result = text
  while (result.length > 1 && textWidth(`${result}...`, fontSize) > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result}...`
}

function rectSideAnchorPoint(rect: CompactEntityPosition, targetX: number, targetY: number): DiagramPoint {
  const dx = targetX - rect.cx
  const dy = targetY - rect.cy
  const halfW = rect.w / 2
  const halfH = rect.h / 2
  const xWeight = Math.abs(dx) / Math.max(halfW, 1)
  const yWeight = Math.abs(dy) / Math.max(halfH, 1)

  if (xWeight >= yWeight) {
    return {
      x: rect.cx + (dx >= 0 ? halfW : -halfW),
      y: rect.cy,
    }
  }

  return {
    x: rect.cx,
    y: rect.cy + (dy >= 0 ? halfH : -halfH),
  }
}

function smartRectPoint(rect: CompactEntityPosition, targetX: number, targetY: number): DiagramPoint {
  return rectSideAnchorPoint(rect, targetX, targetY)
}

function compactRoute(start: DiagramPoint, end: DiagramPoint): DiagramPoint[] {
  const dx = Math.abs(end.x - start.x)
  const dy = Math.abs(end.y - start.y)
  if (dx < 8 || dy < 8) return [start, end]

  if (dx > dy) {
    const midX = (start.x + end.x) / 2
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
  }

  const midY = (start.y + end.y) / 2
  return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
}

function compactRelationshipLabelSvg(rel: RenderRelationship, x: number, y: number, maxWidth = 140) {
  const label = rel.label || '关联'
  const width = Math.max(54, Math.min(maxWidth, textWidth(label, 12) + 14))
  if (editingRelationshipLabel === rel.sourceIndex) {
    return inlineInputSvg('er-inline-relation-input', x - width / 2, y - 11, width, 22, label, { relIndex: rel.sourceIndex })
  }

  return `<g class="editable-er-relationship-label" data-rel-index="${rel.sourceIndex}" style="cursor:text;">
    <rect x="${x - width / 2}" y="${y - 11}" width="${width}" height="22" fill="${erStyle.value.edgeLabelBackground}" opacity="0.92"/>
    <text class="edge-label" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" pointer-events="none">${esc(trimTextToWidth(label, width - 12, 12))}</text>
  </g>`
}

function generateCompactERSVG(entities: RenderEntity[], relationships: RenderRelationship[]): string {
  const dragMargin = 140
  const canvasPad = 60
  const gapX = 110
  const gapY = 96
  const headerH = 34
  const attrRowH = 22
  const footerPad = 12
  const columns = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(entities.length))))
  const rows = Math.ceil(entities.length / columns)

  const degree = new Map<string, number>()
  relationships.forEach((rel) => {
    degree.set(rel.from, (degree.get(rel.from) || 0) + 1)
    degree.set(rel.to, (degree.get(rel.to) || 0) + 1)
  })

  const ordered = entities
    .map((entity, entityIndex) => ({ entity, entityIndex }))
    .sort((a, b) => {
      const degreeDiff = (degree.get(b.entity.name) || 0) - (degree.get(a.entity.name) || 0)
      return degreeDiff || a.entityIndex - b.entityIndex
    })

  const sizes = ordered.map(({ entity }) => {
    const maxText = Math.max(
      textWidth(entity.name, 13),
      ...entity.attributes.map((attr) => textWidth(`${attr.isPK ? 'PK ' : ''}${attr.name}`, 12))
    )
    const w = Math.max(180, Math.min(300, maxText + 38))
    const h = headerH + Math.max(1, entity.attributes.length) * attrRowH + footerPad
    return { w, h }
  })

  const colWidths = Array.from({ length: columns }, () => 0)
  const rowHeights = Array.from({ length: rows }, () => 0)
  sizes.forEach((size, index) => {
    const row = Math.floor(index / columns)
    const col = index % columns
    colWidths[col] = Math.max(colWidths[col], size.w)
    rowHeights[row] = Math.max(rowHeights[row], size.h)
  })

  const gridW = colWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, columns - 1) * gapX
  const gridH = rowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, rows - 1) * gapY
  const totalW = gridW + (dragMargin + canvasPad) * 2
  const totalH = gridH + (dragMargin + canvasPad) * 2
  const startX = dragMargin + canvasPad
  const startY = dragMargin + canvasPad
  const entityPositions = new Map<string, CompactEntityPosition>()

  let cursorY = startY
  for (let row = 0; row < rows; row++) {
    let cursorX = startX
    for (let col = 0; col < columns; col++) {
      const orderIndex = row * columns + col
      const item = ordered[orderIndex]
      const size = sizes[orderIndex]
      if (item && size) {
        const cx = cursorX + colWidths[col] / 2 + item.entity.offsetX
        const cy = cursorY + rowHeights[row] / 2 + item.entity.offsetY
        entityPositions.set(item.entity.name, {
          cx,
          cy,
          x: cx - size.w / 2,
          y: cy - size.h / 2,
          w: size.w,
          h: size.h,
          entityIndex: item.entityIndex,
        })
      }
      cursorX += colWidths[col] + gapX
    }
    cursorY += rowHeights[row] + gapY
  }

  let relationLines = ''
  let relationLabels = ''
  relationships.forEach((rel, relOrderIndex) => {
    const fromPos = entityPositions.get(rel.from)
    const toPos = entityPositions.get(rel.to)
    if (!fromPos || !toPos) return

    const [fromCard, toCard] = rel.cardinality.split(':')
    if (fromPos === toPos) {
      const loopX = fromPos.x + fromPos.w
      const loopY = fromPos.cy
      const labelX = loopX + 48 + rel.offsetX
      const labelY = loopY - 44 + rel.offsetY
      relationLines += `<path class="edge-line" d="M ${loopX} ${loopY - 14} C ${loopX + 78} ${loopY - 72}, ${loopX + 78} ${loopY + 54}, ${loopX} ${loopY + 16}"/>`
      relationLabels += compactRelationshipLabelSvg(rel, labelX, labelY)
      const fromPoint = cardinalityPoint(rel, 'from', loopX + 34, loopY - 22)
      const toPoint = cardinalityPoint(rel, 'to', loopX + 34, loopY + 22)
      if (editingCardinality?.relIndex === rel.sourceIndex && editingCardinality.side === 'from') {
        relationLabels += inlineInputSvg('er-inline-cardinality-input', fromPoint.x - 22, fromPoint.y - 12, 44, 24, fromCard || '1', { relIndex: rel.sourceIndex, side: 'from' })
      } else {
        relationLabels += cardinalityTextSvg(rel.sourceIndex, 'from', fromPoint.x, fromPoint.y, fromCard || '1')
      }
      if (editingCardinality?.relIndex === rel.sourceIndex && editingCardinality.side === 'to') {
        relationLabels += inlineInputSvg('er-inline-cardinality-input', toPoint.x - 22, toPoint.y - 12, 44, 24, toCard || 'N', { relIndex: rel.sourceIndex, side: 'to' })
      } else {
        relationLabels += cardinalityTextSvg(rel.sourceIndex, 'to', toPoint.x, toPoint.y, toCard || 'N')
      }
      return
    }

    const start = smartRectPoint(fromPos, toPos.cx, toPos.cy)
    const end = smartRectPoint(toPos, fromPos.cx, fromPos.cy)
    const route = compactRoute(start, end)
    const routePoints = route.map((point) => `${point.x},${point.y}`).join(' ')
    const labelX = (start.x + end.x) / 2 + rel.offsetX
    const labelY = (start.y + end.y) / 2 + rel.offsetY + (relOrderIndex % 3 - 1) * 14
    const fromCardX = start.x + (toPos.cx - start.x) * 0.18
    const fromCardY = start.y + (toPos.cy - start.y) * 0.18
    const toCardX = end.x + (fromPos.cx - end.x) * 0.18
    const toCardY = end.y + (fromPos.cy - end.y) * 0.18

    relationLines += `<polyline class="edge-line" points="${routePoints}"/>`
    relationLabels += compactRelationshipLabelSvg(rel, labelX, labelY)
    const fromPoint = cardinalityPoint(rel, 'from', fromCardX, fromCardY)
    const toPoint = cardinalityPoint(rel, 'to', toCardX, toCardY)
    if (editingCardinality?.relIndex === rel.sourceIndex && editingCardinality.side === 'from') {
      relationLabels += inlineInputSvg('er-inline-cardinality-input', fromPoint.x - 22, fromPoint.y - 12, 44, 24, fromCard || '1', { relIndex: rel.sourceIndex, side: 'from' })
    } else {
      relationLabels += cardinalityTextSvg(rel.sourceIndex, 'from', fromPoint.x, fromPoint.y, fromCard || '1')
    }
    if (editingCardinality?.relIndex === rel.sourceIndex && editingCardinality.side === 'to') {
      relationLabels += inlineInputSvg('er-inline-cardinality-input', toPoint.x - 22, toPoint.y - 12, 44, 24, toCard || 'N', { relIndex: rel.sourceIndex, side: 'to' })
    } else {
      relationLabels += cardinalityTextSvg(rel.sourceIndex, 'to', toPoint.x, toPoint.y, toCard || 'N')
    }
  })

  let entityShapes = ''
  ordered.forEach(({ entity, entityIndex }) => {
    const pos = entityPositions.get(entity.name)
    if (!pos) return

    entityShapes += `<g class="draggable-er-node" data-kind="entity" data-entity-index="${entityIndex}" style="cursor:move;">`
    entityShapes += `<rect class="node-rect" x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" rx="0"/>`
    entityShapes += `<line class="edge-line" x1="${pos.x}" y1="${pos.y + headerH}" x2="${pos.x + pos.w}" y2="${pos.y + headerH}"/>`
    entityShapes += `<text class="node-label" x="${pos.cx}" y="${pos.y + headerH / 2}" font-weight="bold">${esc(trimTextToWidth(entity.name, pos.w - 22, 13))}</text>`

    entity.attributes.forEach((attr, attrIndex) => {
      const rowY = pos.y + headerH + attrRowH * attrIndex
      const textY = rowY + attrRowH / 2
      const isEditing = editingAttribute?.entityIndex === entityIndex && editingAttribute?.attrIndex === attrIndex
      entityShapes += `<g class="editable-er-attribute" data-entity-index="${entityIndex}" data-attr-index="${attrIndex}" style="cursor:text;">`
      entityShapes += `<rect x="${pos.x}" y="${rowY}" width="${pos.w}" height="${attrRowH}" fill="#fff" opacity="0"/>`
      if (isEditing) {
        entityShapes += inlineInputSvg(
          'er-inline-attr-input',
          pos.x + 10,
          rowY + 2,
          pos.w - 20,
          attrRowH - 4,
          attr.name,
          { entityIndex, attrIndex }
        )
      } else {
        const className = attr.isPK ? 'node-label-pk' : 'node-label'
        const label = `${attr.isPK ? 'PK ' : ''}${attr.name}`
        entityShapes += `<text class="${className}" x="${pos.x + 12}" y="${textY}" text-anchor="start" font-size="12" style="text-anchor:start;">${esc(trimTextToWidth(label, pos.w - 24, 12))}</text>`
      }
      entityShapes += `</g>`
    })

    entityShapes += `</g>`
  })

  return buildSvg(totalW, totalH, relationLines + entityShapes + relationLabels) + '</svg>'
}

function generateERSVG(sourceEntities: RenderEntity[], sourceRelationships: RenderRelationship[]): string {
  const style = erStyle.value
  const layoutMode = erLayoutMode.value
  const entities = sourceEntities.map((entity) => ({
    ...entity,
    attributes: style.showAttributes ? entity.attributes : [],
  }))
  const relationships = style.showRelationships ? sourceRelationships : []
  const dragMargin = layoutMode === 'top'
    ? 260
    : layoutMode === 'balanced'
      ? 220
      : layoutMode === 'vertical'
        ? 180
        : 150
  const attrH = style.attributeHeight
  const entityH = style.entityHeight
  const diamondW = style.relationshipWidth
  const diamondH = style.relationshipHeight
  const maxPerRing = 12
  const densityScale = styleDensityScale()
  const gridGapX = Math.round((layoutMode === 'wide' ? 210 : 120) * densityScale)
  const gridGapY = Math.round((layoutMode === 'vertical' ? 190 : 110) * densityScale)
  const columns = getClassicColumnCount(entities.length, layoutMode)
  const rows = Math.ceil(entities.length / columns)

  interface ClassicEntityPosition extends CompactEntityPosition {
    attrs: { name: string; isPK: boolean; ax: number; ay: number; aw: number; ah: number; attrIndex: number }[]
  }

  function getClassicColumnCount(count: number, mode: ERLayoutMode) {
    if (count <= 0) return 1
    if (mode === 'vertical') return 1
    if (mode === 'wide') return Math.min(6, count)
    if (count <= 2) return Math.max(1, count)
    return Math.min(5, Math.ceil(Math.sqrt(count)))
  }

  function relationshipPresetOffset(pairIndex: number, pairCount: number): DiagramPoint {
    const stack = pairIndex - (pairCount - 1) / 2
    const x = Math.round(stack * 30)
    if (layoutMode === 'balanced') return { x, y: Math.round(120 * densityScale) }
    if (layoutMode === 'top') return { x, y: -Math.round(155 * densityScale) }
    return { x: 0, y: 0 }
  }

  function classicEntityFootprint(entity: RenderEntity) {
    const rings = Math.max(1, Math.ceil(entity.attributes.length / maxPerRing))
    const widestAttr = entity.attributes.reduce(
      (max, attr) => Math.max(max, style.autoAttributeWidth ? textWidth(attr.name, style.fontSize - 1) + 20 : style.attributeWidth),
      style.attributeWidth
    )
    const entityW = Math.max(style.entityWidth, textWidth(entity.name, style.fontSize) + 26)
    if (style.attributeLayout === 'vertical') {
      const attrStackH = entity.attributes.length * (attrH + 16)
      return {
        entityW,
        cellW: Math.max(300, Math.max(entityW, widestAttr) + 120),
        cellH: Math.max(260, entityH + attrStackH + 120),
      }
    }
    const ringRx = Math.max(120, style.entityWidth + 40) + style.attributeLinkLength + (rings - 1) * 78
    const ringRy = Math.max(92, style.entityHeight + 48) + style.attributeLinkLength + (rings - 1) * 56
    return {
      entityW,
      cellW: Math.max(360, ringRx * 2 + widestAttr + 44),
      cellH: Math.max(310, ringRy * 2 + attrH + entityH + 64),
    }
  }

  function attributeOffset(index: number, total: number) {
    const ring = Math.floor(index / maxPerRing)
    const ringStart = ring * maxPerRing
    const ringCount = Math.max(1, Math.min(maxPerRing, total - ringStart))
    const angle = -Math.PI / 2 + (Math.PI * 2 * (index - ringStart)) / ringCount
    const rx = 160 + ring * 78
    const ry = 118 + ring * 56
    return {
      x: Math.round(Math.cos(angle) * rx),
      y: Math.round(Math.sin(angle) * ry),
    }
  }

  function diamondBoundaryPoint(cx: number, cy: number, w: number, h: number, targetX: number, targetY: number): DiagramPoint {
    const dx = targetX - cx
    const dy = targetY - cy
    const scale = Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2)
    if (!scale) return { x: cx, y: cy }
    return {
      x: cx + dx / scale,
      y: cy + dy / scale,
    }
  }

  function ellipseBoundaryPoint(cx: number, cy: number, rx: number, ry: number, targetX: number, targetY: number): DiagramPoint {
    const dx = targetX - cx
    const dy = targetY - cy
    const scale = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry))
    if (!scale) return { x: cx, y: cy }
    return {
      x: cx + dx / scale,
      y: cy + dy / scale,
    }
  }

  function relationshipBoundaryPoint(cx: number, cy: number, w: number, h: number, targetX: number, targetY: number): DiagramPoint {
    if (style.relationshipShape === 'diamond') return diamondBoundaryPoint(cx, cy, w, h, targetX, targetY)
    return smartRectPoint({ cx, cy, x: cx - w / 2, y: cy - h / 2, w, h, entityIndex: -1 }, targetX, targetY)
  }

  function attributeBoundaryPoint(attr: ClassicEntityPosition['attrs'][number], targetX: number, targetY: number): DiagramPoint {
    if (style.attributeShape === 'ellipse') return ellipseBoundaryPoint(attr.ax, attr.ay, attr.aw / 2, attr.ah / 2, targetX, targetY)
    return smartRectPoint({ cx: attr.ax, cy: attr.ay, x: attr.ax - attr.aw / 2, y: attr.ay - attr.ah / 2, w: attr.aw, h: attr.ah, entityIndex: -1 }, targetX, targetY)
  }

  const degree = new Map<string, number>()
  const relationRole = new Map<string, number>()
  relationships.forEach((rel) => {
    degree.set(rel.from, (degree.get(rel.from) || 0) + 1)
    degree.set(rel.to, (degree.get(rel.to) || 0) + 1)
    relationRole.set(rel.from, (relationRole.get(rel.from) || 0) + 1)
    relationRole.set(rel.to, (relationRole.get(rel.to) || 0) - 1)
  })

  const rankedEntities = entities
    .map((entity, entityIndex) => ({ entity, entityIndex }))
    .sort((a, b) => {
      if (entities.length <= 2 && relationships.length) {
        const roleDiff = (relationRole.get(a.entity.name) || 0) - (relationRole.get(b.entity.name) || 0)
        if (roleDiff) return roleDiff
      }
      const degreeDiff = (degree.get(b.entity.name) || 0) - (degree.get(a.entity.name) || 0)
      return degreeDiff || a.entityIndex - b.entityIndex
    })
  const centerRow = (rows - 1) / 2
  const centerCol = (columns - 1) / 2
  const slots = Array.from({ length: rows * columns }, (_, index) => ({
    row: Math.floor(index / columns),
    col: index % columns,
  })).sort((a, b) => {
    const distanceA = Math.abs(a.row - centerRow) + Math.abs(a.col - centerCol)
    const distanceB = Math.abs(b.row - centerRow) + Math.abs(b.col - centerCol)
    return distanceA - distanceB || a.row - b.row || a.col - b.col
  })
  const placements = rankedEntities.map((item, index) => ({
    ...item,
    ...slots[index]!,
    size: classicEntityFootprint(item.entity),
  }))
  const colWidths = Array.from({ length: columns }, () => 0)
  const rowHeights = Array.from({ length: rows }, () => 0)
  placements.forEach((placement) => {
    colWidths[placement.col] = Math.max(colWidths[placement.col], placement.size.cellW)
    rowHeights[placement.row] = Math.max(rowHeights[placement.row], placement.size.cellH)
  })

  const gridW = colWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, columns - 1) * gridGapX
  const gridH = rowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, rows - 1) * gridGapY
  const totalW = Math.max(760, gridW + dragMargin * 2)
  const totalH = Math.max(560, gridH + dragMargin * 2)
  const startX = dragMargin
  const startY = dragMargin
  const entityPositions = new Map<string, ClassicEntityPosition>()
  const placementMap = new Map<string, typeof placements[number]>()
  placements.forEach((placement) => {
    placementMap.set(`${placement.row}:${placement.col}`, placement)
  })

  let cursorY = startY
  for (let row = 0; row < rows; row++) {
    let cursorX = startX
    for (let col = 0; col < columns; col++) {
      const item = placementMap.get(`${row}:${col}`)
      if (item) {
        const cx = cursorX + colWidths[col] / 2 + item.entity.offsetX
        const cy = cursorY + rowHeights[row] / 2 + item.entity.offsetY
        const attrs = item.entity.attributes.map((attr, ai) => {
          const offset = attributeOffset(ai, item.entity.attributes.length)
          const attrCount = Math.max(1, item.entity.attributes.length)
          const verticalStartY = cy + entityH / 2 + 48 - ((attrCount - 1) * (attrH + 16)) / 2
          const ax = (style.attributeLayout === 'vertical' ? cx : cx + offset.x) + attr.offsetX
          const ay = (style.attributeLayout === 'vertical' ? verticalStartY + ai * (attrH + 16) : cy + offset.y) + attr.offsetY
          const aw = style.autoAttributeWidth
            ? Math.max(style.attributeWidth, textWidth(attr.name, Math.max(10, style.fontSize - 1)) + 20)
            : style.attributeWidth
          return { name: attr.name, isPK: attr.isPK, ax, ay, aw, ah: attrH, attrIndex: ai }
        })
        entityPositions.set(item.entity.name, {
          cx,
          cy,
          x: cx - item.size.entityW / 2,
          y: cy - entityH / 2,
          w: item.size.entityW,
          h: entityH,
          entityIndex: item.entityIndex,
          attrs,
        })
      }
      cursorX += colWidths[col] + gridGapX
    }
    cursorY += rowHeights[row] + gridGapY
  }

  const pairCounts = new Map<string, number>()
  const pairIndexes = new Map<string, number>()
  relationships.forEach((rel) => {
    const key = [rel.from, rel.to].sort().join('__')
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1)
  })

  let relationLines = ''
  let relationLabels = ''
  let relationShapes = ''
  relationships.forEach((rel) => {
    const fromPos = entityPositions.get(rel.from)
    const toPos = entityPositions.get(rel.to)
    if (!fromPos || !toPos) return

    const pairKey = [rel.from, rel.to].sort().join('__')
    const pairIndex = pairIndexes.get(pairKey) || 0
    pairIndexes.set(pairKey, pairIndex + 1)
    const pairCount = pairCounts.get(pairKey) || 1
    const [fromCard, toCard] = rel.cardinality.split(':')

    let dcx = 0
    let dcy = 0
    const presetOffset = relationshipPresetOffset(pairIndex, pairCount)
    if (fromPos === toPos) {
      dcx = fromPos.x + fromPos.w + 94 + presetOffset.x + rel.offsetX
      dcy = fromPos.cy + presetOffset.y + rel.offsetY
    } else {
      const dx = toPos.cx - fromPos.cx
      const dy = toPos.cy - fromPos.cy
      const distance = Math.sqrt(dx * dx + dy * dy) || 1
      const normalX = -dy / distance
      const normalY = dx / distance
      const spread = (pairIndex - (pairCount - 1) / 2) * 40
      dcx = (fromPos.cx + toPos.cx) / 2 + normalX * spread + presetOffset.x + rel.offsetX
      dcy = (fromPos.cy + toPos.cy) / 2 + normalY * spread + presetOffset.y + rel.offsetY
    }

    const fromStart = fromPos === toPos
      ? { x: fromPos.x + fromPos.w, y: fromPos.cy - 14 }
      : (style.smartConnect ? smartRectPoint(fromPos, dcx, dcy) : { x: fromPos.cx, y: fromPos.cy })
    const toStart = fromPos === toPos
      ? { x: toPos.x + toPos.w, y: toPos.cy + 14 }
      : (style.smartConnect ? smartRectPoint(toPos, dcx, dcy) : { x: toPos.cx, y: toPos.cy })
    const fromEnd = relationshipBoundaryPoint(dcx, dcy, diamondW, diamondH, fromStart.x, fromStart.y)
    const toEnd = relationshipBoundaryPoint(dcx, dcy, diamondW, diamondH, toStart.x, toStart.y)
    const fromCardX = fromStart.x + (fromEnd.x - fromStart.x) * 0.48
    const fromCardY = fromStart.y + (fromEnd.y - fromStart.y) * 0.48 - 4
    const toCardX = toStart.x + (toEnd.x - toStart.x) * 0.48
    const toCardY = toStart.y + (toEnd.y - toStart.y) * 0.48 - 4

    relationLines += `<line class="edge-line" x1="${fromStart.x}" y1="${fromStart.y}" x2="${fromEnd.x}" y2="${fromEnd.y}"/>`
    relationLines += `<line class="edge-line" x1="${toStart.x}" y1="${toStart.y}" x2="${toEnd.x}" y2="${toEnd.y}"/>`
    if (style.showRelationText) {
      const fromPoint = cardinalityPoint(rel, 'from', fromCardX, fromCardY)
      const toPoint = cardinalityPoint(rel, 'to', toCardX, toCardY)
      if (editingCardinality?.relIndex === rel.sourceIndex && editingCardinality.side === 'from') {
        relationLabels += inlineInputSvg('er-inline-cardinality-input', fromPoint.x - 22, fromPoint.y - 12, 44, 24, fromCard || '1', { relIndex: rel.sourceIndex, side: 'from' })
      } else {
        relationLabels += cardinalityTextSvg(rel.sourceIndex, 'from', fromPoint.x, fromPoint.y, fromCard || '1')
      }
      if (editingCardinality?.relIndex === rel.sourceIndex && editingCardinality.side === 'to') {
        relationLabels += inlineInputSvg('er-inline-cardinality-input', toPoint.x - 22, toPoint.y - 12, 44, 24, toCard || 'N', { relIndex: rel.sourceIndex, side: 'to' })
      } else {
        relationLabels += cardinalityTextSvg(rel.sourceIndex, 'to', toPoint.x, toPoint.y, toCard || 'N')
      }
    }

    relationShapes += `<g class="draggable-er-node" data-kind="relationship" data-rel-index="${rel.sourceIndex}" style="cursor:move;">`
    if (style.relationshipShape === 'rect') {
      relationShapes += `<rect class="node-rect er-relationship-shape" x="${dcx - diamondW / 2}" y="${dcy - diamondH / 2}" width="${diamondW}" height="${diamondH}" rx="${style.rectRadius}"/>`
    } else {
      relationShapes += `<polygon class="node-diamond er-relationship-shape" points="${dcx},${dcy - diamondH / 2} ${dcx + diamondW / 2},${dcy} ${dcx},${dcy + diamondH / 2} ${dcx - diamondW / 2},${dcy}"/>`
    }
    if (editingRelationshipLabel === rel.sourceIndex) {
      relationShapes += inlineInputSvg('er-inline-relation-input', dcx - diamondW / 2 + 8, dcy - 10, diamondW - 16, 20, rel.label || '关联', { relIndex: rel.sourceIndex })
    } else {
      relationShapes += `<text class="node-label" x="${dcx}" y="${dcy}" font-size="11">${esc(rel.label || '关联')}</text>`
    }
    relationShapes += `</g>`
  })

  let attrLines = ''
  let entityShapes = ''
  let attrShapes = ''
  entityPositions.forEach((pos, name) => {
    pos.attrs.forEach((attr) => {
      const entityEdge = style.smartConnect ? smartRectPoint(pos, attr.ax, attr.ay) : { x: pos.cx, y: pos.cy }
      const attrEdge = style.smartConnect ? attributeBoundaryPoint(attr, pos.cx, pos.cy) : { x: attr.ax, y: attr.ay }
      attrLines += `<line class="edge-line" x1="${entityEdge.x}" y1="${entityEdge.y}" x2="${attrEdge.x}" y2="${attrEdge.y}"/>`
      attrShapes += `<g class="draggable-er-node" data-kind="attribute" data-entity-index="${pos.entityIndex}" data-attr-index="${attr.attrIndex}" style="cursor:move;">`
      if (style.attributeShape === 'rect') {
        attrShapes += `<rect class="node-rect er-attribute-shape" x="${attr.ax - attr.aw / 2}" y="${attr.ay - attr.ah / 2}" width="${attr.aw}" height="${attr.ah}" rx="${style.rectRadius}"/>`
      } else {
        attrShapes += `<ellipse class="node-ellipse er-attribute-shape" cx="${attr.ax}" cy="${attr.ay}" rx="${attr.aw / 2}" ry="${attr.ah / 2}"/>`
      }
      const isEditing = editingAttribute?.entityIndex === pos.entityIndex && editingAttribute?.attrIndex === attr.attrIndex
      if (isEditing) {
        attrShapes += inlineInputSvg(
          'er-inline-attr-input',
          attr.ax - attr.aw / 2 + 6,
          attr.ay - attr.ah / 2 + 3,
          attr.aw - 12,
          attr.ah - 6,
          attr.name,
          { entityIndex: pos.entityIndex, attrIndex: attr.attrIndex }
        )
      } else {
        attrShapes += attr.isPK
          ? `<text class="node-label-pk" x="${attr.ax}" y="${attr.ay}" font-size="12">${esc(attr.name)}</text>`
          : `<text class="node-label" x="${attr.ax}" y="${attr.ay}" font-size="12">${esc(attr.name)}</text>`
      }
      attrShapes += `</g>`
    })

    entityShapes += `<g class="draggable-er-node" data-kind="entity" data-entity-index="${pos.entityIndex}" style="cursor:move;">`
    entityShapes += `<rect class="node-rect er-entity-shape" x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${entityH}" rx="${style.rectRadius}"/>`
    entityShapes += `<text class="node-label" x="${pos.cx}" y="${pos.cy}" font-weight="bold">${esc(name)}</text>`
    entityShapes += `</g>`
  })

  return buildSvg(totalW, totalH, erSvgStyleTag() + `<g class="er-diagram-root">${attrLines + relationLines + entityShapes + attrShapes + relationShapes + relationLabels}</g>`) + '</svg>'
}

function loadExample() {
  erLayoutMode.value = 'default'
  inputMode.value = 'sql'
  sqlText.value = exampleSqlText()
  customEntityVisibility.value = false
  visibleEntityNames.value = []
  draftVisibleEntityNames.value = []
  editingAttribute = null
  editingRelationshipLabel = null
  editingCardinality = null
  entities.value = [
    createEntity('班级', [
      { name: '班级ID', isPK: true },
      { name: '班级名称', isPK: false },
      { name: '创建时间', isPK: false },
      { name: '更新时间', isPK: false },
    ]),
    createEntity('学生', [
      { name: '学生ID', isPK: true },
      { name: '学生姓名', isPK: false },
      { name: 'birthdate', isPK: false },
      { name: '班级ID', isPK: false },
      { name: '创建时间', isPK: false },
      { name: '更新时间', isPK: false },
    ]),
  ]
  relationships.value = [
    createRelationship('班级', '学生', '1:N', '关联'),
  ]
}

function exampleSqlText() {
  return `-- 班级表
CREATE TABLE \`t_class_info\` (
  \`class_id\` int(11) NOT NULL AUTO_INCREMENT COMMENT '班级ID',
  \`class_name\` varchar(50) NOT NULL DEFAULT '' COMMENT '班级名称',
  \`create_time\` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  \`update_time\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (\`class_id\`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 COMMENT = '班级';

-- 学生表
CREATE TABLE \`t_student\` (
  \`student_id\` int(11) NOT NULL AUTO_INCREMENT COMMENT '学生ID',
  \`student_name\` varchar(50) NOT NULL COMMENT '学生姓名',
  \`birthdate\` timestamp NULL DEFAULT NULL,
  \`class_id\` int(11) NULL DEFAULT NULL COMMENT '班级ID',
  \`create_time\` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  \`update_time\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (\`student_id\`) USING BTREE,
  CONSTRAINT \`fk_student_class\` FOREIGN KEY (\`class_id\`) REFERENCES \`t_class_info\` (\`class_id\`) ON DELETE SET NULL
) ENGINE = InnoDB AUTO_INCREMENT = 1 COMMENT = '学生';`
}

function clearAll() {
  erLayoutMode.value = 'default'
  inputMode.value = 'sql'
  sqlText.value = ''
  customEntityVisibility.value = false
  visibleEntityNames.value = []
  draftVisibleEntityNames.value = []
  editingAttribute = null
  editingRelationshipLabel = null
  editingCardinality = null
  entities.value = []
  relationships.value = []
  if (previewEl.value) previewEl.value.innerHTML = ''
}

async function exportPng() {
  if (!previewEl.value) return
  await exportToPng(previewEl.value, 'ER图')
  ElMessage.success('PNG导出成功')
}

async function exportSvg() {
  if (!previewEl.value) return
  await exportToSvg(previewEl.value, 'ER图')
  ElMessage.success('SVG导出成功')
}

async function copySource() {
  const svg = previewEl.value?.innerHTML || ''
  await copyToClipboard(svg)
  ElMessage.success('SVG源码已复制')
}

function openDrawIo() {
  window.open('https://app.diagrams.net/', '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  loadStoredStyle()
  const cached = readDiagramStorage('diagram:er')
  if (cached) {
    try {
      const data = JSON.parse(cached)
      let nextId = Date.now()
      if (data.entities) {
        entities.value = data.entities.map((e: any) => ({
          id: nextId++,
          name: e.name,
          attributes: (e.attributes || []).map((a: any) => ({
            id: nextId++,
            name: a.name,
            isPK: a.isPK || false,
            offsetX: 0,
            offsetY: 0,
          })),
          offsetX: 0,
          offsetY: 0,
        }))
      }
      if (data.relationships) {
        relationships.value = data.relationships.map((r: any) => ({
          id: nextId++,
          from: r.from,
          to: r.to,
          label: r.label || '',
          cardinality: r.cardinality || '',
          offsetX: 0,
          offsetY: 0,
          fromCardOffsetX: r.fromCardOffsetX || 0,
          fromCardOffsetY: r.fromCardOffsetY || 0,
          toCardOffsetX: r.toCardOffsetX || 0,
          toCardOffsetY: r.toCardOffsetY || 0,
        }))
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
:global(.diagram-left) {
  min-height: 0;
}

:global(.diagram-left .input-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:global(.diagram-left .input-card > .el-card__body) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.er-editor {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  padding-right: 4px;
}

.er-editor .editor-hint {
  color: var(--t3);
  font-size: 12px;
  line-height: 1.6;
  padding: 4px 0 2px;
}

.er-editor :deep(.el-tabs) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.er-editor :deep(.el-tabs__header) {
  flex: 0 0 auto;
  margin-bottom: 10px;
}

.er-editor :deep(.el-tabs__content) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.er-editor :deep(.el-tab-pane) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.er-input-panels,
.er-input-panel {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.er-sql-section {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:global(.input-card:has(.er-editor) .input-toolbar-actions) {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

:global(.input-card:has(.er-editor) .input-toolbar-actions .el-button) {
  padding-left: 8px;
  padding-right: 8px;
}

.er-editor-topbar {
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

.er-mode-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.er-toolbar-label {
  flex: 0 0 auto;
  color: var(--t3);
  font-size: 12px;
  font-weight: 600;
}

.er-input-actions {
  display: grid;
  grid-template-columns: minmax(80px, 1fr) minmax(80px, 1fr) minmax(58px, 0.7fr) minmax(98px, 1.15fr);
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid rgba(64, 158, 255, 0.14);
}

.er-input-actions.manual {
  grid-template-columns: minmax(74px, 0.95fr) minmax(82px, 1fr) minmax(104px, 1.3fr) minmax(92px, 1.05fr);
}

.er-input-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.er-input-actions :deep(.el-button) {
  width: 100%;
  min-width: 0;
  padding-left: 10px;
  padding-right: 10px;
}

.er-secondary-actions {
  display: flex;
  flex: 1 1 320px;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.er-secondary-actions :deep(.el-button) {
  min-width: 92px;
  border: 1px solid #c8dcf4;
  background: #ffffff;
  color: #315b86;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(42, 91, 142, 0.06);
}

.er-secondary-actions :deep(.el-button:hover) {
  border-color: #409eff;
  background: #eef6ff;
  color: #1677d2;
}

.er-secondary-actions :deep(.el-button.is-disabled) {
  border-color: #dde6f2;
  background: #f4f7fb;
  color: #9aa8ba;
  box-shadow: none;
}

.er-secondary-actions :deep(.er-action-button.strong) {
  border-color: #9dccff;
  background: #eaf4ff;
  color: #1f73c9;
}

.er-secondary-actions :deep(.er-action-button.success) {
  border-color: #b8e3a9;
  background: #f0faeb;
  color: #48a723;
}

.er-secondary-actions :deep(.er-action-button.danger) {
  border-color: #f1d3d3;
  color: #b65353;
}

.er-input-actions :deep(.er-generate-button) {
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

.er-input-actions :deep(.er-generate-button:hover),
.er-input-actions :deep(.er-generate-button:focus) {
  border-color: #2f8df0 !important;
  background: #2f8df0 !important;
  color: #fff !important;
}

.er-input-actions :deep(.er-generate-button.is-disabled) {
  --el-button-disabled-bg-color: #d8ebff;
  --el-button-disabled-border-color: #bfdcff;
  --el-button-disabled-text-color: #fff;
  border-color: #bfdcff !important;
  background: #d8ebff !important;
  color: #fff !important;
  box-shadow: none;
}

.er-mode-tabs {
  display: flex;
  gap: 0;
  border: 1px solid #bfd8f7;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(64, 158, 255, 0.08);
}

.er-mode-tab {
  border: none;
  background: transparent;
  padding: 7px 16px;
  font-size: 13px;
  font-family: 'SimSun', '宋体', 'Songti SC', serif;
  cursor: pointer;
  color: var(--t2);
  transition: all 0.2s var(--ease);
}

.er-mode-tab + .er-mode-tab {
  border-left: 1px solid #dbe8f7;
}

.er-mode-tab:last-child {
  border-right: none;
}

.er-mode-tab:hover {
  background: #eef6ff;
  color: #2478d4;
}

.er-mode-tab.active {
  background: #409eff;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
}

.er-manual-editor {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.er-manual-tabs-card {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.er-manual-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.24);
}

.er-manual-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.er-manual-tabs {
  display: flex;
  gap: 28px;
  height: 34px;
  border-bottom: 1px solid #d8e1ef;
}

.er-manual-tab {
  position: relative;
  border: none;
  background: transparent;
  padding: 0 0 10px;
  color: #1f2937;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.er-manual-tab.active {
  color: var(--el-color-primary, #409eff);
}

.er-manual-tab.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--el-color-primary, #409eff);
}

.er-manual-panel {
  flex: 1 1 auto;
  min-height: 0;
  border: var(--border-subtle);
  background: rgba(255, 255, 255, 0.4);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.er-manual-panel :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: 3px;
  background: #fff;
  box-shadow: inset 0 0 0 1px #d8e1ef;
  transition: box-shadow 0.16s ease, background 0.16s ease;
}

.er-manual-panel :deep(.el-input__wrapper:hover) {
  box-shadow: inset 0 0 0 1px #b8c7dc;
}

.er-manual-panel :deep(.el-input__wrapper.is-focus) {
  box-shadow: inset 0 0 0 1px var(--el-color-primary, #409eff);
}

.er-manual-panel :deep(.el-input__inner) {
  height: 30px;
  line-height: 30px;
}

.er-manual-panel-head {
  gap: 12px;
  flex: 0 0 auto;
  margin-bottom: 0;
  color: var(--t1);
  background: rgba(255, 255, 255, 0.36);
}

.er-manual-panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.er-text-action {
  border: none;
  background: transparent;
  color: var(--el-color-primary, #409eff);
  font-size: 14px;
  cursor: pointer;
  padding: 0;
}

.er-text-action.success {
  color: #55b832;
  font-weight: 700;
}

.er-entity-list,
.er-relation-list {
  flex: 1 1 auto;
  min-height: 0;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid #e1e8f3;
  border-top: 0;
  background: rgba(255, 255, 255, 0.76);
}

.er-entity-block {
  flex: 0 0 auto;
  border: 1px solid #e5edf7;
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}

.er-entity-block:hover {
  border-color: #d7e5f6;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.er-entity-block.collapsed {
  background: #f5f7fb;
}

.er-entity-line {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 34px 34px;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 6px 8px 6px 12px;
  background: #fbfdff;
}

.er-collapse-toggle {
  border: none;
  background: transparent;
  color: var(--el-color-primary, #409eff);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.er-inline-action {
  width: 28px;
  height: 28px;
  border: 1px solid #dcdfe6;
  border-radius: 0;
  background: #fff;
  color: #111827;
  font-family: Arial, sans-serif;
  font-size: 15px;
  font-weight: 400;
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
  line-height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.er-inline-action:hover {
  border-color: #b8c7dc;
  background: #f8fafc;
  color: #111827;
}

.er-inline-action:active {
  background: #eef2f7;
}

.er-delete-action {
  width: 28px;
  height: 28px;
  border: 1px solid #ffd7d7;
  border-radius: 4px;
  background: #fff;
  color: #d63031;
  font-size: 15px;
  line-height: 24px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s var(--snappy);
}

.er-delete-action:hover {
  color: #d63031;
  border-color: #d63031;
  background: #fff5f5;
  transform: scale(1.08);
}

.er-delete-action:active {
  transform: scale(0.92);
  transition: all 0.08s var(--snappy);
}

.er-attribute-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 12px 12px 58px;
  background: linear-gradient(90deg, transparent 0 29px, #e5edf7 30px 31px, transparent 32px);
}

.er-attribute-line {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 6px 8px;
  border: 1px solid #edf2f8;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
  transition: border-color 0.16s ease, background 0.16s ease;
}

.er-attribute-line:hover {
  border-color: #d7e5f6;
  background: #fbfdff;
}

.er-pk-badge {
  height: 26px;
  min-width: 46px;
  border: 1px solid #dce6f3;
  border-radius: 4px;
  background: #f9fbff;
  color: #5b6472;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.16s ease;
}

.er-pk-badge:hover {
  border-color: var(--el-color-primary, #409eff);
  color: var(--el-color-primary, #409eff);
  background: #eef6ff;
}

.er-pk-badge.active {
  border-color: #b9dcff;
  background: #eef6ff;
  color: #1677d2;
  font-weight: 700;
}

.er-relation-line {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px minmax(0, 1fr) minmax(0, 1fr) 34px;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 6px 8px;
  border: 1px solid #e5edf7;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}

.er-relation-line:hover {
  border-color: #d7e5f6;
  background: #fbfdff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.er-empty-add {
  flex: 0 0 auto;
  margin: 8px 0 0;
  height: 38px;
  border: 1px dashed #b9c7d8;
  background: #fff;
  color: var(--el-color-primary, #409eff);
  cursor: pointer;
}

:global(.er-theme-dialog.el-dialog) {
  border-radius: 4px !important;
  background: #fff !important;
}

:global(.er-theme-dialog .el-dialog__body) {
  padding-top: 10px !important;
}

.er-theme-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.er-theme-card {
  height: 124px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.er-theme-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
}

.er-theme-card.active {
  border-color: var(--el-color-primary, #409eff);
  box-shadow: 0 0 0 1px var(--el-color-primary, #409eff), 0 8px 18px rgba(64, 158, 255, 0.16);
}

.er-theme-card svg {
  width: 100%;
  height: 100%;
}

:global(.er-visibility-dialog.el-dialog) {
  border-radius: 4px !important;
  background: #fff !important;
}

.er-visibility-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
}

.er-visibility-list {
  height: 318px;
  overflow: auto;
  border: 1px solid #e4e9f2;
  border-radius: 4px;
  padding: 10px 12px;
}

.er-visibility-list :deep(.el-checkbox-group) {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.er-visibility-item {
  display: flex;
  align-items: center;
  min-height: 28px;
}

.er-visibility-item :deep(.el-checkbox) {
  width: 100%;
  margin-right: 0;
  font-weight: 700;
  color: #475467;
}

@media (max-width: 620px) {
  .er-mode-group,
  .er-input-actions {
    align-items: stretch;
  }

  .er-mode-group {
    flex-direction: column;
  }

  .er-input-actions,
  .er-input-actions.manual {
    grid-template-columns: 1fr;
  }

  .er-mode-tabs,
  .er-input-actions :deep(.er-generate-button) {
    width: 100%;
    min-width: 0;
  }

  .er-secondary-actions :deep(.el-button) {
    width: 100%;
  }

  .er-mode-tab {
    flex: 1;
  }

  .er-manual-actions {
    justify-content: stretch;
  }

  .er-manual-actions :deep(.el-button) {
    flex: 1 1 46%;
    margin-left: 0;
  }

  .er-entity-line,
  .er-relation-line {
    grid-template-columns: 1fr;
  }

  .er-collapse-toggle {
    justify-self: start;
  }

  .er-attribute-list {
    padding-left: 18px;
  }

  .er-attribute-line {
    grid-template-columns: 46px minmax(0, 1fr) 34px;
  }

  .er-theme-grid {
    grid-template-columns: 1fr;
  }
}

.sql-editor-panel {
  flex: 1 1 auto;
  min-height: 0;
  max-height: 100%;
  display: flex;
  box-sizing: border-box;
  padding: 10px;
  overflow: hidden;
}

.sql-editor-panel :deep(.el-textarea) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

.sql-editor-panel :deep(.el-textarea__inner) {
  height: 100% !important;
  min-height: 0 !important;
  overflow: auto !important;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.65;
  color: var(--t1);
  background: rgba(255, 255, 255, 0.78);
  border-radius: var(--r-xs);
  resize: none;
}

:global(.er-style-dialog.el-dialog) {
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  margin-bottom: 16px !important;
  overflow: hidden;
  background: #fff !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: 1px solid #dcdfe6 !important;
  border-radius: 4px !important;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.28) !important;
}

:global(.er-style-dialog .el-dialog__header) {
  flex: 0 0 auto;
  padding: 18px 22px 12px !important;
  margin-right: 0 !important;
  border-bottom: 0 !important;
  background: #fff !important;
}

:global(.er-style-dialog .el-dialog__title) {
  font-size: 20px !important;
  font-weight: 500 !important;
  color: #1f2937 !important;
}

:global(.er-style-dialog .el-dialog__body) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 4px 18px 8px 22px !important;
  background: #fff !important;
}

:global(.er-style-dialog .el-dialog__footer) {
  flex: 0 0 auto;
  padding: 10px 18px 16px !important;
  border-top: 1px solid #edf1f6 !important;
  background: #fff !important;
}

.er-style-panel {
  max-height: calc(100vh - 158px);
  overflow-y: auto;
  padding: 0 14px 4px 0;
  background: #fff;
  scrollbar-width: thin;
  scrollbar-color: #d0d7e2 transparent;
}

.er-style-panel::-webkit-scrollbar {
  width: 6px;
}

.er-style-panel::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #d0d7e2;
}

.er-style-switches {
  display: grid;
  gap: 12px;
  padding: 4px 6px 14px;
}

.style-switch-row {
  display: grid;
  grid-template-columns: 86px 48px minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  font-size: 14px;
  color: #3f4656;
}

.style-switch-row em {
  font-style: normal;
  color: #8a93a3;
  font-size: 13px;
}

.style-switch-row.split {
  grid-template-columns: 86px 48px minmax(0, 1fr) 44px 112px;
}

.style-switch-row label {
  color: #606b7c;
  justify-self: end;
}

.style-switch-row :deep(.el-input-number) {
  width: 112px;
}

.style-section {
  position: relative;
  padding: 16px 6px 0;
  margin-top: 2px;
  border-top: 1px solid #d8dee8;
}

.style-section-title {
  position: absolute;
  top: -11px;
  left: 28px;
  padding: 0 12px;
  background: #fff;
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
}

.style-grid {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr) 86px minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  row-gap: 12px;
  padding: 8px 4px 14px;
}

.style-grid label {
  text-align: right;
  color: #606b7c;
  font-size: 14px;
}

.style-grid :deep(.el-slider) {
  --el-slider-main-bg-color: #409eff;
}

.style-grid :deep(.el-input-number) {
  width: 100%;
}

.style-grid :deep(.el-select) {
  width: 100%;
}

.style-tip {
  margin-top: 8px;
  color: #8a93a3;
  font-size: 13px;
  line-height: 1.5;
}

.style-tip::before {
  content: 'i';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  margin-right: 6px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

@media (max-width: 680px) {
  .style-switch-row,
  .style-switch-row.split {
    grid-template-columns: 82px 48px minmax(0, 1fr);
  }

  .style-switch-row.split label,
  .style-switch-row.split .el-input-number {
    grid-column: auto;
  }

  .style-grid {
    grid-template-columns: 82px minmax(0, 1fr);
  }
}
</style>
