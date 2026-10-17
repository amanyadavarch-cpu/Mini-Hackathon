import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

export function usePageMotion() {
  const scope = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    const root = scope.current
    if (!root) return
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const pageEntries = Array.from(root.querySelectorAll<HTMLElement>('.page-enter'))
      const staggerEntries = Array.from(root.querySelectorAll<HTMLElement>('.stagger-enter'))
      if (pageEntries.length) {
        gsap.fromTo(pageEntries, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' })
      }
      if (staggerEntries.length) {
        gsap.fromTo(staggerEntries, { y: 10, opacity: 0 }, {
          y: 0,
          opacity: 1,
          duration: 0.38,
          stagger: 0.07,
          ease: 'power2.out',
          delay: 0.08,
        })
      }
    })
    return () => media.revert()
  }, { scope })
  return scope
}
