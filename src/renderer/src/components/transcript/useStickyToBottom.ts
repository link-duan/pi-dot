import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type UIEvent,
  type WheelEvent,
} from 'react'
import { animate, type AnimationPlaybackControls } from 'motion'

const DETACH_THRESHOLD = 50
const ATTACH_THRESHOLD = 16

const SPRING_OPTIONS = {
  type: 'spring' as const,
  stiffness: 180,
  damping: 24,
  mass: 1,
}

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

  const isAnimating = useRef(false)
  const lastScrollTop = useRef(0)
  const currentVelocity = useRef(0)
  const lastUpdateTime = useRef(0)
  const animationControls = useRef<AnimationPlaybackControls | null>(null)

  const stopAnimation = useCallback(() => {
    if (animationControls.current) {
      animationControls.current.stop()
      animationControls.current = null
    }
    isAnimating.current = false
    currentVelocity.current = 0
  }, [])

  const startFollow = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport || !stickToBottom.current) return

    const target = viewport.scrollHeight - viewport.clientHeight
    const current = viewport.scrollTop

    if (Math.abs(target - current) <= 1 && Math.abs(currentVelocity.current) < 1) {
      viewport.scrollTop = target
      lastScrollTop.current = target
      stopAnimation()
      return
    }

    if (animationControls.current) {
      animationControls.current.stop()
      animationControls.current = null
    }

    isAnimating.current = true
    lastUpdateTime.current = performance.now()
    let prevVal = current

    animationControls.current = animate(current, target, {
      ...SPRING_OPTIONS,
      velocity: Math.max(currentVelocity.current, 0),
      onUpdate: (latest) => {
        const node = viewportRef.current
        if (!node || !stickToBottom.current) {
          stopAnimation()
          return
        }

        const now = performance.now()
        const dt = (now - lastUpdateTime.current) / 1000
        if (dt > 0.001) {
          currentVelocity.current = (latest - prevVal) / dt
          prevVal = latest
          lastUpdateTime.current = now
        }

        node.scrollTop = latest
        lastScrollTop.current = latest
      },
      onComplete: () => {
        const node = viewportRef.current
        if (node && stickToBottom.current) {
          const finalTarget = node.scrollHeight - node.clientHeight
          node.scrollTop = finalTarget
          lastScrollTop.current = finalTarget
        }
        isAnimating.current = false
        currentVelocity.current = 0
        animationControls.current = null
      },
    })
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
        startFollow()
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
  }, [viewportRef, contentRef, startFollow, stopAnimation, updateScrollState])

  const scrollToBottom = useCallback(() => {
    stickToBottom.current = true
    setShowScrollBottom(false)
    startFollow()
  }, [startFollow])

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
