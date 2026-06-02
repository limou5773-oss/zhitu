<template>
  <div id="app-container" :class="{ 'embedded-preview-app': isEmbeddedPreview }">
    <header v-if="!isEmbeddedPreview" class="app-header">
      <div class="header-left">
        <h1 class="app-title" @click="$router.push('/')">图表自动生成工具</h1>
      </div>
      <nav class="header-nav">
        <el-menu
          :default-active="activeMenu"
          mode="horizontal"
          :ellipsis="false"
          router
        >
          <el-menu-item index="/function-module">功能模块图</el-menu-item>
          <el-menu-item index="/three-line-table">三线表</el-menu-item>
          <el-menu-item index="/use-case">用例图</el-menu-item>
          <el-menu-item index="/flowchart">流程图</el-menu-item>
          <el-menu-item index="/sequence">时序图</el-menu-item>
          <el-menu-item index="/data-flow">数据流图</el-menu-item>
          <el-menu-item index="/er">ER图</el-menu-item>
        </el-menu>
      </nav>
    </header>
    <main class="app-main" :class="{ 'embedded-preview-main': isEmbeddedPreview }">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const activeMenu = computed(() => {
  const path = route.path
  if (path === '/') return ''
  return path
})

const isEmbeddedPreview = computed(() => route.query.embed === 'preview')
</script>

<style scoped>
.embedded-preview-app {
  min-height: 100vh;
  background: #fff;
}

.embedded-preview-main {
  height: 100vh;
  padding: 0;
  overflow: hidden;
}
</style>
