import { act, renderHook } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isConflict, useAutosave } from './useAutosave'

function httpError(status: number) {
  const headers = new AxiosHeaders()
  return new AxiosError('erro', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers,
    config: { headers },
    data: {},
  })
}

/** Promessa controlada por fora (PUT em voo). */
function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(save = vi.fn().mockResolvedValue(undefined), onConflict = vi.fn()) {
  const hook = renderHook(() => useAutosave<{ v: number }>({ save, onConflict }))
  return { ...hook, save, onConflict }
}

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('espera 800 ms depois da última mudança e salva só o estado mais recente', async () => {
    const { result, save } = setup()
    expect(result.current.status).toBe('idle')
    act(() => result.current.schedule({ v: 1 }))
    expect(result.current.status).toBe('pending')
    await act(() => vi.advanceTimersByTimeAsync(500))
    act(() => result.current.schedule({ v: 2 }))
    await act(() => vi.advanceTimersByTimeAsync(799))
    expect(save).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ v: 2 })
    expect(result.current.status).toBe('saved')
  })

  it('flush salva na hora; mudanças durante o PUT entram num segundo PUT', async () => {
    const primeiro = deferred()
    const save = vi.fn().mockReturnValueOnce(primeiro.promise).mockResolvedValue(undefined)
    const { result } = setup(save)
    act(() => result.current.schedule({ v: 1 }))
    let flushed!: Promise<void>
    act(() => {
      flushed = result.current.flush()
    })
    expect(save).toHaveBeenCalledWith({ v: 1 })
    expect(result.current.status).toBe('saving')
    act(() => result.current.schedule({ v: 2 }))
    act(() => void result.current.flush())
    await act(async () => {
      primeiro.resolve()
      await flushed
    })
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith({ v: 2 })
    expect(result.current.status).toBe('saved')
    // Nada pendente: flush não chama a API.
    await act(() => result.current.flush())
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('mostra o erro e tenta de novo com o mesmo estado', async () => {
    const save = vi.fn().mockRejectedValueOnce(httpError(500)).mockResolvedValue(undefined)
    const { result } = setup(save)
    act(() => result.current.schedule({ v: 7 }))
    await act(() => vi.advanceTimersByTimeAsync(800))
    expect(result.current.status).toBe('error')
    await act(() => result.current.retry())
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith({ v: 7 })
    expect(result.current.status).toBe('saved')
  })

  it('409 (já enviado) para o autosave e avisa', async () => {
    const save = vi.fn().mockRejectedValue(httpError(409))
    const { result, onConflict } = setup(save)
    act(() => result.current.schedule({ v: 1 }))
    await act(() => vi.advanceTimersByTimeAsync(800))
    expect(onConflict).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('idle')
    act(() => result.current.schedule({ v: 2 }))
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('suspend cancela o pendente e espera o PUT em voo; resume volta a salvar', async () => {
    const emVoo = deferred()
    const save = vi.fn().mockReturnValueOnce(emVoo.promise).mockResolvedValue(undefined)
    const { result } = setup(save)
    act(() => result.current.schedule({ v: 1 }))
    await act(() => vi.advanceTimersByTimeAsync(800))
    act(() => result.current.schedule({ v: 2 }))
    let suspended = false
    let suspending!: Promise<void>
    act(() => {
      suspending = result.current.suspend().then(() => {
        suspended = true
      })
    })
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(suspended).toBe(false)
    await act(async () => {
      emVoo.resolve()
      await suspending
    })
    expect(suspended).toBe(true)
    // O pendente {v: 2} não sai depois do suspend.
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(save).toHaveBeenCalledTimes(1)
    act(() => result.current.resume())
    await act(() => result.current.flush())
    expect(save).toHaveBeenLastCalledWith({ v: 2 })
  })

  it('salva o pendente ao sair da página', () => {
    const { result, save, unmount } = setup()
    act(() => result.current.schedule({ v: 3 }))
    unmount()
    expect(save).toHaveBeenCalledWith({ v: 3 })
  })

  it('reconhece o 409 do axios', () => {
    expect(isConflict(httpError(409))).toBe(true)
    expect(isConflict(httpError(422))).toBe(false)
    expect(isConflict(new Error('x'))).toBe(false)
  })
})
