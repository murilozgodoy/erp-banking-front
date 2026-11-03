import { m } from 'motion/react'

import { ErpIaLogo, Marca } from '@/components/brand/Logo'

import { ArrowRightIcon } from './icons'
import { container, ease } from './styles'
import { useLandingAuth } from './useLandingAuth'

/*
 * A faixa final usa a superfície escura (`surface-dark`) nos dois temas, fechando a página com o
 * mesmo rail do painel do hero. Os botões levam as cores do esmeralda escuro, porque o
 * `on-accent` e o `accent-hover` do tema claro não valem sobre esse fundo.
 */
const buttonBase =
  'inline-flex h-12 items-center justify-center gap-2 rounded-control px-5 text-base font-medium whitespace-nowrap transition-colors duration-150 ease-out-expo'
const darkPrimary = `${buttonBase} bg-accent text-[#03190F] hover:bg-[#62D8AA]`
const darkSecondary = `${buttonBase} border border-line-strong text-rail-ink hover:bg-rail-raised`

const rise = {
  hidden: { opacity: 0, y: 10 },
  shown: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease, delay: i * 0.08 },
  }),
}

export function FinalCta() {
  const { login, signup } = useLandingAuth()
  return (
    <section
      aria-labelledby="cta-title"
      className="bg-rail py-20 text-rail-ink surface-dark sm:py-28"
    >
      <m.div
        className={`${container} grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-12`}
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, amount: 0.4 }}
      >
        <m.h2
          id="cta-title"
          custom={0}
          variants={rise}
          className="max-w-[18ch] text-[clamp(2.25rem,1.2rem+4.2vw,4.5rem)] leading-[1.02] font-semibold tracking-[-0.034em] text-rail-ink lg:col-span-8"
        >
          Veja o que a sua operação diz sobre o seu crédito.
        </m.h2>
        <m.div custom={1} variants={rise} className="lg:col-span-4">
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <button type="button" onClick={signup} className={`${darkPrimary} sm:flex-1`}>
              Criar conta grátis
              <ArrowRightIcon />
            </button>
            <button type="button" onClick={login} className={`${darkSecondary} sm:flex-1`}>
              Entrar
            </button>
          </div>
          <p className="mt-4 text-sm text-rail-muted">
            Cadastro em cerca de 3 minutos. Sem cartão de crédito.
          </p>
        </m.div>
      </m.div>
    </section>
  )
}

const LINKS = [
  { href: '#cadastro', label: 'Cadastro' },
  { href: '#credito', label: 'Crédito' },
  { href: '#banking', label: 'Banking' },
  { href: '#seguranca', label: 'Segurança' },
]

export function LandingFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className={`${container} grid gap-8 py-12 sm:grid-cols-12 sm:gap-x-8`}>
        <div className="sm:col-span-5 lg:col-span-4">
          <ErpIaLogo />
          <p className="mt-3 max-w-[34ch] text-sm text-ink-muted">
            ERP com banking e crédito inteligente para empresas.
          </p>
        </div>
        <nav aria-label="Rodapé" className="sm:col-span-7 lg:col-span-4">
          <ul className="grid grid-cols-2 gap-x-8 text-sm">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-ink-muted transition-colors hover:text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-xs leading-relaxed text-ink-faint sm:col-span-12 lg:col-span-4">
          Simulações e valores nesta página são ilustrativos. Taxas, limites e CET dependem da
          análise de cada empresa.
        </p>
      </div>
      <div className={container}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-3 text-xs text-ink-faint">
          <p>
            © 2026 <Marca />
          </p>
          <a
            href="#topo"
            className="inline-flex min-h-11 items-center transition-colors hover:text-ink"
          >
            Voltar ao topo
          </a>
        </div>
      </div>
    </footer>
  )
}
