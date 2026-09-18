import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { bindIpc, releaseIpcQueue } from './ipc'
import { applySystemTheme } from './lib/theme'
import { applyLiveSnapshot, useSession } from './session/store'
import './styles.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('missing #root')
}

applySystemTheme()
bindIpc()
const snapshot = await window.pi.getSnapshot()
if (snapshot) applyLiveSnapshot(snapshot)
else useSession.setState({ lastCwd: await window.pi.getLastCwd() })
releaseIpcQueue()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
