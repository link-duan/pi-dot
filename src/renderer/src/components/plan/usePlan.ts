import { useMemo } from 'react'
import { parsePlan } from '@shared/plan-file'
import { useSession } from '@/session/store'

export function usePlan() {
  const planText = useSession((state) => state.planText)
  return useMemo(() => parsePlan(planText), [planText])
}
