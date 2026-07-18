# 在线 Markdown 转换网站 - 实施计划

## 一、需求摘要

构建一个纯前端在线 Markdown 转换网站，核心形态为「左侧编辑器 + 右侧实时预览」的分栏布局。

**已确认范围：**
- 转换目标：HTML（实时预览，不做 PDF/Word/图片导出）
- 技术栈：纯前端 React + Vite + TypeScript
- 编辑器：CodeMirror 6（通过 `@uiw/react-codemirror` 集成）
- Markdown 扩展：GitHub 风格 Markdown（GFM）、代码高亮、KaTeX 数学公式、Mermaid 图表
- 附加功能：深色/浅色主题切换、localStorage 本地缓存
- **不包含**：导出 HTML 文件、复制 HTML 按钮（用户未选择）

## 二、现状分析

工作目录 `d:\Code\MDTool` 当前为空，属于全新项目。无任何已有代码、配置或依赖约束，可直接从零搭建。

## 三、技术选型与决策

| 维度 | 选型 | 理由 |
|------|------|------|
| 构建工具 | Vite 5 | 启动快，React 官方推荐 |
| 框架 | React 18 + TypeScript | 用户指定 |
| 编辑器 | `@uiw/react-codemirror` + `@codemirror/lang-markdown` | CodeMirror 6 的 React 封装，开箱即用 |
| Markdown 解析 | `react-markdown` + `remark-gfm` + `rehype-katex` + `rehype-highlight` | React 生态原生，组件化渲染，易扩展 Mermaid |
| 数学公式 | `katex` + `rehype-katex` | 渲染快，兼容 LaTeX 语法 |
| 代码高亮 | `highlight.js` + `rehype-highlight` | 与 react-markdown 集成简单 |
| 图表 | `mermaid` | 自定义 code 组件渲染 |
| 样式方案 | 原生 CSS + CSS 变量 | 主题切换通过 `data-theme` 属性控制，零额外依赖 |
| 主题切换 | React Context + `data-theme` 根属性 | 简单可控 |

**关键决策：**
- 不使用 Tailwind，避免额外配置，CSS 变量足以支撑主题切换
- 不实现拖拽分栏（避免 over-engineering），使用固定 50/50 分栏，移动端上下堆叠
- 默认主题跟随系统 `prefers-color-scheme`，用户切换后存入 localStorage

## 四、项目结构

```
MDTool/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── .gitignore
├── src/
│   ├── main.tsx                    # 应用入口
│   ├── App.tsx                     # 根组件（布局 + 状态编排）
│   ├── index.css                   # 全局样式 + CSS 变量主题定义
│   ├── components/
│   │   ├── Editor.tsx              # CodeMirror 编辑器封装
│   │   ├── Preview.tsx             # react-markdown 渲染 + 插件配置
│   │   ├── MermaidBlock.tsx        # Mermaid 代码块自定义渲染
│   │   └── Toolbar.tsx             # 顶部工具栏（标题 + 主题切换按钮）
│   ├── context/
│   │   └── ThemeContext.tsx        # 主题 Context + Provider
│   ├── hooks/
│   │   └── useLocalStorage.ts      # localStorage 持久化 Hook
│   └── utils/
│       └── sampleContent.ts        # 初始示例 Markdown 内容
```

## 五、实施步骤

### 步骤 0：Git 仓库初始化与远程关联

```bash
git init
git remote add origin https://github.com/Katrina55553/MDTool.git
git branch -M main
```

提交策略（每个里程碑一次提交，便于回溯）：
1. **chore: scaffold vite react-ts project** — 脚手架生成后
2. **chore: add dependencies** — 依赖安装后
3. **feat: theme context and localStorage hook** — 步骤 4-5 完成后
4. **feat: editor with codemirror 6** — 步骤 6 完成后
5. **feat: preview with gfm/katex/highlight/mermaid** — 步骤 7-8 完成后
6. **feat: toolbar and app layout** — 步骤 9-10 完成后
7. **feat: sample content and polish** — 步骤 11-12 完成后
8. 最终 `git push -u origin main` 推送到远程

> 注意：`node_modules/`、`dist/`、`.env` 等需写入 `.gitignore` 后再首次 commit。

### 步骤 1：项目脚手架初始化

使用 Vite 创建 React + TypeScript 模板：

```bash
npm create vite@latest . -- --template react-ts
```

生成的文件基础上调整 `index.html`（标题改为「Markdown 转换器」）、`.gitignore`（包含 node_modules、dist）。

### 步骤 2：安装依赖

```bash
npm install \
  @uiw/react-codemirror @codemirror/lang-markdown @uiw/codemirror-theme-github \
  react-markdown remark-gfm \
  rehype-katex katex \
  rehype-highlight highlight.js \
  mermaid
```

说明：
- `@uiw/react-codemirror` 已内置 `@codemirror/state`、`@codemirror/view` 等核心包
- `@uiw/codemirror-theme-github` 提供亮/暗双主题，免去手动切换 CodeMirror 主题
- `katex` 与 `highlight.js` 需引入对应 CSS

### 步骤 3：全局样式与主题变量（`src/index.css`）

定义两套 CSS 变量（`[data-theme="light"]` 与 `[data-theme="dark"]`），覆盖：
- 背景色、前景色、边框色
- 编辑器/预览区背景
- 字体栈（编辑器用等宽字体，预览用系统字体）
- 滚动条样式
- 引入 `katex/dist/katex.min.css`
- 引入 `highlight.js/styles/github.css` 与 `github-dark.css`（通过 CSS 媒体或在主题切换时动态 import）

布局样式：
- `body` 100vh，flex column
- 顶部 Toolbar 固定高度
- 主体 `display: flex`，左右各 50%，移动端 `flex-direction: column`

### 步骤 4：主题 Context（`src/context/ThemeContext.tsx`）

```typescript
type Theme = 'light' | 'dark';
// 初始值：localStorage > prefers-color-scheme > 'light'
// 切换时：写入 localStorage、设置 document.documentElement.dataset.theme
// 同时切换 CodeMirror 主题与 highlight.js 主题（通过切换 <link> 或 CSS 变量）
```

### 步骤 5：本地缓存 Hook（`src/hooks/useLocalStorage.ts`）

通用 Hook，读写 localStorage，JSON 序列化，try-catch 容错。用于持久化编辑器内容与主题选择。

### 步骤 6：编辑器组件（`src/components/Editor.tsx`）

- 使用 `@uiw/react-codemirror`
- `extensions={[markdown()]}` 启用 Markdown 语法
- `theme` 根据 ThemeContext 动态切换 `githubLight` / `githubDark`
- `value` 与 `onChange` 受控，由父组件 App 管理（App 通过 `useLocalStorage` 持久化）

### 步骤 7：Mermaid 渲染组件（`src/components/MermaidBlock.tsx`）

- 接收 `code` 字符串 prop
- `useEffect` 中调用 `mermaid.render(id, code)` 生成 SVG，写入 ref
- 切换主题时重新渲染（mermaid 初始化需指定 theme）
- 异常时显示错误信息块

### 步骤 8：预览组件（`src/components/Preview.tsx`）

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeKatex, rehypeHighlight]}
  components={{
    code({ inline, className, children }) {
      const match = /language-(\w+)/.exec(className || '');
      if (match && match[1] === 'mermaid') {
        return <MermaidBlock code={String(children)} />;
      }
      return inline ? <code>{children}</code> : <code className={className}>{children}</code>;
    }
  }}
>
  {content}
</ReactMarkdown>
```

包裹容器使用 `prose`-like 自定义 CSS（标题、列表、表格、代码块间距），不引入 Tailwind typography。

### 步骤 9：工具栏（`src/components/Toolbar.tsx`）

- 左侧：站点标题「Markdown 转换器」
- 右侧：主题切换按钮（太阳/月亮图标用内联 SVG，无第三方图标库）
- 点击切换 ThemeContext

### 步骤 10：根组件编排（`src/App.tsx`）

- 顶部 `<Toolbar />`
- 主体 `<div class="main"><Editor /><Preview /></div>`
- 状态：`content`（通过 `useLocalStorage('md-content', sampleContent)`）
- 主题：`<ThemeProvider>` 包裹整个 App

### 步骤 11：示例内容（`src/utils/sampleContent.ts`）

导出一段包含标题、列表、表格、代码块、数学公式、Mermaid 图表的示例 Markdown，让用户首次打开就能看到全部能力。

### 步骤 12：入口与挂载（`src/main.tsx`）

标准 React 18 `createRoot` 挂载，引入 `index.css`。

## 六、关键风险与处理

| 风险 | 处理方式 |
|------|----------|
| Mermaid 在 SSR/首次渲染时需 `mermaid.initialize` | 在 `MermaidBlock` 模块顶层调用 `mermaid.initialize({ startOnLoad: false, theme })`，主题切换时重新 initialize 并触发重渲染 |
| `rehype-highlight` 双主题 CSS 冲突 | 只引入一个 highlight.js 主题 CSS，通过 CSS 变量覆盖颜色，或动态切换 `<link>` 标签 |
| react-markdown v9 `code` 组件 API 变化（无 `inline` 参数） | 使用 `node` 判断或检查 `\n` 区分行内/块级代码 |
| KaTeX 字体路径 | Vite 默认会处理 `katex.min.css` 中的字体引用，无需额外配置 |
| 大文档预览性能 | react-markdown 每次重渲染，5000+ 行可能卡顿，本期不做虚拟化（用户未要求） |

## 七、验证步骤

1. `npm run dev` 启动开发服务器，浏览器打开预览
2. 左侧输入 Markdown，右侧实时渲染，无报错
3. 验证以下语法渲染正确：
   - GFM：表格、任务列表 `- [x]`、删除线 `~~text~~`、自动链接
   - 代码块：\`\`\`js / python / bash 等语法高亮
   - 数学公式：行内 `$E=mc^2$` 与块级 `$$...$$`
   - Mermaid：\`\`\`mermaid 流程图、时序图
4. 点击主题切换按钮，编辑器、预览区、代码块、Mermaid 图表均正确切换深/浅色
5. 刷新页面后，编辑器内容与主题选择保持不变（localStorage 生效）
6. 移动端窗口宽度下，布局自动改为上下堆叠
7. `npm run build` 构建成功，`dist/` 产物可正常部署

## 八、不在范围内（明确排除）

- 导出/下载 HTML 文件
- 复制 HTML 到剪贴板
- 文件上传/批量转换
- 后端服务、用户账号、分享链接
- 拖拽调整分栏宽度
- PDF / Word / 图片导出
