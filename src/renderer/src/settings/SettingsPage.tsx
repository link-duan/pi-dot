import { ArrowLeft, Bot, Monitor, Network, Server, Shield, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import type {
  GeneralChange,
  GeneralSection,
  GeneralSettingsState,
  ModelSettings,
  ModelSettingsPatch,
  SettingsCatalog,
  SettingsScope,
  SettingsSection,
} from '@shared/settings'
import { Button } from '@/components/ui/button'
import { PATH } from '@/router'
import { useSession } from '@/session/store'
import { cn } from '@/lib/utils'
import { ScopeTabs } from './components/ScopeTabs'
import { SettingsPane } from './components/SettingsPane'
import { GeneralSectionPage } from './GeneralSectionPage'
import { ModelsPage } from './ModelsPage'
import { ProvidersPage } from './ProvidersPage'
import { useSettings } from './store'

interface NavSection {
  id: SettingsSection
  label: string
  icon: typeof Bot
}

const GENERAL_SECTIONS: NavSection[] = [
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'interface', label: 'Interface', icon: Monitor },
  { id: 'network', label: 'Network', icon: Network },
  { id: 'security', label: 'Security', icon: Shield },
]

const MODEL_SECTIONS: NavSection[] = [
  { id: 'models', label: 'Models', icon: Sparkles },
  { id: 'providers', label: 'Providers', icon: Server },
]

const SECTIONS = [...GENERAL_SECTIONS, ...MODEL_SECTIONS]

function isGeneral(section: SettingsSection): section is GeneralSection {
  return GENERAL_SECTIONS.some((item) => item.id === section)
}

export function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const apply = useSettings((state) => state.apply)
  const generation = useSettings((state) => state.generation)
  const catalogGeneration = useSettings((state) => state.catalogGeneration)
  const [params, setParams] = useSearchParams()
  const requested = params.get('section') === 'general' ? 'agent' : params.get('section')
  const activeSection = SECTIONS.find((item) => item.id === requested) ?? SECTIONS[0]
  const section = activeSection.id
  const [general, setGeneral] = useState<GeneralSettingsState | null>(null)
  const [models, setModels] = useState<ModelSettings | null>(null)
  const [catalog, setCatalog] = useState<SettingsCatalog | null>(null)
  const sessionModels = useSession((state) => state.models)
  const usable = catalog?.usable ?? sessionModels
  const panelRef = useRef<HTMLDivElement>(null)
  const scope: SettingsScope =
    params.get('scope') === 'workspace' && general?.workspace ? 'workspace' : 'user'

  const loadSettings = useCallback(() => {
    void window.pi.getGeneralSettings().then((next) => {
      setGeneral(next)
      apply(next)
    })
    void window.pi.getModelSettings().then(setModels)
  }, [apply])

  const loadCatalog = useCallback(() => window.pi.getCatalog().then(setCatalog), [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings, generation])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog, catalogGeneration])

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  function go(next: { section?: SettingsSection; scope?: SettingsScope }): void {
    const nextSection = next.section ?? section
    const nextScope = next.scope ?? scope
    setParams(
      isGeneral(nextSection) && nextScope === 'workspace'
        ? { section: nextSection, scope: nextScope }
        : { section: nextSection },
      { replace: true },
    )
  }

  async function patchGeneral(change: GeneralChange): Promise<void> {
    const next = await window.pi.patchGeneralSettings(change)
    setGeneral(next)
    apply(next)
  }

  async function patchModels(patch: ModelSettingsPatch): Promise<void> {
    setModels(await window.pi.patchModelSettings(patch))
  }

  // Navigation inside Settings replaces its entry, so the previous entry is the page that opened it.
  function leave(): void {
    if (location.key === 'default') void navigate(PATH.launcher, { replace: true })
    else void navigate(-1)
  }

  return (
    <div
      ref={panelRef}
      aria-label="Settings"
      tabIndex={-1}
      className="flex h-full bg-background text-foreground outline-none"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault()
          leave()
        }
      }}
    >
      <aside className="app-drag flex w-60 shrink-0 flex-col border-r border-border/40 bg-muted/15 select-none">
        <div className="h-9 shrink-0" />

        <nav className="flex flex-col gap-4 px-1.5 pt-2">
          <NavGroup
            label="General"
            items={GENERAL_SECTIONS}
            active={section}
            onSelect={(id) => go({ section: id })}
          />
          <NavGroup
            label="Models"
            items={MODEL_SECTIONS}
            active={section}
            onSelect={(id) => go({ section: id })}
          />
        </nav>

        <div className="mt-auto px-1.5 py-2.5">
          <button
            type="button"
            title="Back to app (Esc)"
            className="app-no-drag flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={leave}
          >
            <ArrowLeft className="size-3.5 shrink-0" />
            Back
          </button>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {section === 'providers' ? (
          <ProvidersPage catalog={catalog} refreshCatalog={loadCatalog} />
        ) : (
          <SettingsPane
            crumbs={[{ label: activeSection.label }]}
            action={
              isGeneral(section) && general ? (
                <ScopeTabs
                  scope={scope}
                  workspace={general.workspace}
                  onChange={(next) => go({ scope: next })}
                />
              ) : null
            }
          >
            {general && isGeneral(section) ? (
              <GeneralSectionPage
                key={section}
                section={section}
                state={general}
                scope={scope}
                available={usable}
                onPatch={(change) => void patchGeneral(change)}
                onScope={(next) => go({ scope: next })}
              />
            ) : null}

            {models && section === 'models' ? (
              <ModelsPage
                settings={models}
                usable={usable}
                providers={catalog?.providers ?? []}
                onPatch={(item) => void patchModels(item)}
              />
            ) : null}
          </SettingsPane>
        )}
      </main>
    </div>
  )
}

function NavGroup({
  label,
  items,
  active,
  onSelect,
}: {
  label: string
  items: NavSection[]
  active: SettingsSection
  onSelect: (id: SettingsSection) => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground/60">{label}</div>
      {items.map((item) => {
        const Icon = item.icon
        const isActive = active === item.id
        return (
          <Button
            key={item.id}
            type="button"
            variant={isActive ? 'secondary' : 'ghost'}
            className="app-no-drag w-full justify-start gap-2 text-[13px] font-normal focus-visible:border-transparent focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-0"
            onClick={() => onSelect(item.id)}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className={cn(isActive && 'font-medium text-foreground')}>{item.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
