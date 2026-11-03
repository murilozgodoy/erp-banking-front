import { LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'

import { PAPEIS } from '../team/permissions'
import { useMembro } from '../team/useMembro'
import { ButtonLink } from '../ui/Button'

import { precisaFinanceiro } from './financeiro'

/**
 * Sem `ver_financeiro`, as rotas `/me/*` respondem 403: em vez de painéis quebrados, a página
 * inteira explica o que falta e com quem resolver (seção 11). Implementado uma vez, no layout.
 */
export function FinanceGate({ children }: { children: ReactNode }) {
  const { membro, pode } = useMembro()
  const { pathname } = useLocation()
  if (!membro || pode('ver_financeiro') || !precisaFinanceiro(pathname)) return children
  return (
    <section
      aria-labelledby="sem-financeiro-titulo"
      className="mx-auto flex max-w-lg flex-col items-start gap-4 py-10 sm:py-16"
    >
      <span
        aria-hidden
        className="grid size-11 place-items-center rounded-full bg-sunken text-ink-muted"
      >
        <LockKeyhole className="size-5" />
      </span>
      <div className="space-y-2">
        <h1 id="sem-financeiro-titulo" className="text-xl font-semibold text-ink">
          Você não tem acesso aos números da empresa
        </h1>
        <p className="text-sm text-ink-muted">
          Saldo, extrato, vendas, recebíveis, contas e crédito aparecem para quem tem a permissão de
          ver o financeiro. Peça essa permissão a um administrador da empresa; quando ele liberar,
          recarregue a página.
        </p>
        <p className="text-xs text-ink-faint">
          Seu papel: {PAPEIS[membro.papel].label}
          {membro.nome ? ` · ${membro.nome}` : ''}
        </p>
      </div>
      {pode('gerenciar_equipe') && (
        <ButtonLink to="/app/equipe" variant="secondary" size="sm">
          Abrir a equipe
        </ButtonLink>
      )}
    </section>
  )
}
