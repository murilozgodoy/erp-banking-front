import { useContext } from 'react'

import { Marca } from '@/components/brand/Logo'

import { AssistantContext } from './context'
import { insightQuestion } from './suggestions'

/**
 * "Perguntar à ErpIa sobre isso": abre o assistente com a pergunta pré-preenchida. Fora do
 * `AssistantProvider` (testes de página, backoffice) ou sem a permissão de usar o assistente, não
 * renderiza nada.
 */
export function AskAssistant({ titulo, texto }: { titulo: string; texto?: string }) {
  const assistant = useContext(AssistantContext)
  // Sem `usar_assistente`, o atalho some do insight (o rail explica o bloqueio).
  if (!assistant?.permitido) return null
  return (
    <button
      type="button"
      onClick={() => assistant.openAssistant({ prefill: insightQuestion(titulo, texto) })}
      aria-haspopup="dialog"
      className="mt-2 inline-flex min-h-6 items-center text-sm font-medium text-accent underline-offset-4 hover:underline max-sm:min-h-11"
    >
      <span aria-hidden>
        Perguntar à <Marca /> sobre isso
      </span>
      <span className="sr-only">Perguntar à ErpIa sobre isso</span>
    </button>
  )
}
