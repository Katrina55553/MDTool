const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
}

function extFromMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? 'png'
}

/** 从剪贴板事件中提取第一张图片,并补全文件名 */
export function imageFileFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null

  for (const item of data.items) {
    if (!item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (!file) continue
    if (file.name) return file
    const ext = extFromMime(file.type || 'image/png')
    return new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type || 'image/png' })
  }

  return null
}

/** 粘贴目标是否在 Markdown 编辑器内(应保留编辑器默认行为) */
export function isEditorPasteTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('.cm-editor')
}
