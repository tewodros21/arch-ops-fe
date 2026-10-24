import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import gsap from 'gsap'

export function PageTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    if (!ref.current) return
    // New page starts at the top (instant, so it doesn't fight the fade-in)
    window.scrollTo({ top: 0, behavior: 'instant' })
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 10 },
      // clearProps: a leftover transform keeps the page on a composited layer, which blurs SVG/text
      { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform,opacity' },
    )
  }, [location.pathname])

  return <div ref={ref}>{children}</div>
}
