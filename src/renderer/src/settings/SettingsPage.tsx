import { ArrowLeft, Server, SlidersHorizontal, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { AppSettings, SettingsSection } from '@shared/settings'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@/components/ui/scroll-area'
import { parseSection } from '@/route'
import { useSession } from '@/session/store'
import { GeneralPage } from './GeneralPage'
import { ModelsPage } from './ModelsPage'
import { ProvidersPage } from './ProvidersPage'
import { useSettings } from './store'

interface NavSection {
  id: SettingsSection
  label: string
  icon: typeof SlidersHorizontal
}

const SECTIONS: NavSection[] = [
  {
    id: 'general',
    label: 'General',
    icon: SlidersHorizontal,
  },
  {
    id: 'models',
    label: 'Models',
    icon: Sparkles,
  },
  {
    id: 'providers',
    label: 'Providers',
    icon: Server,
  },
]

export function SettingsPage() {
  const navigate = useNavigate()
  const apply = useSettings((state) => state.apply)
  const generation = useSettings((state) => state.generation)
  const catalogGeneration = useSettings((state) => state.catalogGeneration)
  const [params, setParams] = useSearchParams()
  const section = parseSection(params.get('section'))
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [available, setAvailable] = useState(() => useSession.getState().models)
  const panelRef = useRef<HTMLDivElement>(null)

  const loadAppSettings = useCallback(() => {
    void window.pi.getSettings().then((next) => {
      setSettings(next)
      apply(next)
    })
  }, [apply])

  const loadCatalog = useCallback(() => {
    void window.pi.getCatalog().then((catalog) => {
      setAvailable(catalog.available)
    })
  }, [])

  useEffect(() => {
    loadAppSettings()
  }, [loadAppSettings, generation])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog, catalogGeneration])

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  async function patch(partial: Partial<AppSettings>): Promise<void> {
    const next = await window.pi.patchSettings(partial)
    setSettings(next)
    apply(next)
  }

  const activeSection = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0]

  return (
    <div
      ref={panelRef}
      aria-label="Settings"
      tabIndex={-1}
      className="flex h-full bg-background text-foreground outline-none"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault()
          navigate(-1)
        }
      }}
    >
      <aside className="flex w-60 shrink-0 flex-col border-r border-border/40 bg-muted/15 select-none">
        <div className="app-drag h-9 shrink-0" />

        <div className="flex flex-col gap-0.5 px-2.5 pt-2">
          <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground/60">
            Preferences
          </div>
          {SECTIONS.map((item) => {
            const Icon = item.icon
            const isActive = section === item.id
            return (
              <Button
                key={item.id}
                type="button"
                variant={isActive ? 'secondary' : 'ghost'}
                className="w-full justify-start gap-2 text-[13px] font-normal"
                onClick={() => setParams({ section: item.id }, { replace: true })}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className={isActive ? 'font-medium text-foreground' : ''}>{item.label}</span>
              </Button>
            )
          })}
        </div>

        <div className="mt-auto flex flex-col gap-2 p-2.5">
          {settings?.hasProjectSettings ? (
            <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
              This folder has <code className="font-mono text-foreground">.pi/settings.json</code>.
              Project settings override these app settings.
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2 text-[13px] font-normal text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span>Back to app</span>
            <Kbd className="ml-auto text-[10px]">Esc</Kbd>
          </Button>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {section === 'providers' ? (
          <div className="flex min-h-0 flex-1">
            <ProvidersPage />
          </div>
        ) : (
          <>
            <div className="app-drag h-9 shrink-0" />
            <ScrollArea className="flex-1">
              <ScrollAreaViewport className="px-10 pt-2 pb-10">
                <div className="mx-auto max-w-3xl">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      {activeSection.label}
                    </h2>
                  </div>

                  {settings && section === 'general' ? (
                    <GeneralPage settings={settings} onPatch={(item) => void patch(item)} />
                  ) : null}

                  {settings && section === 'models' ? (
                    <ModelsPage
                      settings={settings}
                      available={available}
                      onPatch={(item) => void patch(item)}
                    />
                  ) : null}
                </div>
              </ScrollAreaViewport>
              <ScrollAreaScrollbar />
            </ScrollArea>
          </>
        )}
      </main>
    </div>
  )
}
