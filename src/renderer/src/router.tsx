import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { ChatPage } from './components/ChatPage'
import { FolderPicker } from './components/FolderPicker'
import { TooltipProvider } from './components/ui/tooltip'
import { Playground } from './playground/Playground'
import { initialEntry, PATH } from './route'
import { SettingsPage } from './settings/SettingsPage'

function Shell() {
  return (
    <TooltipProvider>
      <Outlet />
    </TooltipProvider>
  )
}

export let router: ReturnType<typeof createMemoryRouter>

export function initRouter(cwd: string | null): void {
  router = createMemoryRouter(
    [
      {
        Component: Shell,
        children: [
          { path: PATH.settings, Component: SettingsPage },
          { path: PATH.playground, Component: Playground },
          { path: PATH.session, Component: ChatPage },
          { path: PATH.picker, Component: FolderPicker },
        ],
      },
    ],
    { initialEntries: [initialEntry(cwd)] },
  )
}

export function App() {
  return <RouterProvider router={router} />
}
