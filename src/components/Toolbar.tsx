import { useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import type { FileTransfer, PeerStatus } from '../hooks/usePeer'

interface ToolbarProps {
  peerId: string
  peerStatus: PeerStatus
  peerError: string
  incomingFrom: string
  awaitingAccept: boolean
  accepting: boolean
  transfers: FileTransfer[]
  onInit: (id: string) => void
  onConnect: (remoteId: string) => void
  onCancelConnect: () => void
  onDisconnect: () => void
  onAccept: () => void
  onReject: () => void
  onSendFile: (file: File) => void | Promise<void>
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.36 9.36 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function statusLabel(status: PeerStatus): string {
  switch (status) {
    case 'idle': return '未设置 ID'
    case 'waiting': return '等待连接'
    case 'incoming': return '收到请求'
    case 'connected': return '已连接'
    case 'error': return '连接错误'
  }
}

function sanitizeIdInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 2)
  if (!digits) return ''
  const n = parseInt(digits, 10)
  if (isNaN(n)) return ''
  return String(Math.min(99, Math.max(1, n)))
}

export default function Toolbar({
  peerId,
  peerStatus,
  peerError,
  incomingFrom,
  awaitingAccept,
  accepting,
  transfers,
  onInit,
  onConnect,
  onCancelConnect,
  onDisconnect,
  onAccept,
  onReject,
  onSendFile,
}: ToolbarProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const [myIdInput, setMyIdInput] = useState('')
  const [remoteId, setRemoteId] = useState('')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sendingActive = transfers.some(t => t.direction === 'send' && t.status === 'active')

  const handleCopy = async () => {
    if (!peerId) return
    try {
      await navigator.clipboard.writeText(peerId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard 可能被浏览器拦截,忽略 */
    }
  }

  const handleInitSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = sanitizeIdInput(myIdInput)
    if (v) {
      onInit(v)
      setMyIdInput('')
    }
  }

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = sanitizeIdInput(remoteId)
    if (v) {
      onConnect(v)
      setRemoteId('')
    }
  }

  const handleFilePick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) {
      void onSendFile(file)
    }
  }

  const connected = peerStatus === 'connected'
  const incoming = peerStatus === 'incoming'
  const needInit = peerStatus === 'idle' && !peerId

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <div className="toolbar-title">DuoLink</div>
      </div>

      <div className="peer-panel">
        {needInit ? (
          <form className="peer-connect" onSubmit={handleInitSubmit}>
            <span className="peer-id-label">设置我的 ID (1-99):</span>
            <input
              type="text"
              inputMode="numeric"
              className="peer-input peer-input-id"
              placeholder="1-99"
              value={myIdInput}
              onChange={(e) => setMyIdInput(sanitizeIdInput(e.target.value))}
            />
            <button type="submit" className="peer-btn" disabled={!sanitizeIdInput(myIdInput)}>
              设置
            </button>
          </form>
        ) : (
          <>
            <div className="peer-id" title="你的设备 ID,发给对方让其连接">
              <span className="peer-id-label">我的 ID:</span>
              <code className="peer-id-value">{peerId || '获取中…'}</code>
              {peerId && (
                <button
                  type="button"
                  className="peer-copy-btn"
                  onClick={handleCopy}
                  title="复制 ID"
                  aria-label="复制 ID"
                >
                  <CopyIcon />
                  {copied && <span className="peer-copy-tip">已复制</span>}
                </button>
              )}
            </div>

            {incoming ? (
              <div className="peer-incoming">
                <span className="peer-incoming-text">
                  {incomingFrom || '对方'} 请求连接
                </span>
                <button
                  type="button"
                  className="peer-btn peer-btn-accept"
                  onClick={onAccept}
                  disabled={accepting}
                >
                  {accepting ? '连接中…' : '接受'}
                </button>
                <button type="button" className="peer-btn peer-btn-reject" onClick={onReject} disabled={accepting}>
                  拒绝
                </button>
              </div>
            ) : connected ? (
              <>
                <button
                  type="button"
                  className="peer-btn peer-btn-file"
                  onClick={handleFilePick}
                  disabled={sendingActive}
                  title={sendingActive ? '正在发送另一个文件,请等待完成' : '发送文件或图片(≤200MB),也可 Ctrl+V 粘贴图片'}
                >
                  <UploadIcon />
                  发送文件
                </button>
                <button type="button" className="peer-btn peer-btn-disconnect" onClick={onDisconnect}>
                  断开连接
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="peer-file-input"
                  onChange={handleFileChange}
                />
              </>
            ) : awaitingAccept ? (
              <div className="peer-waiting">
                <span className="peer-waiting-tip">等待对方确认…</span>
                <button type="button" className="peer-btn peer-btn-disconnect" onClick={onCancelConnect}>
                  取消
                </button>
              </div>
            ) : (
              <form className="peer-connect" onSubmit={handleConnectSubmit}>
                <input
                  type="text"
                  inputMode="numeric"
                  className="peer-input peer-input-id"
                  placeholder="对方 ID (1-99)"
                  value={remoteId}
                  onChange={(e) => setRemoteId(sanitizeIdInput(e.target.value))}
                />
                <button type="submit" className="peer-btn" disabled={!sanitizeIdInput(remoteId)}>
                  连接
                </button>
              </form>
            )}
          </>
        )}

        <span className={`peer-status peer-status-${peerStatus}`}>{statusLabel(peerStatus)}</span>

        {peerError && <span className="peer-error" title={peerError}>{peerError}</span>}
      </div>

      <a
        className="theme-btn"
        href="https://github.com/Katrina55553/DuoLink"
        target="_blank"
        rel="noopener noreferrer"
        title="GitHub 仓库"
        aria-label="GitHub 仓库"
      >
        <GitHubIcon />
      </a>

      <button
        className="theme-btn"
        onClick={toggleTheme}
        title={isDark ? '切换到浅色模式' : '切换到深色模式'}
        aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  )
}
