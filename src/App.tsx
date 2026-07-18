import Editor from './components/Editor'
import Preview from './components/Preview'
import Toolbar from './components/Toolbar'
import { ThemeProvider } from './context/ThemeContext'
import { useLocalStorage } from './hooks/useLocalStorage'
import { sampleContent } from './utils/sampleContent'

function AppContent() {
  const [content, setContent] = useLocalStorage<string>('md-content', sampleContent)
  return (
    <div className="app">
      <Toolbar />
      <div className="main">
        <div className="pane pane-editor">
          <Editor value={content} onChange={setContent} />
        </div>
        <div className="pane pane-preview">
          <Preview content={content} />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}
