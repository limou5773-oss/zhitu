# 图表自动生成工具

## 项目简介

本项目是一个面向课程设计、论文文档和项目分析场景的图表自动生成工具。用户可以在网页中选择图表类型，填写结构化文本或项目内容，系统自动生成对应图表，并支持预览和导出。

系统前端基于 Vue 3、Vite、Element Plus 和 Mermaid 实现，后端基于 Express、TypeScript 和项目代码解析服务实现。项目既可以用于手动生成图表，也可以导入项目代码，由后端分析项目结构后辅助生成图表内容。

## 主要功能

- 功能模块图：根据系统名称和模块结构生成层级功能图。
- 三线表：根据表格字段和内容生成规范表格。
- 用例图：根据参与者和用例关系生成 UML 用例图。
- 流程图：根据业务步骤生成流程图。
- 时序图：根据对象交互过程生成 UML 时序图。
- 数据流图：根据外部实体、加工处理、数据存储和数据流生成数据流图。
- ER 图：根据实体、字段和关系生成数据库 E-R 图。
- 项目智能分析：导入项目代码后，分析项目结构并辅助生成图表。

## 技术栈

前端：

- Vue 3
- Vite
- TypeScript
- Vue Router
- Element Plus
- Mermaid
- html-to-image
- file-saver

后端：

- Node.js
- Express
- TypeScript
- Axios
- Multer
- adm-zip
- simple-git
- Zod

## 目录结构

```text
rjzt
├─ src                         前端源码
│  ├─ components               公共组件
│  ├─ router                   前端路由
│  ├─ styles                   全局样式
│  ├─ utils                    图表渲染、导出和存储工具
│  └─ views                    各类图表页面
├─ server                      后端服务
│  ├─ src
│  │  ├─ routes                接口路由
│  │  ├─ services              项目解析、图表生成和 AI 服务
│  │  └─ types                 类型定义
│  ├─ .env.example             后端环境变量模板
│  └─ package.json             后端依赖配置
├─ package.json                前端依赖配置
├─ vite.config.ts              Vite 配置
├─ tsconfig.json               TypeScript 配置
└─ README.md                   项目说明文档
```

## 环境要求

- Node.js 18 及以上
- npm 9 及以上

## 前端运行

在项目根目录执行：

```powershell
npm install
npm run dev
```

前端默认访问地址：

```text
http://localhost:5173
```

## 后端运行

进入后端目录：

```powershell
cd server
npm install
```

复制环境变量模板：

```powershell
Copy-Item .env.example .env
```

然后根据本机环境修改 `server/.env`。

启动后端开发服务：

```powershell
npm run dev
```

## 构建命令

前端构建：

```powershell
npm run build
```

后端构建：

```powershell
cd server
npm run build
```

后端生产启动：

```powershell
npm run start
```

## GitHub 上传说明

本项目上传 GitHub 时不应包含本地依赖、构建产物、环境变量和临时截图。以下内容已经通过 `.gitignore` 排除：

```text
node_modules/
server/node_modules/
dist/
server/dist/
output/
.playwright-cli/
.env
server/.env
tmp-*.png
```

仓库中保留 `server/.env.example` 作为配置模板。真实密钥、接口地址和本地私有配置只应写入 `server/.env`，不要提交到 GitHub。

## 使用建议

如果用于论文或课程设计文档，建议先在页面中选择对应图表类型，再按页面提示输入实体、模块、流程或关系。生成图表后可以导出图片，并插入 Word 文档中作为系统设计图、数据流图、E-R 图或流程图。
