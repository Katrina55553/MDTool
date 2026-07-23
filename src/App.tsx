import { useCallback, useEffect, useRef } from 'react'
import Editor from './components/Editor'
import NoteSidebar from './components/NoteSidebar'
import Preview from './components/Preview'
import Toolbar from './components/Toolbar'
import MessageStream from './components/MessageStream'
import { ThemeProvider } from './context/ThemeContext'
import { useNotes } from './hooks/useNotes'
import { usePasteImageSend } from './hooks/usePasteImageSend'
import { usePeer } from './hooks/usePeer'
import type { NotesState } from './types/note'
import { isNotesState } from './utils/noteUtils'

function AppContent() {
  const notesRef = useRef<NotesState | null>(null)
  const replaceStateRef = useRef<(state: NotesState) => void>(() => {})
  const sendRef = useRef<(content: string) => void>(() => {})

  const handleRemoteContent = useCallback((remote: string) => {
    try {
      const parsed = JSON.parse(remote)
      if (isNotesState(parsed)) {
        replaceStateRef.current(parsed)
      }
    } catch {
      /* 忽略非法同步数据 */
    }
  }, [])

  const {
    myId, status, error, incomingFrom, awaitingAccept, accepting, transfers, messages,
    init, acceptConn, rejectConn, connect, cancelConnect, disconnect, send, sendFile, cancelTransfer, clearMessages,
  } = usePeer({ onRemoteContent: handleRemoteContent })

  const syncNotes = useCallback((next: NotesState) => {
    notesRef.current = next
    sendRef.current(JSON.stringify(next))
  }, [])

  const {
    state,
    activeNote,
    replaceState,
    setActiveContent,
    selectNote,
    createNote,
    deleteNote,
  } = useNotes({ onStateChange: syncNotes })

  // 把会变化的引用通过 effect 同步到 ref,避免渲染期写 ref 的副作用
  useEffect(() => { sendRef.current = send }, [send])
  useEffect(() => { replaceStateRef.current = replaceState }, [replaceState])
  useEffect(() => { notesRef.current = state }, [state])

  const prevStatus = useRef(status)
  useEffect(() => {
    if (prevStatus.current !== 'connected' && status === 'connected' && notesRef.current) {
      send(JSON.stringify(notesRef.current))
    }
    prevStatus.current = status
  }, [status, send])

  const content = activeNote?.content ?? ''
  const connected = status === 'connected'

  usePasteImageSend({ connected, onSendFile: sendFile })

  return (
    <div className="app">
      <Toolbar
        peerId={myId}
        peerStatus={status}
        peerError={error}
        incomingFrom={incomingFrom}
        awaitingAccept={awaitingAccept}
        accepting={accepting}
        transfers={transfers}
        onInit={init}
        onConnect={connect}
        onCancelConnect={cancelConnect}
        onDisconnect={disconnect}
        onAccept={acceptConn}
        onReject={rejectConn}
        onSendFile={sendFile}
      />
      <div className="transfer-view">
        <div className="transfer-stream">
          <MessageStream
            messages={messages}
            transfers={transfers}
            connected={connected}
            onClear={clearMessages}
            onCancel={cancelTransfer}
          />
        </div>
        <div className="transfer-note">
          <div className="note-header">
            <span className="note-title">共享笔记</span>
            <span className="note-hint">
              {connected ? '双方实时同步 Markdown' : '连接后双方可实时同步编辑'}
            </span>
          </div>
          <div className="workspace workspace-notes">
            <NoteSidebar
              notes={state.notes}
              activeNoteId={state.activeNoteId}
              onSelect={selectNote}
              onCreate={createNote}
              onDelete={deleteNote}
            />
            <div className="main">
              <div className="pane pane-editor">
                <Editor value={content} onChange={setActiveContent} />
              </div>
              <div className="pane pane-preview">
                <Preview content={content} />
              </div>
            </div>
          </div>
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
