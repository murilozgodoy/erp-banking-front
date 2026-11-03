import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { permissaoNegada } from '../team/forbidden'

import { portalKeys } from './queries'

/** Telas do portal que não leem os números da empresa (o resto exige `ver_financeiro`). */
const SEM_FINANCEIRO = ['/app/equipe', '/app/status', '/app/onboarding']

export function precisaFinanceiro(pathname: string): boolean {
  return pathname.startsWith('/app') && !SEM_FINANCEIRO.some((p) => pathname.startsWith(p))
}

/**
 * Um 403 `SEM_PERMISSAO` quer dizer que as permissões mudaram desde o último `GET /me`: busca o
 * `/me` de novo (no máximo a cada 5 s) para a interface se ajustar sozinha.
 */
export function useRefreshMeOnForbidden() {
  const queryClient = useQueryClient()
  useEffect(() => {
    let last = 0
    const check = (error: unknown) => {
      if (!permissaoNegada(error)) return
      const now = Date.now()
      if (now - last < 5_000) return
      last = now
      void queryClient.invalidateQueries({ queryKey: portalKeys.me })
    }
    const offQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') check(event.action.error)
    })
    const offMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') check(event.action.error)
    })
    return () => {
      offQueries()
      offMutations()
    }
  }, [queryClient])
}
