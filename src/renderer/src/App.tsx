import { useEffect, useState } from 'react'
import { ChatPage } from './components/ChatPage'
import { FolderPicker } from './components/FolderPicker'
import { TooltipProvider } from './components/ui/tooltip'
import { Playground } from './playground/Playground'
import { useSession } from './session/store'

function usePlayground() {
  const [on, setOn] = useState(() => window.location.hash === '#playground')
  useEffect(() => {
    const sync = () => setOn(window.location.hash === '#playground')
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  return on
}

export function App() {
  const playground = usePlayground()
  const cwd = useSession((state) => state.cwd)
  const page = playground ? <Playground /> : cwd ? <ChatPage /> : <FolderPicker />
  return <TooltipProvider>{page}</TooltipProvider>
}
