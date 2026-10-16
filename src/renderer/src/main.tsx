import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { bindIpc, releaseIpcQueue } from './ipc'
import { applySystemTheme } from './lib/theme'
import { App } from './router'
import { loadSettings } from './settings/store'
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
else useSession.setState({ lastCwd: (await window.pi.getRecentProjects())[0]?.cwd ?? null })
releaseIpcQueue()
void loadSettings()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
