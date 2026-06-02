<template>
  <div class="project-analyzer-page">
    <div class="project-analyzer-left">
      <div class="analyzer-header">
        <div>
          <h2 class="page-title">项目智能分析</h2>
          <p class="page-desc">导入项目代码，AI 分析业务逻辑并生成图表</p>
        </div>
      </div>

      <div class="structured-editor analyzer-editor">
        <div class="editor-section analyzer-section">
          <div class="editor-section-title">
            <span>API 设置</span>
            <span class="section-caption">用户自备 Key</span>
          </div>
          <div class="analyzer-section-body">
            <div class="apikey-row">
              <el-input v-model="apiKey" type="password" show-password placeholder="DeepSeek API Key" clearable size="default">
                <template #prepend>Key</template>
              </el-input>
              <el-tag class="local-key-tag" type="info" size="small">仅本地使用</el-tag>
            </div>
            <p class="key-help">项目智能分析需要用户自行申请 DeepSeek Key，后端只在本次分析请求中临时使用，不保存到服务器。</p>
          </div>
        </div>

        <div class="editor-section analyzer-section">
          <div class="editor-section-title">
            <span>1. 项目来源</span>
          </div>
          <div class="analyzer-section-body">
            <el-tabs v-model="sourceType" type="card" class="analyzer-tabs">
              <el-tab-pane label="GitHub" name="github">
                <div class="source-fields">
                  <el-input v-model="githubRepoUrl" placeholder="https://github.com/user/repo" size="default" clearable />
                  <div class="repo-meta-row">
                    <el-input v-model="githubBranch" placeholder="main" size="default" class="branch-input" />
                    <el-input v-model="githubToken" placeholder="Token（可选）" size="default" type="password" show-password />
                  </div>
                </div>
              </el-tab-pane>
              <el-tab-pane label="ZIP 上传" name="upload">
                <el-upload drag :auto-upload="false" :limit="1" accept=".zip" :on-change="handleZipChange" :file-list="zipFiles">
                  <el-icon class="upload-icon"><UploadFilled /></el-icon>
                  <div class="upload-text">拖拽或点击上传 ZIP</div>
                </el-upload>
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>

        <div class="editor-section analyzer-section">
          <div class="editor-section-title">
            <span>2. 图表类型</span>
          </div>
          <div class="analyzer-section-body">
            <el-checkbox-group v-model="selectedDiagramTypes" class="chart-type-grid">
              <el-checkbox v-for="ct in chartTypeOptions" :key="ct.value" :value="ct.value" :label="ct.value" class="chart-type-item" size="default">
                <span class="chart-type-label">
                  <span class="chart-type-icon">{{ ct.short }}</span>
                  <span>{{ ct.label }}</span>
                </span>
              </el-checkbox>
            </el-checkbox-group>
          </div>
        </div>

        <div class="editor-section analyzer-section">
          <div class="editor-section-title">
            <span>3. 分析深度</span>
          </div>
          <div class="analyzer-section-body">
            <el-radio-group v-model="analysisMode" size="default" class="depth-options">
              <el-radio-button value="fast">快速</el-radio-button>
              <el-radio-button value="deep">深度</el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <div class="analyzer-start-panel">
          <el-button class="start-button" type="primary" :loading="analyzing" :disabled="!canStart" @click="startAnalysis">
            <el-icon v-if="!analyzing"><VideoPlay /></el-icon>
            {{ analyzing ? '分析中...' : '开始分析' }}
          </el-button>
          <span v-if="startError" class="start-error">{{ startError }}</span>
        </div>

        <div v-if="analyzing" class="progress-section">
          <el-progress :percentage="progressPercent" :stroke-width="8" :color="progressColor" />
          <div class="progress-status">{{ progressStatus }}</div>
        </div>

        <div v-if="analysisResults.length > 0" class="editor-section analyzer-section results-section">
          <div class="editor-section-title">
            <span>分析结果</span>
            <el-button v-if="activeResult && !activeResult.error" size="small" text @click="copyResultJson(activeTab)">
              <el-icon><CopyDocument /></el-icon>复制 JSON
            </el-button>
          </div>
          <div class="analyzer-section-body">
            <div class="diagram-tabs">
              <button
                v-for="r in analysisResults"
                :key="r.type"
                class="diagram-tab"
                :class="{ active: activeTab === r.type, error: r.error, warning: r.warning }"
                type="button"
                @click="selectDiagram(r.type)"
              >
                <span class="tab-icon">{{ getChartShort(r.type) }}</span>
                <span class="tab-label">{{ getChartLabel(r.type) }}</span>
                <span v-if="r.error" class="tab-badge">×</span>
                <span v-else-if="r.warning" class="tab-badge warning">!</span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="analysisSummary?.techStack?.length" class="summary-mini">
          <el-tag v-for="t in analysisSummary.techStack" :key="t" size="small" class="tech-tag">{{ t }}</el-tag>
        </div>
      </div>
    </div>

    <div class="project-analyzer-right">
      <div class="project-preview-header">
        <div class="project-preview-heading">
          <span class="project-preview-title">预览</span>
          <span v-if="activeTab" class="project-preview-current">{{ getChartLabel(activeTab) }}</span>
        </div>
        <div v-if="analysisResults.length" class="preview-diagram-switcher">
          <button
            v-for="r in analysisResults"
            :key="r.type"
            class="preview-switch-button"
            :class="{ active: activeTab === r.type, error: r.error, warning: r.warning }"
            type="button"
            @click="selectDiagram(r.type)"
          >
            <span>{{ getChartShort(r.type) }}</span>
            {{ getChartLabel(r.type) }}
          </button>
        </div>
        <div class="project-preview-actions">
          <a v-if="activeTab && !activeResult?.error" :href="editorUrl(activeTab)" target="_blank" class="toolbar-link">在新窗口编辑</a>
        </div>
      </div>
      <div class="project-preview-body">
        <div v-if="!activeResult && analysisResults.length === 0" class="empty-preview">
          <div class="empty-icon">图</div>
          <div class="empty-text">导入项目开始分析<br>图表将在此处显示</div>
        </div>
        <div v-else-if="activeResult?.error" class="empty-preview error">
          <div class="empty-icon">!</div>
          <div class="empty-text">{{ activeResult.error }}</div>
        </div>
        <div v-else-if="analysisResults.length && !activeResult" class="empty-preview">
          <div class="empty-icon">选</div>
          <div class="empty-text">请选择上方图表查看预览</div>
        </div>
        <iframe
          v-else-if="activeTab"
          :key="activeTab"
          class="preview-iframe"
          :src="previewUrl(activeTab)"
          @load="onIframeLoad"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, UploadFilled, VideoPlay } from '@element-plus/icons-vue'
import { writeAnalyzerDiagram } from '../utils/diagramStorage'

const API_BASE = ''
const MAX_ZIP_UPLOAD_MB = 200
const MAX_ZIP_UPLOAD_BYTES = MAX_ZIP_UPLOAD_MB * 1024 * 1024

// API Key
const apiKey = ref('')
const savedKey = sessionStorage.getItem('ds_api_key')
if (savedKey) {
  apiKey.value = savedKey
}
watch(apiKey, value => {
  const key = value.trim()
  if (key) sessionStorage.setItem('ds_api_key', key)
  else sessionStorage.removeItem('ds_api_key')
})

// Source
const sourceType = ref<'github' | 'upload'>('github')
const githubRepoUrl = ref('')
const githubBranch = ref('main')
const githubToken = ref('')
const zipFiles = ref<any[]>([])
function handleZipChange(file: any) {
  if (file.size > MAX_ZIP_UPLOAD_BYTES) {
    zipFiles.value = []
    ElMessage.error(`ZIP 文件不能超过 ${MAX_ZIP_UPLOAD_MB}MB，请先删除 node_modules、dist、.git 等目录后重新压缩`)
    return
  }
  zipFiles.value = [file]
}

// Chart types
const chartTypeOptions = [
  { value: 'module', label: '功能模块图', short: '模' },
  { value: 'er', label: 'ER 图', short: 'ER' },
  { value: 'usecase', label: '用例图', short: '用' },
  { value: 'dfd', label: '数据流图', short: '流' },
  { value: 'flowchart', label: '流程图', short: '程' },
  { value: 'sequence', label: '时序图', short: '序' },
]
const selectedDiagramTypes = ref<string[]>(['module', 'er', 'usecase', 'dfd'])
function getChartShort(type: string) { return chartTypeOptions.find(c => c.value === type)?.short || '图' }
function getChartLabel(type: string) { return chartTypeOptions.find(c => c.value === type)?.label || type }

// Mode
const analysisMode = ref<'fast' | 'deep'>('fast')

// State
const analyzing = ref(false)
const startError = ref('')
const progressPercent = ref(0)
const progressStatus = ref('')
const progressColor = computed(() => progressPercent.value < 50 ? '#409EFF' : progressPercent.value < 90 ? '#E6A23C' : '#67C23A')
const analysisResults = ref<{ type: string; error?: string; warning?: string }[]>([])
const analysisSummary = ref<any>(null)
const activeTab = ref('')

const canStart = computed(() => {
  if (analyzing.value) return false
  if (!apiKey.value.trim()) return false
  if (selectedDiagramTypes.value.length === 0) return false
  if (sourceType.value === 'github' && !githubRepoUrl.value.trim()) return false
  if (sourceType.value === 'upload' && zipFiles.value.length === 0) return false
  return true
})

const activeResult = computed(() => analysisResults.value.find(r => r.type === activeTab.value))

const DIAGRAM_ROUTES: Record<string, string> = {
  module: '/function-module', er: '/er', usecase: '/use-case',
  dfd: '/data-flow', flowchart: '/flowchart', sequence: '/sequence',
}
const STORAGE_KEYS: Record<string, string> = {
  module: 'diagram:module', er: 'diagram:er', usecase: 'diagram:usecase',
  dfd: 'diagram:dfd', flowchart: 'diagram:flowchart', sequence: 'diagram:sequence',
}

function selectDiagram(type: string) {
  activeTab.value = type
}

function editorUrl(type: string) {
  return `${DIAGRAM_ROUTES[type]}?from=analyzer`
}

function previewUrl(type: string) {
  return `${DIAGRAM_ROUTES[type]}?from=analyzer&embed=preview`
}

function onIframeLoad() {
  // The iframe's editor onMounted will pick up sessionStorage data automatically
}

async function readErrorResponse(resp: Response, fallback: string) {
  const contentType = resp.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const data = await resp.json()
      return data.error || data.message || fallback
    } catch {
      return fallback
    }
  }

  let text = ''
  try {
    text = await resp.text()
  } catch {
    text = ''
  }

  if (resp.status === 413) {
    return `上传文件过大。请把 Nginx 的 client_max_body_size 调到 ${MAX_ZIP_UPLOAD_MB}m，或删除 node_modules、dist、.git 后重新压缩。`
  }

  const plain = text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return plain ? `${fallback}：${plain.slice(0, 180)}` : `${fallback}（HTTP ${resp.status}）`
}

async function startAnalysis() {
  startError.value = ''
  analysisResults.value = []
  analysisSummary.value = null
  activeTab.value = ''
  analyzing.value = true
  progressPercent.value = 0
  progressStatus.value = '准备项目...'

  try {
    let projectId: string
    if (sourceType.value === 'github') {
      progressStatus.value = '正在克隆 GitHub 仓库...'
      progressPercent.value = 10
      const resp = await fetch(`${API_BASE}/api/project/github`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: githubRepoUrl.value.trim(), branch: githubBranch.value || 'main', token: githubToken.value || undefined }),
      })
      if (!resp.ok) throw new Error(await readErrorResponse(resp, 'GitHub 导入失败'))
      projectId = (await resp.json()).projectId
    } else {
      progressStatus.value = '正在上传并解压 ZIP...'
      progressPercent.value = 10
      const file = zipFiles.value[0]?.raw
      if (!file) throw new Error('请选择 ZIP 文件')
      if (file.size > MAX_ZIP_UPLOAD_BYTES) {
        throw new Error(`ZIP 文件不能超过 ${MAX_ZIP_UPLOAD_MB}MB，请先删除 node_modules、dist、.git 等目录后重新压缩`)
      }
      const formData = new FormData(); formData.append('file', file)
      const resp = await fetch(`${API_BASE}/api/project/upload`, { method: 'POST', body: formData })
      if (!resp.ok) throw new Error(await readErrorResponse(resp, 'ZIP 上传失败'))
      projectId = (await resp.json()).projectId
    }

    progressStatus.value = '正在扫描项目文件...'
    progressPercent.value = 30
    const userApiKey = apiKey.value.trim()
    if (!userApiKey) throw new Error('请先输入 DeepSeek API Key')
    sessionStorage.setItem('ds_api_key', userApiKey)
    const analyzeResp = await fetch(`${API_BASE}/api/project/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-deepseek-api-key': userApiKey,
      },
      body: JSON.stringify({ projectId, diagramTypes: selectedDiagramTypes.value, mode: analysisMode.value }),
    })

    progressStatus.value = '大模型正在分析业务逻辑...'
    progressPercent.value = 60

    if (!analyzeResp.ok) throw new Error(await readErrorResponse(analyzeResp, '分析失败'))
    const analyzeData = await analyzeResp.json()
    progressPercent.value = 90
    progressStatus.value = '处理结果...'

    analysisSummary.value = analyzeData.summary

    for (const type of selectedDiagramTypes.value) {
      const warningInfo = analyzeData.warnings?.find((item: any) => item.diagramType === type)
      if (analyzeData.results?.[type]) {
        writeAnalyzerDiagram(STORAGE_KEYS[type], analyzeData.results[type])
        analysisResults.value.push({ type, warning: warningInfo?.message })
      } else {
        const errInfo = analyzeData.errors?.find((e: any) => e.diagramType === type)
        analysisResults.value.push({ type, error: errInfo?.error || '生成失败' })
      }
    }

    progressPercent.value = 100
    progressStatus.value = '分析完成'

    const firstVisible = analysisResults.value.find(r => !r.error) || analysisResults.value[0]
    if (firstVisible) {
      activeTab.value = firstVisible.type
      // Allow sessionStorage to be written before iframe loads
      await new Promise(r => setTimeout(r, 300))
    }

    const successCount = analysisResults.value.filter(r => !r.error).length
    if (successCount > 0) {
      const warningCount = analysisResults.value.filter(r => r.warning).length
      if (warningCount > 0) {
        ElMessage.warning(`分析完成，${successCount} 个图表已生成，其中 ${warningCount} 个使用兜底生成`)
      } else {
        ElMessage.success(`分析完成！${successCount} 个图表生成成功`)
      }
    } else {
      ElMessage.warning('分析完成，但图表生成失败，请查看右侧错误信息')
    }
  } catch (err: any) {
    startError.value = err.message || '未知错误'
    progressStatus.value = '分析失败'
    ElMessage.error(startError.value)
  } finally {
    analyzing.value = false
  }
}

async function copyResultJson(type: string) {
  const cached = sessionStorage.getItem(STORAGE_KEYS[type])
  if (!cached) { ElMessage.warning('数据不存在'); return }
  try {
    await navigator.clipboard.writeText(JSON.stringify(JSON.parse(cached), null, 2))
    ElMessage.success('JSON 已复制')
  } catch { ElMessage.info('请在新窗口中查看') }
}
</script>

<style scoped>
.analyzer-page {
  display: grid;
  grid-template-columns: minmax(420px, 480px) minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - 60px);
  overflow: hidden;
  padding: 16px;
}

.left-panel {
  min-width: 0;
  overflow-y: auto;
  padding: 18px;
  border: 1px solid rgba(255,255,255,0.6);
  border-radius: 18px;
  background: rgba(255,255,255,0.38);
  box-shadow: 0 18px 48px rgba(38, 75, 135, 0.08);
}

.right-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.7);
  border-radius: 18px;
  background: rgba(255,255,255,0.72);
  box-shadow: 0 18px 48px rgba(38, 75, 135, 0.08);
}

.analyzer-header {
  padding: 0 2px 12px;
}

.page-title { font-size: 21px; font-weight: 700; margin: 0 0 6px; color: var(--t1); }
.page-desc { font-size: 13px; color: var(--t2); margin: 0; line-height: 1.5; }

.section-card {
  margin-bottom: 12px;
  border-radius: 14px;
  background: rgba(255,255,255,0.48);
  border-color: rgba(255,255,255,0.68);
}
.section-title { font-size: 14px; font-weight: 600; color: var(--t1); }

.api-key-card { border: 1px dashed var(--accent-light, #7B8AE0); }
.apikey-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.key-help {
  margin: 8px 0 0;
  color: var(--t3);
  font-size: 12px;
  line-height: 1.6;
}

.source-tabs {
  margin-top: -6px;
}

.source-fields {
  display: grid;
  gap: 10px;
}

.form-row { display: flex; gap: 8px; }

.repo-meta-row {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
}

.branch-input {
  width: 100%;
}

.chart-type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.chart-type-item {
  margin-right: 0 !important;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid rgba(145, 172, 210, 0.32);
  border-radius: 10px;
  background: rgba(255,255,255,0.48);
}
.chart-type-label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.chart-type-icon { font-size: 16px; }

.depth-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

.depth-options :deep(.el-radio) {
  height: 36px;
  margin-right: 0;
  padding: 0 12px;
  border: 1px solid rgba(145, 172, 210, 0.32);
  border-radius: 10px;
  background: rgba(255,255,255,0.48);
}

.start-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  margin: 14px 0;
}

.start-button {
  width: 100%;
  height: 40px;
  font-weight: 700;
}
.start-error { color: #f56c6c; font-size: 13px; }

.progress-section { margin-bottom: 12px; }
.progress-status { margin-top: 6px; font-size: 13px; color: var(--t2); }

.results-section { margin-top: 12px; }
.diagram-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.diagram-tab {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 10px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--border-subtle);
  font-size: 13px; transition: all 0.15s;
  user-select: none;
}
.diagram-tab:hover { border-color: var(--accent, #5B6ABF); }
.diagram-tab.active { background: var(--accent, #5B6ABF); color: #fff; border-color: transparent; }
.diagram-tab.error { opacity: 0.5; cursor: not-allowed; }
.tab-icon { font-size: 14px; }
.tab-badge { color: #f56c6c; font-weight: bold; }

.result-actions { margin-top: 8px; }

.summary-mini { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 4px; }

.empty-preview {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  color: var(--t3);
}
.empty-icon { font-size: 48px; opacity: 0.5; }
.empty-text { font-size: 15px; text-align: center; line-height: 1.6; }

.preview-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px; border-bottom: 1px solid var(--border-subtle);
  background: var(--glass-2);
}
.preview-title { font-size: 15px; font-weight: 600; }
.toolbar-link { font-size: 13px; color: var(--accent, #5B6ABF); text-decoration: none; }
.toolbar-link:hover { text-decoration: underline; }

.preview-iframe {
  flex: 1; width: 100%; border: none;
}

.section-card :deep(.el-card__header) {
  padding: 14px 18px 10px;
  border-bottom: 0;
}

.section-card :deep(.el-card__body) {
  padding: 10px 18px 18px;
}

.source-tabs :deep(.el-tabs__header) {
  margin-bottom: 10px;
}

.source-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  opacity: 0.55;
}

.chart-type-item :deep(.el-checkbox__label) {
  min-width: 0;
}

.chart-type-item :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: var(--accent, #5B6ABF);
}

@media (max-width: 980px) {
  .analyzer-page {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
    min-height: calc(100vh - 60px);
    overflow: visible;
  }

  .left-panel {
    overflow: visible;
  }

  .right-panel {
    min-height: 440px;
  }
}

@media (max-width: 520px) {
  .analyzer-page {
    padding: 10px;
    gap: 10px;
  }

  .left-panel {
    padding: 14px;
    border-radius: 14px;
  }

  .right-panel {
    border-radius: 14px;
  }

  .apikey-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .apikey-row .el-tag {
    justify-self: start;
  }

  .repo-meta-row {
    grid-template-columns: 96px minmax(0, 1fr);
  }

  .chart-type-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.project-analyzer-page {
  display: flex;
  gap: 16px;
  height: calc(100vh - 104px);
  min-height: 0;
  overflow: hidden;
}

.project-analyzer-left {
  width: clamp(420px, 30vw, 560px);
  flex: 0 0 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: var(--border-soft);
  border-radius: var(--r-lg);
  background: rgba(255, 255, 255, 0.52);
  box-shadow: var(--shadow-2);
}

.project-analyzer-right {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: var(--border-soft);
  border-radius: var(--r-lg);
  background: rgba(255, 255, 255, 0.52);
  box-shadow: var(--shadow-2);
}

.project-analyzer-left:hover,
.project-analyzer-right:hover {
  box-shadow: var(--shadow-3);
}

.analyzer-header {
  flex: 0 0 auto;
  padding: 16px 18px 14px;
  border-bottom: var(--border-subtle);
  background: linear-gradient(180deg, rgba(255,255,255,0.64) 0%, rgba(255,255,255,0.36) 100%);
}

.page-title {
  margin: 0 0 6px;
  color: var(--t1);
  font-family: 'SimSun', '宋体', 'Songti SC', serif;
  font-size: 20px;
  font-weight: 700;
}

.page-desc {
  margin: 0;
  color: var(--t3);
  font-size: 12px;
  line-height: 1.6;
}

.analyzer-editor {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 14px 18px 18px;
  overscroll-behavior: contain;
}

.analyzer-section {
  flex: 0 0 auto;
  background: rgba(255,255,255,0.5);
}

.analyzer-section + .analyzer-section,
.analyzer-start-panel,
.progress-section,
.results-section,
.summary-mini {
  margin-top: 12px;
}

.analyzer-section-body {
  padding: 12px;
}

.section-caption {
  color: var(--t4);
  font-size: 12px;
  font-weight: 500;
}

.apikey-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.analyzer-tabs :deep(.el-tabs__header) {
  margin-bottom: 10px;
}

.analyzer-tabs :deep(.el-tabs__nav) {
  overflow: hidden;
  border-radius: var(--r-xs) var(--r-xs) 0 0;
}

.analyzer-tabs :deep(.el-tabs__item) {
  min-width: 92px;
  text-align: center;
}

.source-fields {
  display: grid;
  gap: 8px;
}

.repo-meta-row {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 8px;
}

.chart-type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.chart-type-item {
  min-height: 38px;
  margin-right: 0 !important;
  padding: 0 10px;
  border: var(--border-soft);
  border-radius: var(--r-xs);
  background: rgba(255,255,255,0.56);
  transition: border-color 0.16s ease, background 0.16s ease;
}

.chart-type-item:hover {
  border-color: rgba(64, 158, 255, 0.45);
  background: #f8fbff;
}

.chart-type-item :deep(.el-checkbox__label) {
  min-width: 0;
  color: var(--t1);
}

.chart-type-item :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: var(--el-color-primary, #409eff);
}

.chart-type-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
}

.chart-type-icon,
.tab-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid #b9dcff;
  border-radius: 4px;
  background: #eef6ff;
  color: #1677d2;
  font-family: 'SimSun', '宋体', serif;
  font-size: 12px;
  font-weight: 700;
}

.depth-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
}

.depth-options :deep(.el-radio-button__inner) {
  width: 100%;
}

.analyzer-start-panel {
  display: grid;
  gap: 8px;
}

.start-button {
  width: 100%;
  height: 38px;
  font-weight: 700;
}

.start-error {
  color: #f56c6c;
  font-size: 12px;
  line-height: 1.5;
}

.progress-section {
  padding: 12px;
  border: var(--border-subtle);
  border-radius: var(--r-sm);
  background: rgba(255,255,255,0.5);
}

.progress-status {
  margin-top: 8px;
  color: var(--t3);
  font-size: 12px;
}

.diagram-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.diagram-tab {
  min-width: 0;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: var(--border-soft);
  border-radius: var(--r-xs);
  background: rgba(255,255,255,0.56);
  color: var(--t1);
  cursor: pointer;
  font-family: 'SimSun', '宋体', 'Songti SC', serif;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.diagram-tab:hover {
  border-color: rgba(64, 158, 255, 0.45);
  background: #f8fbff;
}

.diagram-tab.active {
  border-color: #409eff;
  background: #eef6ff;
  color: #1677d2;
  font-weight: 700;
}

.diagram-tab.warning {
  border-color: #f5cf8c;
}

.diagram-tab.error {
  opacity: 0.52;
}

.tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-badge {
  margin-left: auto;
  color: #d63031;
}

.tab-badge.warning {
  color: #b7791f;
}

.summary-mini {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.project-preview-header {
  flex: 0 0 auto;
  min-height: 48px;
  padding: 10px 18px;
  border-bottom: var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: linear-gradient(180deg, rgba(255,255,255,0.64) 0%, rgba(255,255,255,0.36) 100%);
}

.project-preview-heading {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  min-width: 84px;
}

.project-preview-title {
  color: var(--t2);
  font-family: 'SimSun', '宋体', 'Songti SC', serif;
  font-size: 13px;
  font-weight: 700;
}

.project-preview-current {
  color: var(--t4);
  font-size: 12px;
  white-space: nowrap;
}

.preview-diagram-switcher {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.preview-switch-button {
  height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: var(--border-soft);
  border-radius: var(--r-xs);
  background: #fff;
  color: var(--t2);
  cursor: pointer;
  font-family: 'SimSun', '宋体', 'Songti SC', serif;
  font-size: 13px;
  font-weight: 700;
  transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
}

.preview-switch-button span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  border: 1px solid #d8e6f7;
  border-radius: 4px;
  background: #f8fbff;
  color: #409eff;
  font-size: 11px;
}

.preview-switch-button:hover {
  border-color: #409eff;
  background: #eef6ff;
  color: #1677d2;
}

.preview-switch-button.active {
  border-color: #409eff;
  background: #409eff;
  color: #fff;
}

.preview-switch-button.active span {
  border-color: rgba(255,255,255,0.65);
  background: rgba(255,255,255,0.18);
  color: #fff;
}

.preview-switch-button.error {
  opacity: 0.45;
}

.preview-switch-button.warning {
  border-color: #f5cf8c;
}

.project-preview-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-link {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border: var(--border-soft);
  border-radius: var(--r-xs);
  background: #fff;
  color: var(--el-color-primary, #409eff);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.toolbar-link:hover {
  border-color: var(--el-color-primary, #409eff);
  background: #eef6ff;
}

.project-preview-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
  background: #fff;
  border-radius: 0 0 var(--r-lg) var(--r-lg);
}

.empty-preview {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--t3);
  text-align: center;
}

.empty-preview.error {
  color: #d63031;
}

.empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: 1px solid #d8e6f7;
  border-radius: 10px;
  background: #f8fbff;
  color: #409eff;
  font-size: 20px;
  font-weight: 700;
}

.empty-text {
  font-size: 13px;
  line-height: 1.7;
}

.preview-iframe {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  border: none;
}

.project-analyzer-left :deep(.el-input__wrapper),
.project-analyzer-left :deep(.el-input-group__prepend) {
  border-radius: var(--r-xs);
}

@media (max-width: 980px) {
  .project-analyzer-page {
    flex-direction: column;
    height: auto;
    min-height: calc(100vh - 104px);
    overflow: visible;
  }

  .project-analyzer-left {
    width: 100%;
    overflow: visible;
  }

  .analyzer-editor {
    overflow: visible;
  }

  .project-analyzer-right {
    min-height: 520px;
  }

  .project-preview-header {
    align-items: stretch;
    flex-direction: column;
  }

  .preview-diagram-switcher {
    justify-content: flex-start;
  }

  .project-preview-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 560px) {
  .project-analyzer-left,
  .project-analyzer-right {
    border-radius: var(--r-md);
  }

  .analyzer-header,
  .analyzer-editor {
    padding-left: 14px;
    padding-right: 14px;
  }

  .apikey-row,
  .repo-meta-row,
  .chart-type-grid,
  .diagram-tabs {
    grid-template-columns: 1fr;
  }

  .save-key-btn {
    width: 100%;
  }
}
</style>
