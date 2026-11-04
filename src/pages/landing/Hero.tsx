import { ErpIaLogo, Marca } from '@/components/brand/Logo'

import { DashboardPreview } from './DashboardPreview'
import { HeroBackdrop } from './HeroBackdrop'
import { HeroThinking } from './HeroThinking'
import { ArrowRightIcon } from './icons'
import { container, primaryButton, secondaryButton } from './styles'
import { useLandingAuth } from './useLandingAuth'

const NAV = [
  { href: '#cadastro', label: 'Cadastro' },
  { href: '#credito', label: 'Crédito' },
  { href: '#banking', label: 'Banking' },
  { href: '#seguranca', label: 'Segurança' },
]

export function LandingHeader() {
  const { login, signup } = useLandingAuth()
  return (
    <header className="border-b border-line">
      <div className={`${container} flex h-16 items-center justify-between gap-4`}>
        <a
          href="#topo"
          className="inline-flex items-center rounded-control pointer-coarse:min-h-11"
          aria-label="ErpIa, início da página"
        >
          <ErpIaLogo className="pointer-events-none" />
        </a>
        <nav aria-label="Seções" className="hidden md:block">
          <ul className="flex gap-7 text-sm text-ink-muted">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="inline-flex items-center rounded-control transition-colors hover:text-ink pointer-coarse:min-h-11"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1 sm:gap-3">
          <button
            type="button"
            onClick={login}
            className="h-10 rounded-control px-3 text-sm font-medium text-ink transition-colors hover:bg-sunken pointer-coarse:h-11"
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={signup}
            className="h-10 rounded-control bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover pointer-coarse:h-11"
          >
            Criar conta
          </button>
        </div>
      </div>
    </header>
  )
}

export function Hero() {
  const { login, signup } = useLandingAuth()
  return (
    <section id="topo" aria-labelledby="hero-title" className="relative isolate">
      <div className="relative">
        <HeroBackdrop className="inset-x-0 top-0 -bottom-16 -z-10 sm:-bottom-24" />
        <div
          className={`${container} relative grid gap-12 pt-12 sm:pt-20 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:items-center lg:gap-14`}
        >
          <div>
            <h1
              id="hero-title"
              className="max-w-[16ch] text-[clamp(2.25rem,1.35rem+3.4vw,4rem)] leading-[1.04] font-semibold tracking-[-0.034em] text-ink"
            >
              O ERP que lê sua operação e encontra o crédito certo.
            </h1>
            <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-ink-muted">
              Vendas, recebíveis, estoque e contas a pagar no mesmo sistema, com conta PJ, PIX e
              boletos embutidos. A <Marca /> acompanha esses números todo dia e mostra, em cada
              tela, qual crédito resolve o que vem pela frente e quanto ele custa.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={signup} className={primaryButton}>
                Criar conta grátis
                <ArrowRightIcon />
              </button>
              <button type="button" onClick={login} className={secondaryButton}>
                Entrar
              </button>
            </div>
            <p className="mt-4 text-sm text-ink-faint">
              Cadastro em cerca de 3 minutos. Sem cartão de crédito.
            </p>
          </div>

          <HeroThinking className="relative z-10 w-full max-w-xl justify-self-center lg:max-w-none" />
        </div>
      </div>

      <div className="relative mt-16 sm:mt-24">
        <div aria-hidden className="absolute inset-x-0 top-[38%] bottom-0 bg-rail" />
        <div className={`${container} relative pb-14 sm:pb-20`}>
          <DashboardPreview />
        </div>
      </div>
    </section>
  )
}
