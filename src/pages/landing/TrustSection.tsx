import {
  animate,
  m,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'

import { Marca } from '@/components/brand/Logo'
import { useMediaQuery } from '@/portal/lib/useMediaQuery'

import { container, ease, lead, sectionTitle } from './styles'

/** Ícones da seção, no mesmo desenho dos de `icons.tsx` (traço 1,75 em grade 20×20). */
function StepIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      {children}
    </svg>
  )
}

interface Step {
  titulo: string
  detalhe: string
  texto: ReactNode
  icon: ReactNode
}

/** O caminho dos dados, na ordem em que acontece: entrar, consultar, guardar e analisar. */
const STEPS: Step[] = [
  {
    titulo: 'Login pelo Auth0',
    detalhe: 'OAuth 2.0 com PKCE',
    texto: (
      <>
        Autenticação com OAuth 2.0 e PKCE, feita pelo Auth0. A <Marca /> não recebe nem guarda a sua
        senha.
      </>
    ),
    icon: (
      <StepIcon>
        <rect x="4" y="9" width="12" height="8.5" rx="2" />
        <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
      </StepIcon>
    ),
  },
  {
    titulo: 'Dados separados por empresa',
    detalhe: 'Filtro na API',
    texto:
      'Cada consulta é filtrada pela empresa da sessão, na API e não só na tela. Outra conta não enxerga seus números.',
    icon: (
      <StepIcon>
        <path d="M3.5 17.5h13M5 17.5V4.5h7v13M12 8.5h3v9" />
        <path d="M7.5 7.5h2M7.5 10.5h2M7.5 13.5h2" />
      </StepIcon>
    ),
  },
  {
    titulo: 'LGPD',
    detalhe: 'Finalidade declarada',
    texto:
      'Seus dados servem para operar o ERP e analisar crédito, com finalidade declarada. Você pode pedir cópia ou exclusão quando quiser.',
    icon: (
      <StepIcon>
        <path d="M5 2.5h6.5L15 6v11.5H5z" />
        <path d="M11.5 2.5V6H15M7.5 11.5l1.75 1.75 3.25-3.5" />
      </StepIcon>
    ),
  },
  {
    titulo: 'Análise com revisão humana',
    detalhe: 'Regras, IA e uma pessoa',
    texto:
      'A análise de crédito combina regras e IA. Quando um caso foge do padrão, uma pessoa da equipe revisa antes de qualquer decisão, e você acompanha o andamento no portal.',
    icon: (
      <StepIcon>
        <circle cx="10" cy="6.5" r="3" />
        <path d="M4 17.5a6 6 0 0 1 12 0" />
      </StepIcon>
    ),
  },
]

const reveal = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
}

const FLOW = [
  { label: 'Você', note: 'entra' },
  { label: 'Auth0', note: 'login' },
  { label: 'API', note: 'por empresa' },
  { label: 'Base', note: 'LGPD' },
  { label: 'Análise', note: 'revisão' },
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Mini diagrama do caminho de um dado, sincronizado com a lista: com a etapa `active` acesa,
 * os nós até ela acendem e a linha preenche até o nó dela ("Você" é o ponto de partida).
 */
function DataFlow({ active }: { active: number }) {
  const reach = active < 0 ? 0 : (active + 1) / (FLOW.length - 1)
  return (
    <m.figure
      className="m-0 border-t border-line pt-5"
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.6 }}
    >
      <figcaption className="text-sm font-medium text-ink">O caminho de um dado</figcaption>
      <div aria-hidden className="relative mt-5">
        <span className="absolute inset-x-[5px] top-[4.5px] h-px">
          <m.span
            className="absolute inset-0 origin-left bg-line-strong"
            variants={{
              hidden: { scaleX: 0 },
              shown: { scaleX: 1, transition: { duration: 0.6, ease, delay: 0.1 } },
            }}
          />
          <span
            data-testid="flow-progress"
            className="absolute inset-0 origin-left bg-accent transition-transform duration-300 ease-out-expo"
            style={{ transform: `scaleX(${reach})` }}
          />
        </span>
        <ol className="relative flex justify-between">
          {FLOW.map(({ label, note }, i) => {
            const lit = active >= 0 && i <= active + 1
            return (
              <m.li
                key={label}
                data-lit={lit}
                className={`flex flex-col gap-2 ${
                  i === 0 ? 'items-start' : i === FLOW.length - 1 ? 'items-end' : 'items-center'
                }`}
                variants={{
                  hidden: { opacity: 0, y: 6 },
                  shown: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.28, ease, delay: 0.15 + i * 0.08 },
                  },
                }}
              >
                <span
                  className={`size-2.5 rounded-full border-2 transition-colors duration-300 ${
                    lit ? 'border-accent bg-accent' : 'border-line-strong bg-paper'
                  }`}
                />
                <span
                  className={`flex flex-col text-xs transition-colors duration-300 ${
                    i === 0 ? '' : i === FLOW.length - 1 ? 'text-right' : 'text-center'
                  } ${lit ? 'text-ink' : 'text-ink-faint'}`}
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-2xs text-ink-faint">{note}</span>
                </span>
              </m.li>
            )
          })}
        </ol>
      </div>
    </m.figure>
  )
}

/**
 * Segurança como o caminho dos dados. No desktop, a coluna da esquerda (frase, parágrafo e o
 * mini diagrama) fica fixa enquanto as quatro etapas rolam à direita: o trilho preenche em
 * esmeralda conforme o scroll e cada etapa acende quando o seu nó cruza o meio da tela. No
 * celular e no tablet, cada etapa acende ao entrar na tela e o trilho preenche até ela. Com
 * "reduzir movimento", tudo já aparece aceso e parado. Focar uma etapa pelo teclado rola até ela.
 */
export function TrustSection() {
  const section = useRef<HTMLElement>(null)
  const nodes = useRef<(HTMLSpanElement | null)[]>([])
  const desktop = useMediaQuery('(min-width: 1024px)')
  const reduce = useReducedMotion() ?? false
  const [scrollActive, setScrollActive] = useState(-1)
  const [viewActive, setViewActive] = useState(-1)
  const [focus, setFocus] = useState<number | null>(null)
  // Preenchimento de cada trecho do trilho (do nó i ao nó i + 1), de 0 a 1.
  const seg0 = useMotionValue(0)
  const seg1 = useMotionValue(0)
  const seg2 = useMotionValue(0)
  const segments = [seg0, seg1, seg2]
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ['start center', 'end center'],
  })

  const centers = () =>
    nodes.current.map((node) => {
      const rect = node?.getBoundingClientRect()
      return rect ? rect.top + rect.height / 2 : 0
    })

  useMotionValueEvent(scrollYProgress, 'change', () => {
    if (!desktop || reduce) return
    const c = centers()
    const mid = window.innerHeight / 2
    setScrollActive(c.reduce((acc, y, i) => (y <= mid ? i : acc), -1))
    segments.forEach((seg, i) => seg.set(clamp01((mid - c[i]) / (c[i + 1] - c[i] || 1))))
  })

  function enter(i: number) {
    if (desktop || reduce) return
    setViewActive((current) => Math.max(current, i))
    segments.forEach((seg, k) => {
      if (k < i) animate(seg, 1, { duration: 0.4, ease })
    })
  }

  const active = reduce ? STEPS.length - 1 : desktop ? scrollActive : viewActive

  return (
    <section
      ref={section}
      id="seguranca"
      aria-labelledby="seguranca-title"
      className="py-20 sm:py-28"
    >
      <div className={`${container} grid gap-x-12 gap-y-10 lg:grid-cols-12`}>
        <div className="flex flex-col gap-10 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
          <div>
            <h2 id="seguranca-title" className={sectionTitle}>
              Seus números continuam sendo da sua empresa.
            </h2>
            <p className={`${lead} mt-6 max-w-[46ch]`}>
              Do login à análise de crédito, cada etapa tem uma regra clara sobre quem vê os seus
              dados e para quê.
            </p>
          </div>
          <DataFlow active={active} />
        </div>

        <ol className="lg:col-span-7">
          {STEPS.map((step, i) => {
            const lit = i <= active
            const highlight = lit || focus === i
            const last = i === STEPS.length - 1
            return (
              <m.li
                key={step.titulo}
                tabIndex={0}
                aria-current={i === active ? 'step' : undefined}
                data-active={lit}
                variants={reveal}
                initial={reduce ? false : 'hidden'}
                whileInView="shown"
                viewport={{ once: true, amount: 0.6 }}
                onViewportEnter={() => enter(i)}
                onFocus={(event) => {
                  setFocus(i)
                  event.currentTarget.scrollIntoView?.({
                    block: 'center',
                    behavior: reduce ? 'auto' : 'smooth',
                  })
                }}
                onBlur={() => setFocus(null)}
                onPointerEnter={() => setFocus(i)}
                onPointerLeave={() => setFocus(null)}
                className={`relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 rounded-control sm:gap-x-5 ${
                  last ? '' : 'lg:min-h-[50vh]'
                }`}
              >
                {/* Trecho do trilho até a próxima etapa (do centro deste nó ao centro do próximo). */}
                {!last && (
                  <span aria-hidden className="absolute top-[2.375rem] left-[1.125rem] h-full w-px">
                    <span className="absolute inset-0 bg-line-strong" />
                    <m.span
                      data-testid="trust-segment"
                      className="absolute inset-0 origin-top bg-accent"
                      style={{ scaleY: reduce ? 1 : segments[i] }}
                    />
                  </span>
                )}
                <span
                  ref={(node) => {
                    nodes.current[i] = node
                  }}
                  aria-hidden
                  className={`relative z-[1] mt-5 flex size-9 items-center justify-center rounded-full border transition-colors duration-300 ${
                    lit
                      ? 'border-accent bg-accent text-on-accent'
                      : highlight
                        ? 'border-accent bg-paper text-accent'
                        : 'border-line bg-paper text-ink-faint'
                  }`}
                >
                  {step.icon}
                </span>
                <div className={`border-line py-5 ${i === 0 ? '' : 'border-t'}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3
                      className={`text-lg font-medium transition-colors duration-300 ${
                        highlight ? 'text-ink' : 'text-ink-faint'
                      }`}
                    >
                      {step.titulo}
                    </h3>
                    <p className="text-xs text-ink-faint">{step.detalhe}</p>
                  </div>
                  <p
                    className={`mt-2 max-w-[62ch] transition-colors duration-300 ${
                      lit ? 'text-ink-muted' : 'text-ink-faint'
                    }`}
                  >
                    {step.texto}
                  </p>
                </div>
              </m.li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
