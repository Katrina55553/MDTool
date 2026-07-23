import { useEffect, useState } from 'react'
import mermaid from 'mermaid'
import { useTheme } from '../context/ThemeContext'

let idCounter = 0

interface MermaidBlockProps {
  code: string
}

export default function MermaidBlock({ code }: MermaidBlockProps) {
  const { theme } = useTheme()
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const id = `mermaid-svg-${idCounter++}`

    setError(null)
    setSvg(null)

    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
    })

    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
    }
  }, [code, theme])

  if (error) {
    return <div className="mermaid-error">Mermaid 渲染失败：{error}</div>
  }
  if (svg) {
    return <div className="mermaid" dangerouslySetInnerHTML={{ __html: svg }} />
  }
  return <div className="mermaid">渲染中…</div>
}
