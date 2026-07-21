import { useEffect } from 'react'
import { imageFileFromClipboard, isEditorPasteTarget } from '../utils/clipboardImage'

interface UsePasteImageSendOptions {
  connected: boolean
  onSendFile: (file: File) => void | Promise<void>
}

export function usePasteImageSend({ connected, onSendFile }: UsePasteImageSendOptions) {
  useEffect(() => {
    if (!connected) return

    const handlePaste = (e: ClipboardEvent) => {
      if (isEditorPasteTarget(e.target)) return

      const file = imageFileFromClipboard(e.clipboardData)
      if (!file) return

      e.preventDefault()
      void onSendFile(file)
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [connected, onSendFile])
}
