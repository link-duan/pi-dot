import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applySystemTheme } from './lib/theme'
import { useSession } from './session/store'
import './styles.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('missing #root')
}

applySystemTheme()
useSession.setState({ lastCwd: await window.pi.getLastCwd() })

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
