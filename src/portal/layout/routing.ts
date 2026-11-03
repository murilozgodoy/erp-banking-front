import type { OnboardingStatus } from '../types'

/** Para onde cada status do onboarding leva o cliente. */
export function portalHome(status: OnboardingStatus): string {
  switch (status) {
    case 'NAO_INICIADO':
    case 'RASCUNHO':
      return '/app/onboarding'
    case 'APROVADO':
      return '/app'
    default:
      return '/app/status'
  }
}

/** Rotas acessíveis em cada status (o resto redireciona para `portalHome`). */
export function allowed(status: OnboardingStatus, path: string): boolean {
  const onboarding = path.startsWith('/app/onboarding')
  const statusPage = path.startsWith('/app/status')
  if (status === 'NAO_INICIADO' || status === 'RASCUNHO') return onboarding
  if (status === 'APROVADO') return !onboarding
  // Reprovado: vê o status e pode revisar e reenviar o cadastro.
  if (status === 'REPROVADO') return statusPage || onboarding
  // Em análise ou análise manual: só a página de status.
  return statusPage
}
