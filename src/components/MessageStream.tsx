import { useEffect, useRef } from 'react'
import type { FileTransfer, Message } from '../hooks/usePeer'

interface MessageStreamProps {
  messages: Message[]
  transfers: FileTransfer[]
  connected: boolean
  onClear: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export default function MessageStream({ messages, transfers, connected, onClear }: MessageStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // 新消息或传输进度变化时,自动滚到底部
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, transfers])

  // 进行中的传输也作为消息显示(实时进度)
  const activeTransfers = transfers.filter(t => t.status === 'active')
  const hasContent = messages.length > 0 || activeTransfers.length > 0

  return (
    <div className="stream-wrap">
      <div className="stream-header">
        <span className="stream-title">
          {connected ? '传输记录' : '未连接'}
        </span>
        {hasContent && (
          <button type="button" className="stream-clear-btn" onClick={onClear} title="清空记录">
            <TrashIcon />
            清空
          </button>
        )}
      </div>
      <div className="stream-scroll" ref={scrollRef}>
        {!hasContent ? (
          <div className="stream-empty">
            {connected
              ? '连接已建立。发送的图片会显示在这里,底部文本框可双方同步编辑。'
              : '设置 ID 并连接后,即可在此传输图片与文字。'}
          </div>
        ) : (
          <>
            {messages.map(m => (
              <div key={m.id} className={`msg msg-${m.direction}`}>
                <div className="msg-bubble">
                  {m.kind === 'image' && m.dataUrl ? (
                    <a href={m.dataUrl} download={m.name} className="msg-image-link" title="点击下载">
                      <img src={m.dataUrl} alt={m.name} className="msg-image" />
                    </a>
                  ) : (
                    <a
                      href={m.blobUrl || '#'}
                      download={m.name}
                      className="msg-file"
                      title="点击下载"
                    >
                      <span className="msg-file-icon" aria-hidden="true">📎</span>
                      <span className="msg-file-name">{m.name}</span>
                      <span className="msg-file-size">{formatSize(m.size)}</span>
                      <DownloadIcon />
                    </a>
                  )}
                  <div className="msg-meta">
                    <span className="msg-direction">
                      {m.direction === 'send' ? '我发送' : '对方发送'}
                    </span>
                    <span className="msg-time">{formatTime(m.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
            {activeTransfers.map(t => {
              const pct = t.size > 0 ? Math.min(100, Math.round((t.transferred / t.size) * 100)) : 0
              const isImage = t.mime.toLowerCase().startsWith('image/')
              return (
                <div key={t.id} className={`msg msg-${t.direction}`}>
                  <div className="msg-bubble msg-transferring">
                    <div className="msg-transfer-name">
                      <span aria-hidden="true">{isImage ? '🖼️' : '📎'}</span>
                      <span>{t.name}</span>
                    </div>
                    <div className="msg-transfer-progress">
                      <div className="msg-transfer-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="msg-transfer-meta">
                      <span>{t.direction === 'send' ? '发送中' : '接收中'} · {pct}%</span>
                      <span>{formatSize(t.transferred)} / {formatSize(t.size)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
