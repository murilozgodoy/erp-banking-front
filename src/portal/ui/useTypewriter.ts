import { useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

/** ms por caractere e teto do efeito inteiro (textos longos digitam mais rápido). */
const MS_PER_CHAR = 30
const MAX_MS = 1200
const TICK_MS = 16

/**
 * Efeito de digitação, uma vez por montagem (e de novo se o texto mudar): devolve quantos
 * caracteres já aparecem e se terminou. Com movimento reduzido, o texto aparece inteiro.
 */
export function useTypewriter(text: string): { shown: number; done: boolean } {
  const reduce = Boolean(useReducedMotion())
  const [state, setState] = useState({ text, shown: 0 })
  // Texto novo: recomeça a digitação (ajuste durante o render, sem efeito).
  if (state.text !== text) setState({ text, shown: 0 })

  useEffect(() => {
    if (reduce || text.length === 0) return
    const total = Math.min(text.length * MS_PER_CHAR, MAX_MS)
    const perTick = Math.max(1, Math.ceil(text.length / (total / TICK_MS)))
    const timer = window.setInterval(() => {
      setState((current) => {
        if (current.text !== text) return current
        const next = Math.min(text.length, current.shown + perTick)
        if (next >= text.length) window.clearInterval(timer)
        return { text, shown: next }
      })
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [text, reduce])

  const shown = reduce ? text.length : Math.min(state.shown, text.length)
  return { shown, done: shown >= text.length }
}
