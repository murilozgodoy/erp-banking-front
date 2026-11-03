import { Hourglass } from 'lucide-react'

import { ButtonLink } from './Button'
import { EmptyState, Panel } from './Surface'

/** Estado da área quando a análise do cadastro ainda não liberou o ERP. */
export function OnboardingPendingState({ area }: { area: string }) {
  return (
    <Panel>
      <EmptyState
        icon={<Hourglass aria-hidden className="size-5" />}
        title="Seu cadastro ainda está em análise"
        action={<ButtonLink to="/app/status">Ver andamento da análise</ButtonLink>}
      >
        {area} abre assim que a análise for aprovada. Você recebe o acesso automaticamente, sem
        precisar enviar nada de novo.
      </EmptyState>
    </Panel>
  )
}
