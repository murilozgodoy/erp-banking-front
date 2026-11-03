import { ErpIaLogo } from '@/components/brand/Logo'

import { DashboardPreview } from './DashboardPreview'
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
        <a href="#topo" className="rounded-control" aria-label="ErpIa, início da página">
          <ErpIaLogo className="pointer-events-none" />
        </a>
        <nav aria-label="Seções" className="hidden md:block">
          <ul className="flex gap-7 text-sm text-ink-muted">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="transition-colors hover:text-ink">
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
            className="h-10 rounded-control px-3 text-sm font-medium text-ink transition-colors hover:bg-sunken"
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={signup}
            className="h-10 rounded-control bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
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
    <section id="topo" aria-labelledby="hero-title" className="relative">
      <div className={`${container} pt-12 sm:pt-20`}>
        <h1
          id="hero-title"
          className="max-w-[17ch] text-[clamp(2.375rem,1.3rem+4.6vw,4.875rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-ink"
        >
          O ERP que lê sua operação e encontra o crédito certo.
        </h1>
        <div className="mt-8 grid gap-8 md:grid-cols-12 md:items-end">
          <p className="max-w-[54ch] text-lg leading-relaxed text-ink-muted md:col-span-7">
            Vendas, recebíveis, estoque e contas a pagar no mesmo sistema, com conta PJ, PIX e
            boletos embutidos. A ErpIa acompanha esses números todo dia e mostra, em cada tela, qual
            crédito resolve o que vem pela frente e quanto ele custa.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row md:col-span-5 md:justify-end">
            <button type="button" onClick={signup} className={primaryButton}>
              Criar conta grátis
              <ArrowRightIcon />
            </button>
            <button type="button" onClick={login} className={secondaryButton}>
              Entrar
            </button>
          </div>
        </div>
        <p className="mt-5 text-sm text-ink-faint md:text-right">
          Cadastro em cerca de 3 minutos. Sem cartão de crédito.
        </p>
      </div>

      <div className="relative mt-12 sm:mt-16">
        <div aria-hidden className="absolute inset-x-0 top-[38%] bottom-0 bg-rail" />
        <div className={`${container} relative pb-14 sm:pb-20`}>
          <DashboardPreview />
        </div>
      </div>
    </section>
  )
}
