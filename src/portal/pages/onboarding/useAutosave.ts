import { isAxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

interface AutosaveOptions<T> {
  save: (value: T) => Promise<unknown>
  /** 409: o cadastro já foi enviado (por outra aba, por exemplo). O autosave para. */
  onConflict?: () => void
  /** Espera depois da última mudança (ms). */
  delay?: number
}

export interface Autosave<T> {
  status: SaveStatus
  /** Agenda o salvamento do valor (debounce). */
  schedule: (value: T) => void
  /** Salva agora o que estiver pendente (troca de passo). */
  flush: () => Promise<void>
  /** Tenta de novo depois de um erro. */
  retry: () => Promise<void>
  /** Cancela o pendente e espera o que está em voo terminar (antes do envio). */
  suspend: () => Promise<void>
  /** Volta a salvar (o envio falhou). */
  resume: () => void
}

export function isConflict(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409
}

export function isUnprocessable(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 422
}

/**
 * Rascunho com salvamento automático: um PUT por vez, sempre com o estado mais recente, e nada
 * depois do `suspend()` (para um rascunho atrasado nunca sobrescrever o envio).
 */
export function useAutosave<T>({ save, onConflict, delay = 800 }: AutosaveOptions<T>): Autosave<T> {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const saveRef = useRef(save)
  const conflictRef = useRef(onConflict)
  useEffect(() => {
    saveRef.current = save
    conflictRef.current = onConflict
  })

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** Valor ainda não salvo (`undefined` = nada pendente). */
  const pending = useRef<{ value: T } | undefined>(undefined)
  const inflight = useRef<Promise<void> | null>(null)
  const rerun = useRef(false)
  const suspended = useRef(false)

  const run = useCallback((): Promise<void> => {
    clearTimeout(timer.current)
    if (inflight.current) {
      rerun.current = true
      return inflight.current
    }
    const loop = async () => {
      // Repete enquanto alguém pediu para salvar durante o PUT em voo (debounce ou troca de passo).
      while (!suspended.current && pending.current) {
        const { value } = pending.current
        pending.current = undefined
        rerun.current = false
        setStatus('saving')
        let saved = true
        try {
          await saveRef.current(value)
        } catch (error) {
          if (isConflict(error)) {
            suspended.current = true
            pending.current = undefined
            setStatus('idle')
            conflictRef.current?.()
            return
          }
          if (!isUnprocessable(error)) {
            pending.current ??= { value }
            setStatus('error')
            return
          }
          // 422 no rascunho: algum dado ainda não passa na API. Não é alarme; o próximo
          // salvamento sai na próxima mudança.
          saved = false
        }
        if (suspended.current) return
        setStatus(pending.current ? 'pending' : saved ? 'saved' : 'idle')
        if (!rerun.current) return
      }
    }
    const request = loop().finally(() => {
      inflight.current = null
    })
    inflight.current = request
    return request
  }, [])

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value }
      if (suspended.current) return
      setStatus('pending')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void run(), delay)
    },
    [delay, run],
  )

  const suspend = useCallback(async () => {
    suspended.current = true
    clearTimeout(timer.current)
    rerun.current = false
    await inflight.current
  }, [])

  const resume = useCallback(() => {
    suspended.current = false
  }, [])

  // Saiu da página com algo pendente: salva sem esperar o debounce.
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (!suspended.current && pending.current && !inflight.current) {
        void saveRef.current(pending.current.value).catch(() => undefined)
      }
    },
    [],
  )

  return useMemo(
    () => ({ status, schedule, flush: run, retry: run, suspend, resume }),
    [status, schedule, run, suspend, resume],
  )
}
