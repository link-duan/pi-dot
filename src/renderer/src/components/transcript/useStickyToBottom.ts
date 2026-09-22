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
const DAMPING = 0.2

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
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const isFirstMount = useRef(true)

  const rafId = useRef<number | null>(null)
  const isAnimating = useRef(false)
  const lastScrollTop = useRef(0)

  const stopAnimation = useCallback(() => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
    isAnimating.current = false
  }, [])

  const startFollowLoop = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    if (isAnimating.current) return
    isAnimating.current = true

    const step = () => {
      const node = viewportRef.current
      if (!node || !stickToBottom.current) {
        stopAnimation()
        return
      }

      const target = node.scrollHeight - node.clientHeight
      const current = node.scrollTop
      const diff = target - current

      if (diff <= 0.5) {
        node.scrollTop = target
        lastScrollTop.current = target
        stopAnimation()
        return
      }

      const stepDist = Math.max(diff * DAMPING, 1)
      const next = Math.min(current + stepDist, target)
      node.scrollTop = next
      lastScrollTop.current = next

      rafId.current = requestAnimationFrame(step)
    }

    rafId.current = requestAnimationFrame(step)
  }, [viewportRef, stopAnimation])

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
          lastScrollTop.current = viewport.scrollTop
          return
        }
        startFollowLoop()
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
  }, [viewportRef, contentRef, startFollowLoop, stopAnimation, updateScrollState])

  const scrollToBottom = useCallback(() => {
    stickToBottom.current = true
    setShowScrollBottom(false)
    startFollowLoop()
  }, [startFollowLoop])

  const onScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const viewport = event.currentTarget
      if (isAnimating.current) {
        if (viewport.scrollTop < lastScrollTop.current - 1) {
          stopAnimation()
          stickToBottom.current = false
          setShowScrollBottom(true)
          return
        }
        return
      }

      lastScrollTop.current = viewport.scrollTop
      updateScrollState(viewport)
    },
    [updateScrollState, stopAnimation],
  )

  const onWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (event.deltaY < 0) {
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
