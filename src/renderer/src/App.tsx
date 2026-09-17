import { useEffect } from 'react'
import { ChatPage } from './components/ChatPage'
import { FolderPicker } from './components/FolderPicker'
import { bindIpc } from './ipc'
import { applySystemTheme } from './lib/theme'
import { useSession } from './session/store'

export function App() {
  const cwd = useSession((state) => state.cwd)
  const init = useSession((state) => state.init)

  useEffect(() => applySystemTheme(), [])
  useEffect(() => {
    bindIpc()
    void init()
  }, [init])

  return cwd ? <ChatPage /> : <FolderPicker />
}
