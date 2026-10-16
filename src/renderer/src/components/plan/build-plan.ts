import { useSession } from '@/session/store'

export function buildPlan(): void {
  const session = useSession.getState()
  session.closePlanViewer()
  void session.approvePlan().catch((error: unknown) => {
    console.error('Failed to approve plan', error)
  })
}
