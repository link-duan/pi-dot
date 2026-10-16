import { useState, type ReactNode } from 'react'
import { type ModelInfo } from '@shared/protocol'
import { type ProviderAuthMethod, type ProviderListItem, describeAuth } from '@shared/settings'
import { Button } from '@/components/ui/button'
import { SettingCard } from '@/settings/components/SettingCard'
import { SettingSection } from '@/settings/components/SettingSection'
import { StatusDot } from '@/settings/components/StatusDot'
import { useConnectionTest } from './useConnectionTest'
import { TestResultText } from './TestResultText'
import { TestButton } from './TestButton'

export function BuiltinProvider({
  item,
  models,
  onLogin,
  onLogout,
}: {
  item: ProviderListItem
  models: ModelInfo[]
  onLogin: (login: { id: string; name: string; methods: ProviderAuthMethod[] }) => void
  onLogout: () => void
}) {
  const [pendingLogout, setPendingLogout] = useState(false)

  return (
    <div className="flex flex-col gap-8 pb-12">
      <SettingSection title="Account">
        <SettingCard>
          <ProviderStatusRow
            item={item}
            actions={
              <>
                {item.configured ? (
                  pendingLogout ? (
                    <div className="flex animate-in items-center gap-1.5 duration-150 fade-in">
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => setPendingLogout(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        onClick={() => {
                          setPendingLogout(false)
                          onLogout()
                        }}
                      >
                        Sign out
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingLogout(true)}
                    >
                      Sign out
                    </Button>
                  )
                ) : null}
                {item.methods.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={item.configured ? 'outline' : 'default'}
                    onClick={() => onLogin({ id: item.id, name: item.name, methods: item.methods })}
                  >
                    {item.configured ? 'Reconnect' : 'Connect'}
                  </Button>
                ) : null}
              </>
            }
          />
        </SettingCard>
      </SettingSection>

      <SettingSection
        title="Models"
        description="Choose which ones show in the model picker on the Models page"
      >
        <SettingCard>
          {models.length === 0 ? (
            <div className="px-4 py-5 text-center text-xs text-muted-foreground">
              {item.configured ? 'No models available' : 'Connect to use this provider’s models'}
            </div>
          ) : (
            models.map((model) => (
              <div
                key={model.id}
                className="flex items-baseline gap-2 px-4 py-2.5 text-[13px] text-foreground"
              >
                <span className="truncate">{model.name}</span>
                {model.name !== model.id ? (
                  <span className="truncate text-[11px] text-muted-foreground">{model.id}</span>
                ) : null}
              </div>
            ))
          )}
        </SettingCard>
      </SettingSection>
    </div>
  )
}

function authDot(item: ProviderListItem): 'online' | 'offline' | 'warning' {
  if (item.authSource === 'oauth') return 'online'
  return item.configured ? 'offline' : 'warning'
}

function ProviderStatusRow({ item, actions }: { item: ProviderListItem; actions: ReactNode }) {
  const { result, testing, run } = useConnectionTest(item.id, item.authSource)
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <StatusDot status={authDot(item)} />
          <span className="truncate">{item.configured ? describeAuth(item) : 'Not connected'}</span>
        </div>
        {result ? (
          <TestResultText result={result} className="pl-3.5 text-xs text-muted-foreground" />
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {item.configured ? (
          <TestButton
            testing={testing}
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => void run()}
          />
        ) : null}
        {actions}
      </div>
    </div>
  )
}
