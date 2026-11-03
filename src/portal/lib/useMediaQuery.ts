import { useSyncExternalStore } from 'react'

/**
 * `true` quando a media query bate (ex.: `(min-width: 1280px)`). Sem `matchMedia` (jsdom, SSR)
 * devolve `false`, ou seja, o layout de uma coluna.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () =>
      typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false,
  )
}
