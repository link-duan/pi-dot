import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { TooltipProvider } from './components/ui/tooltip'

export const PATH = {
  picker: '/',
  session: '/session',
  settings: '/settings',
  playground: '/playground',
} as const

function Shell() {
  return (
    <TooltipProvider>
      <Outlet />
    </TooltipProvider>
  )
}

export const router = createMemoryRouter([
  {
    Component: Shell,
    children: [
      {
        path: PATH.settings,
        lazy: () =>
          import('./settings/SettingsPage').then(({ SettingsPage }) => ({
            Component: SettingsPage,
          })),
      },
      {
        path: PATH.playground,
        lazy: () =>
          import('./playground/Playground').then(({ Playground }) => ({ Component: Playground })),
      },
      {
        path: PATH.session,
        lazy: () =>
          import('./components/ChatPage').then(({ ChatPage }) => ({ Component: ChatPage })),
      },
      {
        path: PATH.picker,
        lazy: () =>
          import('./components/FolderPicker').then(({ FolderPicker }) => ({
            Component: FolderPicker,
          })),
      },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
