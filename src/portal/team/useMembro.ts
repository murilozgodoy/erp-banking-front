import { useMe } from '../layout/queries'
import type { MembroResumo, Permissao } from '../types'

import { PERMISSOES } from './permissions'

/**
 * Quem está logado dentro da empresa e o que pode fazer. Sem `membro` no `GET /me` (API antiga
 * ou ainda carregando), considera acesso total: quem garante a permissão é o back (403).
 */
export function useMembro(): {
  membro: MembroResumo | null
  pode: (permissao: Permissao) => boolean
  limitePagamento: number | null
} {
  const { data } = useMe()
  const membro = data?.membro ?? null
  const permissoes = new Set<Permissao>(membro ? membro.permissoes : PERMISSOES)
  return {
    membro,
    pode: (permissao) => permissoes.has(permissao),
    limitePagamento: membro?.limite_pagamento ?? null,
  }
}
