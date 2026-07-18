import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { useTheme } from '../context/ThemeContext'

let idCounter = 0

interface MermaidBlockProps {
  code: string
}

export default function MermaidBlock({ code }: MermaidBlockProps) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const id = `mermaid-svg-${idCounter++}`

    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'system-ui, sans-serif',
    })

    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (cancelled) return
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
      })

    return () => {
      cancelled = true
    }
  }, [code, theme])

  if (error) {
    return <div className="mermaid-error">Mermaid 渲染失败：{error}</div>
  }
  return <div className="mermaid" ref={containerRef} />
}
