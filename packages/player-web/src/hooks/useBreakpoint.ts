import { useEffect, useState } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

const MOBILE_MAX = '(max-width: 767px)'
const TABLET = '(min-width: 768px) and (max-width: 1023px)'
const DESKTOP = '(min-width: 1024px)'

function getBreakpoint(): Breakpoint {
  if (window.matchMedia(DESKTOP).matches) return 'desktop'
  if (window.matchMedia(TABLET).matches) return 'tablet'
  return 'mobile'
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getBreakpoint)

  useEffect(() => {
    const mqDesktop = window.matchMedia(DESKTOP)
    const mqTablet = window.matchMedia(TABLET)
    const mqMobile = window.matchMedia(MOBILE_MAX)

    function update() {
      setBreakpoint(getBreakpoint())
    }

    mqDesktop.addEventListener('change', update)
    mqTablet.addEventListener('change', update)
    mqMobile.addEventListener('change', update)

    return () => {
      mqDesktop.removeEventListener('change', update)
      mqTablet.removeEventListener('change', update)
      mqMobile.removeEventListener('change', update)
    }
  }, [])

  return breakpoint
}
