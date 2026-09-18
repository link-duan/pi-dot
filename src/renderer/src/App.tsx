import { ChatPage } from './components/ChatPage'
import { FolderPicker } from './components/FolderPicker'
import { useSession } from './session/store'

export function App() {
  const cwd = useSession((state) => state.cwd)
  return cwd ? <ChatPage /> : <FolderPicker />
}
