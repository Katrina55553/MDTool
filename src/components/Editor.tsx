import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { githubLight, githubDark } from '@uiw/codemirror-theme-github'
import { useTheme } from '../context/ThemeContext'

interface EditorProps {
  value: string
  onChange: (value: string) => void
}

export default function Editor({ value, onChange }: EditorProps) {
  const { theme } = useTheme()
  return (
    <div className="editor-wrapper">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[markdown()]}
        theme={theme === 'dark' ? githubDark : githubLight}
        height="100%"
        style={{ height: '100%' }}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
        }}
      />
    </div>
  )
}
