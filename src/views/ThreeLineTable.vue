<template>
  <DiagramLayout
    title="三线表"
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
      <div class="structured-editor three-line-editor">
        <div class="editor-hint">直接编辑表头和单元格，右侧实时生成三线表</div>

        <el-tabs v-model="activeEditorMode" type="card">
          <el-tab-pane label="表格编辑" name="columns">
            <div class="editor-section">
              <div class="editor-section-title">
                <span>表格标题</span>
              </div>
              <div class="editor-list">
                <div class="editor-row table-title-row">
                  <span class="editor-icon">表</span>
                  <el-input v-model="tableTitle" placeholder="表1 数据表说明" />
                </div>
              </div>
            </div>

            <div class="editor-section">
              <div class="editor-section-title">
                <span>表头（{{ headers.length }}）</span>
                <button class="editor-add" type="button" @click="addColumn()">+ 添加列</button>
              </div>
              <div class="editor-list">
                <div
                  v-for="(header, index) in headers"
                  :key="header.id"
                  class="editor-row table-column-row"
                >
                  <span class="editor-mini-label">列{{ index + 1 }}</span>
                  <el-input v-model="header.name" :placeholder="`列${index + 1}`" />
                  <button class="editor-action danger" type="button" title="删除列" @click="removeColumn(index)">×</button>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="数据编辑" name="rows">
            <div class="editor-section">
              <div class="editor-section-title">
                <span>表格数据（{{ rows.length }}）</span>
                <button class="editor-add" type="button" @click="addRow()">+ 添加行</button>
              </div>
              <div class="table-row-list">
                <div v-for="(row, rowIndex) in rows" :key="row.id" class="data-row-editor">
                  <div class="data-row-title">
                    <span>第{{ rowIndex + 1 }}行</span>
                    <button class="editor-action danger" type="button" title="删除行" @click="removeRow(rowIndex)">×</button>
                  </div>
                  <div class="data-cell-grid">
                    <el-input
                      v-for="(cell, cellIndex) in row.cells"
                      :key="cellIndex"
                      v-model="row.cells[cellIndex]"
                      :placeholder="headers[cellIndex]?.name || `列${cellIndex + 1}`"
                    />
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
      <el-dropdown split-button type="primary" size="small" :disabled="!hasContent" @click="exportPng">
        导出图片
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="exportPng">导出 PNG</el-dropdown-item>
            <el-dropdown-item @click="exportSvg">导出 SVG</el-dropdown-item>
            <el-dropdown-item @click="copySource">复制 Markdown</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </template>

    <template #preview>
      <div ref="previewEl" style="width:100%;">
        <div v-if="!hasContent" class="diagram-placeholder">请填写表格数据</div>
        <div v-else>
          <div v-if="tableTitle" class="three-line-title">{{ tableTitle }}</div>
          <table class="three-line-table">
            <thead>
              <tr>
                <th v-for="(header, index) in renderHeaders" :key="index">{{ header }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in renderRows" :key="rowIndex">
                <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </DiagramLayout>

  <el-dialog v-model="quickFillVisible" title="快速填写三线表" width="640px">
    <div class="quick-fill-help">
      第一行填写表格标题；第二行填写表头；后续每行填写一行数据。支持用 Tab、逗号或竖线分隔，也可以直接粘贴 Markdown 表格。
    </div>
    <el-input
      v-model="quickFillText"
      type="textarea"
      :rows="12"
      placeholder="表1 数据库字段设计&#10;字段&#9;类型&#9;说明&#10;id&#9;int&#9;主键&#10;name&#9;varchar&#9;名称"
    />
    <template #footer>
      <el-button @click="quickFillVisible = false">取消</el-button>
      <el-button type="primary" @click="applyQuickFill">确认填充</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import DiagramLayout from '@/components/DiagramLayout.vue'
import { exportToPng, exportToSvg, copyToClipboard } from '@/utils/export'
import { ElMessage } from 'element-plus'

interface HeaderItem {
  id: number
  name: string
}

interface RowItem {
  id: number
  cells: string[]
}

const tableTitle = ref('')
const headers = ref<HeaderItem[]>([])
const rows = ref<RowItem[]>([])
const activeEditorMode = ref('columns')
const quickFillVisible = ref(false)
const quickFillText = ref('')
const previewEl = ref<HTMLElement>()
const layoutRef = ref<InstanceType<typeof DiagramLayout>>()

let nodeId = 0

const hasContent = computed(() => {
  return Boolean(
    tableTitle.value.trim() ||
    headers.value.some((item) => item.name.trim()) ||
    rows.value.some((row) => row.cells.some((cell) => cell.trim()))
  )
})

const renderHeaders = computed(() => {
  const count = Math.max(headers.value.length, ...rows.value.map((row) => row.cells.length), 1)
  return Array.from({ length: count }, (_, index) => headers.value[index]?.name.trim() || `列${index + 1}`)
})

const renderRows = computed(() => {
  const count = renderHeaders.value.length
  return rows.value.map((row) => Array.from({ length: count }, (_, index) => row.cells[index] || ''))
})

function createHeader(name = ''): HeaderItem {
  return { id: ++nodeId, name }
}

function createRow(cells: string[] = []): RowItem {
  const count = Math.max(headers.value.length, cells.length)
  return {
    id: ++nodeId,
    cells: Array.from({ length: count }, (_, index) => cells[index] || ''),
  }
}

function addColumn() {
  headers.value.push(createHeader(`列${headers.value.length + 1}`))
  rows.value.forEach((row) => row.cells.push(''))
}

function removeColumn(index: number) {
  headers.value.splice(index, 1)
  rows.value.forEach((row) => row.cells.splice(index, 1))
}

function addRow() {
  rows.value.push(createRow())
}

function removeRow(index: number) {
  rows.value.splice(index, 1)
}

function openQuickFill() {
  const lines = [
    tableTitle.value || '表1 数据库字段设计',
    renderHeaders.value.join('\t'),
    ...renderRows.value.map((row) => row.join('\t')),
  ]
  quickFillText.value = lines.join('\n')
  quickFillVisible.value = true
}

function applyQuickFill() {
  const parsed = parseQuickFillText(quickFillText.value)
  tableTitle.value = parsed.title
  headers.value = parsed.headers.map((header) => createHeader(header))
  rows.value = parsed.rows.map((row) => createRow(row))
  activeEditorMode.value = 'rows'
  quickFillVisible.value = false
}

function parseQuickFillText(text: string): { title: string; headers: string[]; rows: string[][] } {
  const rawLines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (!rawLines.length) return { title: '', headers: [], rows: [] }

  let title = rawLines[0]
  let tableLines = rawLines.slice(1)
  const titleMatch = title.match(/^表(?:格)?标题\s*[:：]\s*(.+)$/)
  if (titleMatch) title = titleMatch[1].trim()

  if (rawLines[0].includes('|') && rawLines.length >= 2) {
    title = ''
    tableLines = rawLines
  }

  const parsedLines = tableLines
    .filter((line) => !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line))
    .map(splitTableLine)
    .filter((cells) => cells.some((cell) => cell.trim()))

  if (!parsedLines.length) return { title, headers: [], rows: [] }

  const rawHeaders = parsedLines[0]
  const dataRows = parsedLines.slice(1)
  const maxCols = Math.max(rawHeaders.length, ...dataRows.map((row) => row.length), 1)
  const nextHeaders = Array.from({ length: maxCols }, (_, index) => rawHeaders[index]?.trim() || `列${index + 1}`)
  const nextRows = dataRows.map((row) => Array.from({ length: maxCols }, (_, index) => row[index]?.trim() || ''))
  return { title, headers: nextHeaders, rows: nextRows }
}

function splitTableLine(line: string): string[] {
  const trimmed = line.trim()
  if (trimmed.includes('|')) {
    return trimmed
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())
  }
  if (trimmed.includes('\t')) return trimmed.split('\t').map((cell) => cell.trim())
  if (/[，,]/.test(trimmed)) return trimmed.split(/[，,]/).map((cell) => cell.trim())
  return trimmed.split(/\s+/).map((cell) => cell.trim())
}

function loadExample() {
  tableTitle.value = '表1 数据库字段设计'
  headers.value = [
    createHeader('字段'),
    createHeader('类型'),
    createHeader('说明'),
  ]
  rows.value = [
    createRow(['id', 'int', '主键']),
    createRow(['name', 'varchar', '名称']),
    createRow(['create_time', 'datetime', '创建时间']),
    createRow(['update_time', 'datetime', '更新时间']),
  ]
}

function clearAll() {
  tableTitle.value = ''
  headers.value = []
  rows.value = []
  activeEditorMode.value = 'columns'
}

async function exportPng() {
  if (!previewEl.value || !hasContent.value) return
  await exportToPng(previewEl.value, '三线表')
  ElMessage.success('PNG导出成功')
}

async function exportSvg() {
  if (!previewEl.value || !hasContent.value) return
  await exportToSvg(previewEl.value, '三线表')
  ElMessage.success('SVG导出成功')
}

async function copySource() {
  let md = ''
  if (tableTitle.value) md += `**${tableTitle.value}**\n\n`
  md += '| ' + renderHeaders.value.join(' | ') + ' |\n'
  md += '| ' + renderHeaders.value.map(() => '---').join(' | ') + ' |\n'
  renderRows.value.forEach((row) => {
    md += '| ' + row.join(' | ') + ' |\n'
  })
  await copyToClipboard(md)
  ElMessage.success('Markdown格式已复制到剪贴板')
}

loadExample()
</script>

<style scoped>
.three-line-editor :deep(.el-tabs__header) {
  margin-bottom: 10px;
}

.three-line-editor :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: var(--line);
}

.table-title-row {
  grid-template-columns: 22px 1fr;
}

.table-column-row {
  grid-template-columns: 42px 1fr 28px;
}

.table-row-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
}

.data-row-editor {
  border: var(--border-subtle);
  background: rgba(255, 255, 255, 0.55);
  padding: 8px 10px 10px;
  border-radius: var(--r-xs);
}

.data-row-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--t3);
}

.data-cell-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.three-line-title {
  text-align: center;
  margin-bottom: 10px;
  font-weight: 700;
  font-size: 14px;
  font-family: 'SimSun', '宋体', serif;
}
</style>
