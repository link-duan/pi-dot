import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type UIEvent,
  type WheelEvent,
} from 'react'

const DETACH_THRESHOLD = 50
const ATTACH_THRESHOLD = 16
const STIFFNESS = 220
const DAMPING = 28
const REST_DELTA = 1
const REST_SPEED = 5

export interface UseStickyToBottomOptions {
  viewportRef: RefObject<HTMLDivElement | null>
  contentRef: RefObject<HTMLDivElement | null>
  initialFollow?: boolean
}

export interface UseStickyToBottomResult {
  showScrollBottom: boolean
  scrollToBottom: () => void
  onScroll: (event: UIEvent<HTMLDivElement>) => void
  onWheel: (event: WheelEvent<HTMLDivElement>) => void
}

export function useStickyToBottom({
  viewportRef,
  contentRef,
  initialFollow = true,
}: UseStickyToBottomOptions): UseStickyToBottomResult {
  const stickToBottom = useRef(initialFollow)
  const isAnimating = useRef(false)
  const currentPos = useRef(0)
  const targetPos = useRef(0)
  const velocity = useRef(0)
  const lastFrameTime = useRef(0)
  const rafId = useRef<number | null>(null)
  const isFirstMount = useRef(true)

  const [showScrollBottom, setShowScrollBottom] = useState(false)

  const stopAnimation = useCallback(() => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
    isAnimating.current = false
    velocity.current = 0
  }, [])

  const animateTo = useCallback(
    (target: number) => {
      const viewport = viewportRef.current
      if (!viewport || !stickToBottom.current) return

      targetPos.current = target

      if (isAnimating.current) {
        return
      }

      currentPos.current = viewport.scrollTop

      if (
        Math.abs(target - currentPos.current) <= REST_DELTA &&
        Math.abs(velocity.current) <= REST_SPEED
      ) {
        viewport.scrollTop = target
        currentPos.current = target
        stopAnimation()
        return
      }

      isAnimating.current = true
      lastFrameTime.current = performance.now()

      const tick = (now: number) => {
        const node = viewportRef.current
        if (!node || !stickToBottom.current) {
          stopAnimation()
          return
        }

        const dt = Math.min((now - lastFrameTime.current) / 1000, 0.033)
        lastFrameTime.current = now

        const curTarget = targetPos.current
        const dist = currentPos.current - curTarget
        const fSpring = -STIFFNESS * dist
        const fDamping = -DAMPING * velocity.current
        const a = fSpring + fDamping

        velocity.current += a * dt
        currentPos.current += velocity.current * dt

        if (
          Math.abs(currentPos.current - curTarget) <= REST_DELTA &&
          Math.abs(velocity.current) <= REST_SPEED
        ) {
          node.scrollTop = curTarget
          currentPos.current = curTarget
          stopAnimation()
          return
        }

        node.scrollTop = currentPos.current
        rafId.current = requestAnimationFrame(tick)
      }

      rafId.current = requestAnimationFrame(tick)
    },
    [viewportRef, stopAnimation],
  )

  const updateScrollState = useCallback((viewport: HTMLDivElement) => {
    if (isAnimating.current) return

    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight

    if (stickToBottom.current) {
      if (distanceFromBottom > DETACH_THRESHOLD) {
        stickToBottom.current = false
        setShowScrollBottom(true)
      }
    } else {
      if (distanceFromBottom <= ATTACH_THRESHOLD) {
        stickToBottom.current = true
        setShowScrollBottom(false)
      } else {
        const canScroll = viewport.scrollHeight > viewport.clientHeight
        setShowScrollBottom((prev) => (prev !== canScroll ? canScroll : prev))
      }
    }
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) {
        setShowScrollBottom(false)
        if (isFirstMount.current) {
          isFirstMount.current = false
          viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight
          currentPos.current = viewport.scrollTop
          return
        }
        animateTo(viewport.scrollHeight - viewport.clientHeight)
      } else {
        updateScrollState(viewport)
      }
    })

    observer.observe(content)
    observer.observe(viewport)

    return () => {
      stopAnimation()
      observer.disconnect()
    }
  }, [viewportRef, contentRef, animateTo, stopAnimation, updateScrollState])

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    stickToBottom.current = true
    setShowScrollBottom(false)
    animateTo(viewport.scrollHeight - viewport.clientHeight)
  }, [viewportRef, animateTo])

  const onScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const viewport = event.currentTarget
      if (isAnimating.current) {
        if (Math.abs(viewport.scrollTop - currentPos.current) > 40) {
          stopAnimation()
          stickToBottom.current = false
          setShowScrollBottom(true)
          return
        }
        return
      }
      updateScrollState(viewport)
    },
    [updateScrollState, stopAnimation],
  )

  const onWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (event.deltaY < 0) {
        const viewport = event.currentTarget
        if (viewport.scrollHeight <= viewport.clientHeight) return

        stopAnimation()
        stickToBottom.current = false
        setShowScrollBottom(true)
      }
    },
    [stopAnimation],
  )

  return {
    showScrollBottom,
    scrollToBottom,
    onScroll,
    onWheel,
  }
}
