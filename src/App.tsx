import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from './components/Editor'
import Preview from './components/Preview'
import Toolbar from './components/Toolbar'
import MessageStream from './components/MessageStream'
import { ThemeProvider } from './context/ThemeContext'
import { useLocalStorage } from './hooks/useLocalStorage'
import { usePeer } from './hooks/usePeer'
import { sampleContent } from './utils/sampleContent'

type View = 'transfer' | 'markdown'

function AppContent() {
  const [view, setView] = useState<View>('transfer')

  // 共享笔记:传输视图的同步文本框(P2P 实时同步)
  const [noteContent, setNoteContent] = useLocalStorage<string>('note-content', '')
  const noteRef = useRef(noteContent)
  noteRef.current = noteContent

  // Markdown 编辑器内容(markdown 视图,本地使用,不同步)
  const [mdContent, setMdContent] = useLocalStorage<string>('md-content', sampleContent)

  // 远端内容直接覆盖本地(用户已确认简单覆盖即可)
  const handleRemoteContent = useCallback((remote: string) => {
    setNoteContent(remote)
  }, [setNoteContent])

  const {
    myId, status, error, incomingFrom, awaitingAccept, transfers, messages,
    init, acceptConn, rejectConn, connect, disconnect, send, sendFile, cancelTransfer, clearMessages,
  } = usePeer({ onRemoteContent: handleRemoteContent })

  // 连接刚建立时,主动同步一次本地内容给对方
  const prevStatus = useRef(status)
  useEffect(() => {
    if (prevStatus.current !== 'connected' && status === 'connected') {
      send(noteRef.current)
    }
    prevStatus.current = status
  }, [status, send])

  // 共享笔记编辑:更新自己 + 发给对方
  const handleNoteChange = useCallback((value: string) => {
    setNoteContent(value)
    send(value)
  }, [setNoteContent, send])

  const connected = status === 'connected'

  return (
    <div className="app">
      <Toolbar
        view={view}
        onSwitchView={setView}
        peerId={myId}
        peerStatus={status}
        peerError={error}
        incomingFrom={incomingFrom}
        awaitingAccept={awaitingAccept}
        transfers={transfers}
        onInit={init}
        onConnect={connect}
        onDisconnect={disconnect}
        onAccept={acceptConn}
        onReject={rejectConn}
        onSendFile={sendFile}
        onCancelTransfer={cancelTransfer}
      />
      {view === 'transfer' ? (
        <div className="transfer-view">
          <div className="transfer-stream">
            <MessageStream
              messages={messages}
              transfers={transfers}
              connected={connected}
              onClear={clearMessages}
            />
          </div>
          <div className="transfer-note">
            <div className="note-header">
              <span className="note-title">共享笔记</span>
              <span className="note-hint">
                {connected ? '双方实时同步' : '连接后双方可实时同步编辑'}
              </span>
            </div>
            <textarea
              className="note-textarea"
              value={noteContent}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder={connected ? '输入文字,对方会实时看到…' : '设置 ID 并连接后,此处输入的文字会同步给对方'}
              spellCheck={false}
            />
          </div>
        </div>
      ) : (
        <div className="main">
          <div className="pane pane-editor">
            <Editor value={mdContent} onChange={setMdContent} />
          </div>
          <div className="pane pane-preview">
            <Preview content={mdContent} />
          </div>
        </div>
      )}
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
