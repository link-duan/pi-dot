import { useState } from 'react'
import { type ProviderTestResult } from '@shared/settings'

/** Runs a connection test; a result only shows while the provider and `config` it tested are current. */
export function useConnectionTest(providerId: string, config: string) {
  const stamp = `${providerId}\n${config}`
  const [last, setLast] = useState<{ stamp: string; result: ProviderTestResult } | null>(null)
  const [testing, setTesting] = useState(false)

  async function run(): Promise<void> {
    const tested = stamp
    setTesting(true)
    setLast(null)
    const result = await window.pi
      .testProvider(providerId)
      .catch((error: unknown): ProviderTestResult => ({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      }))
    setTesting(false)
    setLast({ stamp: tested, result })
  }

  return { result: last?.stamp === stamp ? last.result : null, testing, run }
}
