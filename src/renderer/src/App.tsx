import { useEffect } from 'react'
import { ChatPage } from './components/ChatPage'
import { FolderPicker } from './components/FolderPicker'
import { bindIpc } from './ipc'
import { useSession } from './session/store'

export function App() {
  const cwd = useSession((state) => state.cwd)

  useEffect(() => {
    bindIpc()
  }, [])

  return cwd ? <ChatPage /> : <FolderPicker />
}
