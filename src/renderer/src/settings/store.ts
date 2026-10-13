import { create } from 'zustand'
import { effectiveSettings, type GeneralSettingsState } from '@shared/settings'

interface SettingsUi {
  hideThinking: boolean
  generation: number
  catalogGeneration: number
  apply: (state: GeneralSettingsState) => void
  bump: () => void
  bumpCatalog: () => void
}

export const useSettings = create<SettingsUi>((set) => ({
  hideThinking: false,
  generation: 0,
  catalogGeneration: 0,
  apply: (state) => set({ hideThinking: effectiveSettings(state).hideThinking }),
  bump: () => set((state) => ({ generation: state.generation + 1 })),
  bumpCatalog: () => set((state) => ({ catalogGeneration: state.catalogGeneration + 1 })),
}))

export async function loadSettings(): Promise<void> {
  try {
    const state = await window.pi.getGeneralSettings()
    useSettings.getState().apply(state)
  } catch (error) {
    console.error('Failed to load settings', error)
  }
}
