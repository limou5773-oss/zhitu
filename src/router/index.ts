import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomePage.vue'),
  },
  {
    path: '/function-module',
    name: 'FunctionModule',
    component: () => import('@/views/FunctionModuleDiagram.vue'),
  },
  {
    path: '/three-line-table',
    name: 'ThreeLineTable',
    component: () => import('@/views/ThreeLineTable.vue'),
  },
  {
    path: '/use-case',
    name: 'UseCase',
    component: () => import('@/views/UseCaseDiagram.vue'),
  },
  {
    path: '/flowchart',
    name: 'Flowchart',
    component: () => import('@/views/FlowchartDiagram.vue'),
  },
  {
    path: '/sequence',
    name: 'Sequence',
    component: () => import('@/views/SequenceDiagram.vue'),
  },
  {
    path: '/data-flow',
    name: 'DataFlow',
    component: () => import('@/views/DataFlowDiagram.vue'),
  },
  {
    path: '/er',
    name: 'ER',
    component: () => import('@/views/ERDiagram.vue'),
  },
  {
    path: '/project-analyzer',
    name: 'ProjectAnalyzer',
    component: () => import('@/views/ProjectAnalysis.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
