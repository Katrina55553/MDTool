export const sampleContent = `# Markdown 转换器

一个纯前端的在线 Markdown 渲染工具，支持 **GFM**、代码高亮、数学公式与 Mermaid 图表。

## 功能特性

- GitHub 风格 Markdown（表格、任务列表、删除线）
- 代码块语法高亮
- KaTeX 数学公式
- Mermaid 流程图 / 时序图
- 深色 / 浅色主题切换
- 内容自动缓存到本地

## 任务列表

- [x] 编辑器与实时预览
- [x] 主题切换
- [ ] 写更多文档

## 表格示例

| 语法       | 支持 | 说明             |
| ---------- | ---- | ---------------- |
| GFM 表格   | ✅   | 管道符语法       |
| 任务列表   | ✅   | \`- [x]\` / \`- [ ]\` |
| 删除线     | ✅   | \`~~text~~\`       |

## 代码高亮

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`
}

console.log(greet('Markdown'))
\`\`\`

\`\`\`python
def fibonacci(n: int) -> list[int]:
    a, b = 0, 1
    seq = []
    for _ in range(n):
        seq.append(a)
        a, b = b, a + b
    return seq

print(fibonacci(10))
\`\`\`

## 数学公式

行内公式：质能方程 $E = mc^2$，欧拉公式 $e^{i\\pi} + 1 = 0$。

块级公式：

$$
\\int_{a}^{b} f(x)\\, dx = F(b) - F(a)
$$

$$
\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}
$$

## Mermaid 图表

\`\`\`mermaid
flowchart LR
    A[用户输入 Markdown] --> B{解析器}
    B -->|remark-gfm| C[GFM 语法]
    B -->|rehype-katex| D[数学公式]
    B -->|rehype-highlight| E[代码高亮]
    C --> F[渲染预览]
    D --> F
    E --> F
\`\`\`

\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant E as 编辑器
    participant P as 预览
    U->>E: 输入 Markdown
    E->>P: 同步内容
    P-->>U: 实时渲染
\`\`\`

## 引用与删除

> 这是一段引用文字，用于展示 blockquote 样式。

~~这段文字被删除了~~，但仍然可见。

---

开始编辑左侧文本，右侧将实时显示渲染结果。刷新页面后内容不会丢失。
`
