import { useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import type { FileTransfer, PeerStatus } from '../hooks/usePeer'

type View = 'transfer' | 'markdown'

interface ToolbarProps {
  view: View
  onSwitchView: (view: View) => void
  peerId: string
  peerStatus: PeerStatus
  peerError: string
  incomingFrom: string
  awaitingAccept: boolean
  transfers: FileTransfer[]
  onInit: (id: string) => void
  onConnect: (remoteId: string) => void
  onDisconnect: () => void
  onAccept: () => void
  onReject: () => void
  onSendFile: (file: File) => void | Promise<void>
  onCancelTransfer: (id: string) => void
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

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

// 限制为 1-99 的整数
function sanitizeIdInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 2)
  if (!digits) return ''
  const n = parseInt(digits, 10)
  if (isNaN(n)) return ''
  return String(Math.min(99, Math.max(1, n)))
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function transferStatusLabel(t: FileTransfer): string {
  switch (t.status) {
    case 'active': return t.direction === 'send' ? '发送中' : '接收中'
    case 'done': return t.direction === 'send' ? '已发送' : '已保存'
    case 'error': return '失败'
    case 'canceled': return '已取消'
  }
}

export default function Toolbar({
  view,
  onSwitchView,
  peerId,
  peerStatus,
  peerError,
  incomingFrom,
  awaitingAccept,
  transfers,
  onInit,
  onConnect,
  onDisconnect,
  onAccept,
  onReject,
  onSendFile,
  onCancelTransfer,
}: ToolbarProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const [myIdInput, setMyIdInput] = useState('')
  const [remoteId, setRemoteId] = useState('')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 发送中(单文件,有 active 中的发送任务时不允许再选)
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
    // 重置 value 允许选同一个文件再次触发
    e.target.value = ''
    if (file) {
      void onSendFile(file)
    }
  }

  const connected = peerStatus === 'connected'
  const incoming = peerStatus === 'incoming'
  const needInit = peerStatus === 'idle' && !peerId

  return (
    <>
      <header className="toolbar">
        <div className="toolbar-brand">
          <div className="toolbar-title">P2P 传输</div>
          <button
            type="button"
            className="view-switch-btn"
            onClick={() => onSwitchView(view === 'transfer' ? 'markdown' : 'transfer')}
            title={view === 'transfer' ? '切换到 Markdown 工具' : '返回传输界面'}
          >
            {view === 'transfer' ? 'Markdown 工具' : '返回传输'}
          </button>
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
                  <button type="button" className="peer-btn peer-btn-accept" onClick={onAccept}>
                    接受
                  </button>
                  <button type="button" className="peer-btn peer-btn-reject" onClick={onReject}>
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
                    title={sendingActive ? '正在发送另一个文件,请等待完成' : '发送文件给对方(≤200MB)'}
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
                <span className="peer-waiting-tip">等待对方确认…</span>
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

        <button
          className="theme-btn"
          onClick={toggleTheme}
          title={isDark ? '切换到浅色模式' : '切换到深色模式'}
          aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      {/* markdown 视图下仍显示传输条;transfer 视图由 MessageStream 内联展示 */}
      {view === 'markdown' && transfers.length > 0 && (
        <div className="transfers-bar" role="region" aria-label="文件传输">
          {transfers.map(t => {
            const pct = t.size > 0 ? Math.min(100, Math.round((t.transferred / t.size) * 100)) : 0
            const isActive = t.status === 'active'
            return (
              <div
                key={t.id}
                className={`transfer-card transfer-${t.direction} transfer-status-${t.status}`}
                title={t.error || transferStatusLabel(t)}
              >
                <div className="transfer-icon" aria-hidden="true">
                  {t.direction === 'send' ? '↑' : '↓'}
                </div>
                <div className="transfer-main">
                  <div className="transfer-row">
                    <span className="transfer-name">{t.name}</span>
                    <span className="transfer-size">{formatSize(t.size)}</span>
                  </div>
                  <div className="transfer-progress">
                    <div className="transfer-progress-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="transfer-row transfer-row-meta">
                    <span className={`transfer-status-label transfer-status-label-${t.status}`}>
                      {transferStatusLabel(t)}
                      {isActive && ` · ${pct}%`}
                      {t.error ? ` · ${t.error}` : ''}
                    </span>
                    {isActive ? (
                      <button
                        type="button"
                        className="transfer-cancel-btn"
                        onClick={() => onCancelTransfer(t.id)}
                        title="取消传输"
                        aria-label="取消传输"
                      >
                        <CloseIcon />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
