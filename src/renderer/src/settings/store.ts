import { create } from 'zustand'
import type { AppSettings } from '@shared/settings'

interface SettingsUi {
  hideThinking: boolean
  generation: number
  catalogGeneration: number
  apply: (settings: Pick<AppSettings, 'hideThinking'>) => void
  bump: () => void
  bumpCatalog: () => void
}

export const useSettings = create<SettingsUi>((set) => ({
  hideThinking: false,
  generation: 0,
  catalogGeneration: 0,
  apply: (settings) => set({ hideThinking: settings.hideThinking }),
  bump: () => set((state) => ({ generation: state.generation + 1 })),
  bumpCatalog: () => set((state) => ({ catalogGeneration: state.catalogGeneration + 1 })),
}))

export async function loadSettings(): Promise<void> {
  try {
    const settings = await window.pi.getSettings()
    useSettings.getState().apply(settings)
  } catch {
    // settings are optional at startup
  }
}
