import { useEffect } from 'react'
import { createHashRouter, Outlet, RouterProvider, useLocation } from 'react-router'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'

export const PATH = {
  launcher: '/',
  picker: '/',
  session: '/session',
  settings: '/settings',
  playground: '/playground',
} as const

/** Narrowest window each page lays out in; the rest share the default. */
const MIN_WIDTH: Record<string, number> = { [PATH.settings]: 720 }

function Shell() {
  const { pathname } = useLocation()
  useEffect(() => window.pi.setMinWidth(MIN_WIDTH[pathname] ?? 480), [pathname])
  return (
    <TooltipProvider>
      <Outlet />
      {/* Top right, clear of the title bar and of the cards stacked above the Composer. */}
      <Toaster position="top-right" offset={{ top: 44, right: 16 }} />
    </TooltipProvider>
  )
}

export const router = createHashRouter([
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
        path: PATH.launcher,
        lazy: () =>
          import('./components/ProjectLauncher').then(({ ProjectLauncher }) => ({
            Component: ProjectLauncher,
          })),
      },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  Object.assign(window, { router })
}
