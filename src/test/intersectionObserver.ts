import { vi } from 'vitest'

/**
 * O jsdom não tem IntersectionObserver (usado pelo `whileInView` do motion). Este stub marca
 * todo elemento observado como visível, então o conteúdo revelado no scroll aparece no teste.
 */
export function stubIntersectionObserver() {
  class IntersectionObserverStub {
    private readonly callback: IntersectionObserverCallback
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
    }
    observe = (target: Element) => {
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      )
    }
    unobserve = () => {}
    disconnect = () => {}
    takeRecords = () => []
  }
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
}
