import { useCallback, useEffect, useRef, useState } from 'react'
import Peer, { DataConnection } from 'peerjs'

// PeerJS 默认使用其官方公共信令服务器(0.peerjs.com)做一次握手,
// 握手成功后两台机器走 WebRTC 直连传输,无需自己部署任何后端。
//
// 协议:
//   主动方 connect → conn open 后发 {type:'hello'},进入 waiting 等待确认
//   被动方收到 connection 事件 → 进入 incoming,UI 显示接受/拒绝
//   被动方接受 → 发 {type:'accept'},双方 connected
//   被动方拒绝 → 发 {type:'reject'} 并关闭,主动方回到 waiting
//   内容同步:双方 connected 后各发一次本地内容,后续编辑实时同步
//   文件传输:{type:'file-meta'} 元数据 → 多条 {type:'file-chunk'} 分片 → {type:'file-end'}
//            任一方可发 {type:'file-cancel'} 中断

export type PeerStatus = 'idle' | 'waiting' | 'incoming' | 'connected' | 'error'

export interface FileTransfer {
  id: string
  direction: 'send' | 'receive'
  name: string
  size: number
  mime: string
  transferred: number
  status: 'active' | 'done' | 'error' | 'canceled'
  error?: string
}

// 已完成的传输会沉淀为一条消息,显示在消息流里
export interface Message {
  id: string
  direction: 'send' | 'receive'
  kind: 'image' | 'file'
  name: string
  size: number
  mime: string
  // 图片:data URL,直接 <img src> 显示
  dataUrl?: string
  // 普通文件:Blob URL,供"下载"按钮使用
  blobUrl?: string
  timestamp: number
}

interface UsePeerOptions {
  onRemoteContent: (content: string) => void
}

type ControlMsg =
  | { type: 'hello' }
  | { type: 'accept' }
  | { type: 'reject' }
  | { type: 'file-meta'; id: string; name: string; size: number; mime: string }
  | { type: 'file-chunk'; id: string; index: number; data: ArrayBuffer }
  | { type: 'file-end'; id: string }
  | { type: 'file-cancel'; id: string }

const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB
const CHUNK_SIZE = 16 * 1024 // 16KB,兼容所有浏览器
const BUFFER_HIGH = 4 * 1024 * 1024 // 4MB,达到则暂停发送
const BUFFER_LOW = 1 * 1024 * 1024 // 1MB,降到该值以下再继续

interface ReceiverState {
  meta: { id: string; name: string; size: number; mime: string }
  chunks: Map<number, ArrayBuffer>
  received: number
}

function isImageMime(mime: string): boolean {
  return mime.toLowerCase().startsWith('image/')
}

// 把分片拼成 Blob
function assembleBlob(chunks: Map<number, ArrayBuffer>, mime: string): Blob {
  const arr = Array.from(chunks.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, buf]) => buf)
  return new Blob(arr, { type: mime || 'application/octet-stream' })
}

// 把 Blob 转 data URL(用于图片内联显示)
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// 把 PeerJS 原生错误(英文)翻译成中文友好提示,重点处理 ID 冲突
function translatePeerError(type: string | undefined, raw: string): string {
  switch (type) {
    case 'unavailable-id':
      return '该 ID 已被占用,请换一个 1-99 之间的数字'
    case 'invalid-id':
      return 'ID 无效,请输入 1-99 之间的数字'
    case 'browser-incompatible':
      return '当前浏览器不支持 WebRTC,请换用 Chrome / Edge / Firefox 最新版'
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
    case 'network':
      return '无法连接信令服务器,请检查网络后重试'
    case 'webrtc':
      return 'WebRTC 连接失败,可能受 NAT 限制,尝试同一局域网或换网络'
    case 'peer-unavailable':
      return '对方不在线或 ID 不正确,请确认对方已设置好 ID'
    default:
      return raw || '连接出错'
  }
}

export function usePeer({ onRemoteContent }: UsePeerOptions) {
  const [myId, setMyId] = useState<string>('')
  const [status, setStatus] = useState<PeerStatus>('idle')
  const [error, setError] = useState<string>('')
  const [incomingFrom, setIncomingFrom] = useState<string>('')
  // 主动方发起 connect 后等待对方 accept 期间为 true,用于 UI 区分"待机"与"等待确认"
  const [awaitingAccept, setAwaitingAccept] = useState(false)
  const [transfers, setTransfers] = useState<FileTransfer[]>([])
  const [messages, setMessages] = useState<Message[]>([])

  const peerRef = useRef<Peer | null>(null)
  const connRef = useRef<DataConnection | null>(null)
  const pendingConnRef = useRef<DataConnection | null>(null)
  const onRemoteRef = useRef(onRemoteContent)
  onRemoteRef.current = onRemoteContent

  // 接收中的文件状态(按 fileId 索引)
  const receiversRef = useRef<Map<string, ReceiverState>>(new Map())
  // 发送方取消标记,由 cancelTransfer 设置,sendFile 循环检测
  const cancelRef = useRef<Set<string>>(new Set())
  // 已完成传输的自动清理定时器
  const cleanupTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // 增量更新某条传输记录
  const upsertTransfer = useCallback((t: FileTransfer) => {
    setTransfers(prev => {
      const idx = prev.findIndex(x => x.id === t.id)
      if (idx === -1) return [...prev, t]
      const next = prev.slice()
      next[idx] = t
      return next
    })
  }, [])

  const scheduleRemoval = useCallback((id: string, delay = 3000) => {
    // 已有定时器先清掉
    const existing = cleanupTimers.current.get(id)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      setTransfers(prev => prev.filter(x => x.id !== id))
      cleanupTimers.current.delete(id)
    }, delay)
    cleanupTimers.current.set(id, timer)
  }, [])

  // 触发浏览器下载(纯副作用)
  const triggerBrowserDownload = useCallback((blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  // 文件接收完成:图片生成 dataUrl 内联显示,其他文件触发下载并保留 blobUrl
  const finalizeReceivedFile = useCallback(async (meta: ReceiverState['meta'], chunks: Map<number, ArrayBuffer>) => {
    const blob = assembleBlob(chunks, meta.mime)
    const isImage = isImageMime(meta.mime)
    if (isImage) {
      // 图片:转 data URL,加到消息流,不自动下载
      try {
        const dataUrl = await blobToDataUrl(blob)
        setMessages(prev => [...prev, {
          id: meta.id,
          direction: 'receive',
          kind: 'image',
          name: meta.name,
          size: meta.size,
          mime: meta.mime,
          dataUrl,
          timestamp: Date.now(),
        }])
      } catch {
        // dataUrl 失败(文件过大),降级为下载
        triggerBrowserDownload(blob, meta.name)
      }
    } else {
      // 非图片:触发下载 + 保留 blobUrl 到消息流供再次下载
      const url = URL.createObjectURL(blob)
      triggerBrowserDownload(blob, meta.name)
      setMessages(prev => [...prev, {
        id: meta.id,
        direction: 'receive',
        kind: 'file',
        name: meta.name,
        size: meta.size,
        mime: meta.mime,
        blobUrl: url,
        timestamp: Date.now(),
      }])
    }
  }, [triggerBrowserDownload])

  // 处理收到的数据:返回消息类型供调用方决定状态切换
  const handleData = useCallback((data: unknown): 'accept' | 'reject' | 'content' | 'file' | null => {
    if (typeof data === 'string') {
      onRemoteRef.current(data)
      return 'content'
    }
    if (data && typeof data === 'object') {
      const msg = data as ControlMsg
      switch (msg.type) {
        case 'accept':
          return 'accept'
        case 'reject':
          return 'reject'
        case 'file-meta': {
          const meta = { id: msg.id, name: msg.name, size: msg.size, mime: msg.mime }
          receiversRef.current.set(msg.id, { meta, chunks: new Map(), received: 0 })
          upsertTransfer({
            id: meta.id,
            direction: 'receive',
            name: meta.name,
            size: meta.size,
            mime: meta.mime,
            transferred: 0,
            status: 'active',
          })
          return 'file'
        }
        case 'file-chunk': {
          const r = receiversRef.current.get(msg.id)
          if (r) {
            r.chunks.set(msg.index, msg.data)
            r.received += msg.data.byteLength
            upsertTransfer({
              id: r.meta.id,
              direction: 'receive',
              name: r.meta.name,
              size: r.meta.size,
              mime: r.meta.mime,
              transferred: r.received,
              status: 'active',
            })
          }
          return 'file'
        }
        case 'file-end': {
          const r = receiversRef.current.get(msg.id)
          if (r) {
            // 异步把分片拼成图片/文件,加到消息流
            void finalizeReceivedFile(r.meta, r.chunks)
            upsertTransfer({
              id: r.meta.id,
              direction: 'receive',
              name: r.meta.name,
              size: r.meta.size,
              mime: r.meta.mime,
              transferred: r.meta.size,
              status: 'done',
            })
            receiversRef.current.delete(msg.id)
            scheduleRemoval(msg.id)
          }
          return 'file'
        }
        case 'file-cancel': {
          const r = receiversRef.current.get(msg.id)
          if (r) {
            upsertTransfer({
              id: r.meta.id,
              direction: 'receive',
              name: r.meta.name,
              size: r.meta.size,
              mime: r.meta.mime,
              transferred: r.received,
              status: 'canceled',
            })
            receiversRef.current.delete(msg.id)
            scheduleRemoval(msg.id)
          }
          return 'file'
        }
      }
    }
    return null
  }, [upsertTransfer, scheduleRemoval, finalizeReceivedFile])

  // 通用 close/error 绑定
  const bindLifecycle = useCallback((conn: DataConnection, onAccept?: () => void) => {
    conn.on('data', (data) => {
      const kind = handleData(data)
      if (kind === 'accept' && onAccept) onAccept()
      else if (kind === 'reject') {
        setError('对方拒绝连接')
        setAwaitingAccept(false)
        setStatus('waiting')
        try { conn.close() } catch { /* 忽略 */ }
      }
    })
    conn.on('close', () => {
      if (connRef.current === conn) connRef.current = null
      setAwaitingAccept(false)
      // 连接断开:清理所有接收中和发送中的传输
      receiversRef.current.clear()
      cancelRef.current.clear()
      setTransfers(prev => prev.map(t =>
        t.status === 'active'
          ? { ...t, status: 'error', error: '连接已断开' }
          : t
      ))
      setStatus('waiting')
    })
    conn.on('error', (err) => {
      setError(err?.message ?? String(err))
      setStatus('error')
    })
  }, [handleData])

  // 主动方绑定:open 后发 hello,等待 accept
  const bindInitiator = useCallback((conn: DataConnection) => {
    const onOpen = () => {
      conn.send({ type: 'hello' } as ControlMsg)
      setStatus('waiting') // 等待对方确认
    }
    if (conn.open) onOpen()
    else conn.on('open', onOpen)
    bindLifecycle(conn, () => {
      connRef.current = conn
      setAwaitingAccept(false)
      setStatus('connected')
      setError('')
    })
  }, [bindLifecycle])

  // 被动方绑定(用户接受后调用):发 accept,转 connected
  const bindResponder = useCallback((conn: DataConnection) => {
    const onOpen = () => {
      conn.send({ type: 'accept' } as ControlMsg)
      connRef.current = conn
      setStatus('connected')
      setError('')
    }
    if (conn.open) onOpen()
    else conn.on('open', onOpen)
    bindLifecycle(conn)
  }, [bindLifecycle])

  // 用指定数字 ID 初始化 Peer
  const init = useCallback((id: string) => {
    if (peerRef.current) return
    const trimmed = id.trim()
    if (!trimmed) return
    setError('')
    setStatus('waiting')
    const peer = new Peer(trimmed)
    peerRef.current = peer

    peer.on('open', (assignedId) => {
      setMyId(assignedId)
    })

    peer.on('connection', (conn) => {
      // 已有连接或待确认请求时,拒绝新请求
      if (connRef.current || pendingConnRef.current) {
        try { conn.close() } catch { /* 忽略 */ }
        return
      }
      pendingConnRef.current = conn
      setIncomingFrom(conn.peer)
      setStatus('incoming')
    })

    peer.on('error', (err: unknown) => {
      const e = err as { message?: string; type?: string }
      setError(translatePeerError(e?.type, e?.message ?? String(err)))
      // ID 冲突(unavailable-id)等错误回到 idle,允许重新设置
      setStatus('idle')
      try { peer.destroy() } catch { /* 忽略 */ }
      peerRef.current = null
    })
  }, [])

  const acceptConn = useCallback(() => {
    const conn = pendingConnRef.current
    if (!conn) return
    pendingConnRef.current = null
    setIncomingFrom('')
    bindResponder(conn)
  }, [bindResponder])

  const rejectConn = useCallback(() => {
    const conn = pendingConnRef.current
    if (!conn) return
    pendingConnRef.current = null
    setIncomingFrom('')
    const sendReject = () => {
      try { conn.send({ type: 'reject' } as ControlMsg) } catch { /* 忽略 */ }
    }
    if (conn.open) sendReject()
    else conn.on('open', sendReject)
    // 留点时间让 reject 发出去再关闭
    setTimeout(() => {
      try { conn.close() } catch { /* 忽略 */ }
    }, 150)
    setStatus('waiting')
  }, [])

  // 卸载时释放资源
  useEffect(() => {
    return () => {
      connRef.current?.close()
      pendingConnRef.current?.close()
      peerRef.current?.destroy()
      peerRef.current = null
      connRef.current = null
      pendingConnRef.current = null
      cleanupTimers.current.forEach(t => clearTimeout(t))
      cleanupTimers.current.clear()
    }
  }, [])

  // 主动方:输入对方 ID 发起连接
  const connect = useCallback((remoteId: string) => {
    const peer = peerRef.current
    if (!peer || !remoteId) return
    setError('')
    setAwaitingAccept(true)
    const conn = peer.connect(remoteId.trim(), { reliable: true })
    bindInitiator(conn)
  }, [bindInitiator])

  // 主动断开当前连接
  const disconnect = useCallback(() => {
    connRef.current?.close()
    connRef.current = null
    setAwaitingAccept(false)
    setStatus('waiting')
  }, [])

  // 把本地最新内容发给对方
  const send = useCallback((content: string) => {
    const conn = connRef.current
    if (conn && conn.open) {
      conn.send(content)
    }
  }, [])

  // 拿到底层 RTCDataChannel 做背压控制(PeerJS 未在公开类型中暴露,但运行时存在)
  const getDC = useCallback((conn: DataConnection): RTCDataChannel | null => {
    const c = conn as unknown as { dataChannel?: RTCDataChannel; _dc?: RTCDataChannel }
    return c.dataChannel ?? c._dc ?? null
  }, [])

  // 发送文件:分片 + 背压 + 可取消
  const sendFile = useCallback(async (file: File): Promise<void> => {
    const conn = connRef.current
    if (!conn || !conn.open) {
      setError('尚未连接,无法发送文件')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`文件超过 200MB 限制(当前 ${(file.size / 1024 / 1024).toFixed(1)} MB)`)
      return
    }
    if (file.size === 0) {
      setError('文件为空,无法发送')
      return
    }

    const id = (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.()
      ?? `f-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const total = Math.ceil(file.size / CHUNK_SIZE)

    upsertTransfer({
      id,
      direction: 'send',
      name: file.name,
      size: file.size,
      mime: file.type,
      transferred: 0,
      status: 'active',
    })

    const failWith = (err: string, transferred: number) => {
      upsertTransfer({
        id,
        direction: 'send',
        name: file.name,
        size: file.size,
        mime: file.type,
        transferred,
        status: 'error',
        error: err,
      })
      scheduleRemoval(id)
    }

    // 1. 发送元数据
    try {
      conn.send({ type: 'file-meta', id, name: file.name, size: file.size, mime: file.type } as ControlMsg)
    } catch (e) {
      failWith(String(e), 0)
      return
    }

    // 2. 设置 bufferedAmountLowThreshold(若可访问 dataChannel)
    const dc = getDC(conn)
    if (dc) {
      try { dc.bufferedAmountLowThreshold = BUFFER_LOW } catch { /* 忽略 */ }
    }

    // 3. 分片发送
    for (let i = 0; i < total; i++) {
      // 已取消
      if (cancelRef.current.has(id)) {
        cancelRef.current.delete(id)
        try { conn.send({ type: 'file-cancel', id } as ControlMsg) } catch { /* 忽略 */ }
        upsertTransfer({
          id,
          direction: 'send',
          name: file.name,
          size: file.size,
          mime: file.type,
          transferred: i * CHUNK_SIZE,
          status: 'canceled',
        })
        scheduleRemoval(id)
        return
      }

      const offset = i * CHUNK_SIZE
      const end = Math.min(offset + CHUNK_SIZE, file.size)
      let buf: ArrayBuffer
      try {
        buf = await file.slice(offset, end).arrayBuffer()
      } catch (e) {
        failWith(String(e), offset)
        return
      }

      // 背压等待:bufferedAmount 超过阈值就等它降下来
      if (dc) {
        while (dc.bufferedAmount > BUFFER_HIGH) {
          // 连接已断开则放弃
          if (!connRef.current || connRef.current !== conn || !conn.open) {
            failWith('连接已断开', offset)
            return
          }
          await new Promise<void>(resolve => setTimeout(resolve, 10))
        }
      }

      // 再次检查连接是否还在
      if (!connRef.current || connRef.current !== conn || !conn.open) {
        failWith('连接已断开', offset)
        return
      }

      try {
        conn.send({ type: 'file-chunk', id, index: i, data: buf } as ControlMsg)
      } catch (e) {
        failWith(String(e), offset)
        return
      }

      upsertTransfer({
        id,
        direction: 'send',
        name: file.name,
        size: file.size,
        mime: file.type,
        transferred: end,
        status: 'active',
      })
    }

    // 4. 循环结束后再次检查取消
    if (cancelRef.current.has(id)) {
      cancelRef.current.delete(id)
      try { conn.send({ type: 'file-cancel', id } as ControlMsg) } catch { /* 忽略 */ }
      upsertTransfer({
        id,
        direction: 'send',
        name: file.name,
        size: file.size,
        mime: file.type,
        transferred: file.size,
        status: 'canceled',
      })
      scheduleRemoval(id)
      return
    }

    // 5. 发送结束标记
    try {
      conn.send({ type: 'file-end', id } as ControlMsg)
    } catch (e) {
      failWith(String(e), file.size)
      return
    }

    upsertTransfer({
      id,
      direction: 'send',
      name: file.name,
      size: file.size,
      mime: file.type,
      transferred: file.size,
      status: 'done',
    })
    scheduleRemoval(id)

    // 6. 发送方也把文件加到自己的消息流(图片内联,其他文件带 blobUrl)
    const isImage = isImageMime(file.type)
    if (isImage) {
      try {
        const dataUrl = await blobToDataUrl(file)
        setMessages(prev => [...prev, {
          id,
          direction: 'send',
          kind: 'image',
          name: file.name,
          size: file.size,
          mime: file.type,
          dataUrl,
          timestamp: Date.now(),
        }])
      } catch {
        // 忽略:发送方本地预览失败不影响传输
      }
    } else {
      const url = URL.createObjectURL(file)
      setMessages(prev => [...prev, {
        id,
        direction: 'send',
        kind: 'file',
        name: file.name,
        size: file.size,
        mime: file.type,
        blobUrl: url,
        timestamp: Date.now(),
      }])
    }
  }, [upsertTransfer, scheduleRemoval, getDC])

  // 取消传输(发送或接收都可调)
  const cancelTransfer = useCallback((id: string) => {
    setTransfers(prev => {
      const t = prev.find(x => x.id === id)
      if (!t || t.status !== 'active') return prev
      if (t.direction === 'send') {
        // 标记,由 sendFile 循环检测并通知对方
        cancelRef.current.add(id)
      } else {
        // 接收端:通知对方停止 + 清理本地
        const conn = connRef.current
        if (conn && conn.open) {
          try { conn.send({ type: 'file-cancel', id } as ControlMsg) } catch { /* 忽略 */ }
        }
        receiversRef.current.delete(id)
        const next = prev.map(x => x.id === id ? { ...x, status: 'canceled' as const } : x)
        scheduleRemoval(id)
        return next
      }
      return prev
    })
  }, [scheduleRemoval])

  // 清空消息流(同时释放 blobUrl 避免内存泄漏)
  const clearMessages = useCallback(() => {
    setMessages(prev => {
      prev.forEach(m => {
        if (m.blobUrl) URL.revokeObjectURL(m.blobUrl)
      })
      return []
    })
  }, [])

  return {
    myId,
    status,
    error,
    incomingFrom,
    awaitingAccept,
    transfers,
    messages,
    init,
    acceptConn,
    rejectConn,
    connect,
    disconnect,
    send,
    sendFile,
    cancelTransfer,
    clearMessages,
  }
}
