import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type UIEvent,
  type WheelEvent,
} from 'react'

const DEFAULT_SPRING = {
  damping: 0.7,
  stiffness: 0.05,
  mass: 1.25,
}
const STICK_OFFSET_PX = 70
const SIXTY_FPS_INTERVAL_MS = 1000 / 60
const RETAIN_DURATION_MS = 350

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
  const isAtBottomRef = useRef(initialFollow)
  const escapedFromLockRef = useRef(!initialFollow)
  const ignoreScrollToTop = useRef<number | null>(null)
  const velocity = useRef(0)
  const accumulated = useRef(0)
  const lastTick = useRef(0)
  const lastScrollTop = useRef<number | null>(null)
  const durationElapsed = useRef(0)
  const rafId = useRef<number | null>(null)
  const isFirstMount = useRef(true)
  const previousContentHeight = useRef<number | null>(null)

  const [showScrollBottom, setShowScrollBottom] = useState(false)

  const stopAnimation = useCallback(() => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
    velocity.current = 0
    accumulated.current = 0
  }, [])

  const setScrollTop = useCallback((node: HTMLDivElement, value: number) => {
    const currentBehavior = node.style.scrollBehavior
    if (currentBehavior !== 'auto') {
      node.style.scrollBehavior = 'auto'
    }
    node.scrollTop = value
    ignoreScrollToTop.current = node.scrollTop
    if (currentBehavior !== 'auto') {
      node.style.scrollBehavior = currentBehavior
    }
  }, [])

  const scrollToBottom = useCallback(
    (options: { smooth?: boolean; duration?: number } = {}) => {
      const node = viewportRef.current
      if (!node) return

      const { smooth = true, duration = 0 } = options

      escapedFromLockRef.current = false
      isAtBottomRef.current = true
      setShowScrollBottom(false)

      const target = Math.max(0, node.scrollHeight - node.clientHeight)

      if (!smooth) {
        stopAnimation()
        setScrollTop(node, target)
        return
      }

      durationElapsed.current = Date.now() + duration

      if (rafId.current != null) {
        return
      }

      lastTick.current = performance.now()

      const tick = (now: number) => {
        const el = viewportRef.current
        if (!el || !isAtBottomRef.current || escapedFromLockRef.current) {
          stopAnimation()
          return
        }

        const currentTarget = Math.max(0, el.scrollHeight - el.clientHeight)
        const currentScrollTop = el.scrollTop
        const scrollDifference = currentTarget - currentScrollTop

        const tickDelta = (now - lastTick.current) / SIXTY_FPS_INTERVAL_MS
        lastTick.current = now

        velocity.current =
          (DEFAULT_SPRING.damping * velocity.current +
            DEFAULT_SPRING.stiffness * scrollDifference) /
          DEFAULT_SPRING.mass
        accumulated.current += velocity.current * tickDelta

        const prevScrollTop = el.scrollTop
        setScrollTop(el, prevScrollTop + accumulated.current)
        if (el.scrollTop !== prevScrollTop) {
          accumulated.current = 0
        }

        const stillBelowTarget = el.scrollTop < currentTarget - 0.5
        const withinDuration = Date.now() < durationElapsed.current

        if (stillBelowTarget || withinDuration) {
          rafId.current = requestAnimationFrame(tick)
        } else {
          setScrollTop(el, currentTarget)
          stopAnimation()
        }
      }

      rafId.current = requestAnimationFrame(tick)
    },
    [viewportRef, stopAnimation, setScrollTop],
  )

  const onWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      const node = event.currentTarget
      if (!node) return

      // 用户滚轮介入，立即停止自动动画
      stopAnimation()

      const canScroll = node.scrollHeight > node.clientHeight
      if (!canScroll) return

      if (event.deltaY < 0) {
        escapedFromLockRef.current = true
        isAtBottomRef.current = false
        setShowScrollBottom(true)
      }
    },
    [stopAnimation],
  )

  const onScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const node = event.currentTarget
      if (!node) return

      const scrollTop = node.scrollTop
      const lastScroll = lastScrollTop.current ?? scrollTop
      lastScrollTop.current = scrollTop

      // 动画内部引发的滚动：放行并消耗标志
      if (
        ignoreScrollToTop.current != null &&
        Math.abs(scrollTop - ignoreScrollToTop.current) < 1
      ) {
        ignoreScrollToTop.current = null
        return
      }

      // 用户真实物理滚动，立即打断自动动画
      stopAnimation()

      const targetScrollTop = Math.max(0, node.scrollHeight - node.clientHeight)
      const isNearBottom = targetScrollTop - scrollTop <= STICK_OFFSET_PX
      const isScrollingUp = scrollTop < lastScroll

      if (isScrollingUp) {
        escapedFromLockRef.current = true
        isAtBottomRef.current = false
      } else if (scrollTop > lastScroll && isNearBottom) {
        escapedFromLockRef.current = false
        isAtBottomRef.current = true
      }

      const canScroll = targetScrollTop > 0
      setShowScrollBottom(canScroll && !isNearBottom && escapedFromLockRef.current)
    },
    [stopAnimation],
  )

  useEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    const observer = new ResizeObserver(([entry]) => {
      const height = entry.contentRect.height
      const difference = height - (previousContentHeight.current ?? height)
      previousContentHeight.current = height

      const node = viewportRef.current
      if (!node) return

      if (isFirstMount.current) {
        isFirstMount.current = false
        if (isAtBottomRef.current) {
          const target = Math.max(0, node.scrollHeight - node.clientHeight)
          setScrollTop(node, target)
        }
        return
      }

      const targetScrollTop = Math.max(0, node.scrollHeight - node.clientHeight)
      const isNearBottom = targetScrollTop - node.scrollTop <= STICK_OFFSET_PX

      if (difference >= 0) {
        if (isAtBottomRef.current && !escapedFromLockRef.current) {
          scrollToBottom({ smooth: true, duration: RETAIN_DURATION_MS })
        }
      } else {
        if (isNearBottom) {
          escapedFromLockRef.current = false
          isAtBottomRef.current = true
        }
      }

      const canScroll = targetScrollTop > 0
      setShowScrollBottom(canScroll && !isNearBottom && escapedFromLockRef.current)
    })

    observer.observe(content)

    return () => {
      stopAnimation()
      observer.disconnect()
    }
  }, [viewportRef, contentRef, scrollToBottom, stopAnimation, setScrollTop])

  return {
    showScrollBottom,
    scrollToBottom,
    onScroll,
    onWheel,
  }
}
