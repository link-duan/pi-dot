import { useEffect } from 'react'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
  type LexicalEditor,
} from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { tokenPath } from '@/lib/path'
import { $insertFilePath } from './insert-file'

export function ComposerPastePlugin({ cwd }: { cwd: string | null }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const clipboard = event instanceof ClipboardEvent ? event.clipboardData : null
        if (!clipboard) return false
        const paths = clipboardFilePaths(clipboard)
        const image = paths.length === 0 ? clipboardImage(clipboard) : null
        if (paths.length > 0 || image) {
          event.preventDefault()
          void pasteChips(editor, cwd, paths, image).catch((error: unknown) => {
            console.error('Failed to paste file chips', error)
          })
          return true
        }
        const text = clipboard.getData('text/plain')
        if (!text) return false
        event.preventDefault()
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) selection.insertRawText(text)
        })
        return true
      },
      COMMAND_PRIORITY_HIGH,
    )
  }, [cwd, editor])
  return null
}

type ElectronFile = File & { path?: string }

export function clipboardFilePaths(clipboard: DataTransfer): string[] {
  const fromFiles = [...clipboard.files]
    .map((file) => (file as ElectronFile).path)
    .filter((path): path is string => Boolean(path))
  if (fromFiles.length > 0) return fromFiles
  const uriList = clipboard.getData('text/uri-list')
  if (!uriList) return []
  return uriList
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map(fileUrlToPath)
    .filter((path): path is string => Boolean(path))
}

export function fileUrlToPath(url: string): string | null {
  if (!url.startsWith('file:')) return null
  try {
    const parsed = new URL(url)
    let path = decodeURIComponent(parsed.pathname)
    if (/^\/[a-zA-Z]:\//.test(path)) path = path.slice(1)
    return path
  } catch (error) {
    console.debug('Failed to parse clipboard file URL', url, error)
    return null
  }
}

function clipboardImage(clipboard: DataTransfer): File | null {
  for (const item of clipboard.items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  for (const file of clipboard.files) {
    if (!(file as ElectronFile).path && file.type.startsWith('image/')) return file
  }
  return null
}

async function pasteChips(
  editor: LexicalEditor,
  cwd: string | null,
  paths: string[],
  image: File | null,
): Promise<void> {
  const refs: string[] = []
  const home = window.pi.homedir
  const base = cwd || '/'
  if (paths.length > 0) {
    const stats = await window.pi.statPaths(paths)
    for (const item of stats) refs.push(tokenPath(item.path, base, home, item.isDirectory))
  } else if (image) {
    const bytes = new Uint8Array(await image.arrayBuffer())
    const abs = await window.pi.saveClipboardImage(bytes, image.type || 'image/png')
    refs.push(tokenPath(abs, base, home, false))
  }
  if (refs.length === 0) return
  editor.update(() => {
    for (const path of refs) $insertFilePath(path)
  })
  editor.focus()
}
