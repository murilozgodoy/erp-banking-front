import { ClipboardCheck } from 'lucide-react'

import { ButtonLink } from '../../ui/Button'
import { EmptyState, Panel } from '../../ui/Surface'

/** 409 `ONBOARDING_PENDENTE`: a área só abre depois do cadastro aprovado. */
export function OnboardingPending({ area }: { area: string }) {
  return (
    <Panel>
      <EmptyState
        icon={<ClipboardCheck aria-hidden className="size-5" />}
        title="Seu cadastro ainda está em análise"
        action={
          <ButtonLink to="/app/status" variant="primary">
            Acompanhar análise
          </ButtonLink>
        }
      >
        {area} abre assim que o cadastro da empresa for aprovado. Acompanhe o andamento e veja se
        falta algum dado.
      </EmptyState>
    </Panel>
  )
}
