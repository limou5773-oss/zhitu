<template>
  <div class="home-page">
    <h2 class="home-title">图表自动生成工具</h2>
    <p class="home-desc">选择图表类型，输入内容即可自动生成图表，支持预览与导出</p>
    <div class="chart-grid">
      <div class="chart-card" v-for="item in chartTypes" :key="item.path" @click="$router.push(item.path)">
        <div class="chart-card-icon">{{ item.icon }}</div>
        <div class="chart-card-title">{{ item.title }}</div>
        <div class="chart-card-desc">{{ item.desc }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const chartTypes = [
  { path: '/function-module', icon: '📋', title: '功能模块图', desc: '输入系统名称与模块结构，自动生成树形功能模块图' },
  { path: '/three-line-table', icon: '📊', title: '三线表', desc: '输入表格数据，自动生成标准三线表' },
  { path: '/use-case', icon: '👤', title: '用例图', desc: '输入参与者与用例，自动生成 UML 用例图' },
  { path: '/flowchart', icon: '🔄', title: '流程图', desc: '输入流程步骤，自动生成业务流程图' },
  { path: '/sequence', icon: '⏳', title: '时序图', desc: '输入对象与交互步骤，自动生成 UML 时序图' },
  { path: '/data-flow', icon: '📡', title: '数据流图', desc: '输入实体与数据流，自动生成数据流图' },
  { path: '/er', icon: '🗄️', title: 'ER 图', desc: '输入实体与关系，自动生成数据库 ER 图' },
  { path: '/project-analyzer', icon: '🤖', title: '项目智能分析', desc: '导入项目代码，AI 自动分析业务逻辑并生成图表' },
]
</script>
