import { ErpIaLogo, Marca } from '@/components/brand/Logo'

import { ArrowRightIcon } from './icons'
import { container, primaryButton } from './styles'
import { useLandingAuth } from './useLandingAuth'

export function FinalCta() {
  const { login, signup } = useLandingAuth()
  return (
    <section aria-labelledby="cta-title" className="border-t border-line bg-surface py-20 sm:py-28">
      <div className={`${container} grid gap-8 lg:grid-cols-12 lg:items-end`}>
        <h2
          id="cta-title"
          className="max-w-[20ch] text-[clamp(2.125rem,1.2rem+3.8vw,4rem)] leading-[1.04] font-semibold tracking-[-0.032em] text-ink lg:col-span-8"
        >
          Veja o que a sua operação diz sobre o seu crédito.
        </h2>
        <div className="flex flex-col gap-4 lg:col-span-4 lg:items-end">
          <button type="button" onClick={signup} className={`${primaryButton} w-full sm:w-auto`}>
            Criar conta grátis
            <ArrowRightIcon />
          </button>
          <p className="text-sm text-ink-muted">
            Já tem conta?{' '}
            <button
              type="button"
              onClick={login}
              className="rounded-control font-medium text-accent underline underline-offset-4 hover:text-accent-hover"
            >
              Entrar
            </button>
          </p>
        </div>
      </div>
    </section>
  )
}

export function LandingFooter() {
  return (
    <footer className="border-t border-line py-10">
      <div
        className={`${container} flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between`}
      >
        <div className="space-y-3">
          <ErpIaLogo />
          <p className="text-sm text-ink-muted">
            ERP com banking e crédito inteligente para empresas.
          </p>
        </div>
        <div className="max-w-md space-y-2 text-xs leading-relaxed text-ink-faint sm:text-right">
          <p>
            Simulações e valores nesta página são ilustrativos. Taxas, limites e CET dependem da
            análise de cada empresa.
          </p>
          <p>
            © 2026 <Marca />
          </p>
        </div>
      </div>
    </footer>
  )
}
