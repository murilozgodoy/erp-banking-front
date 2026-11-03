import {
  AnimatePresence,
  domMax,
  LazyMotion,
  m,
  useAnimate,
  useInView,
  useReducedMotion,
  type Variants,
} from 'motion/react'
import { useEffect, useId, useRef, useState, type FocusEvent } from 'react'

import { Faisca } from '@/components/brand/Logo'

import {
  formatDuration,
  ONBOARDING_STEPS,
  SEGMENT_CYCLE_MS,
  SEGMENTS,
  totalMinutes,
  type SegmentId,
} from './segments'
import { container, ease, lead, sectionTitle } from './styles'

/** Duração do traço que percorre a timeline das etapas. */
const LINE_DRAW_S = 1.1

const reveal: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
}

const stagger: Variants = { show: { transition: { staggerChildren: 0.08 } } }

export function SegmentOnboarding() {
  return (
    // domMax só nesta seção: o indicador deslizante do seletor usa layoutId.
    <LazyMotion features={domMax}>
      <section id="cadastro" aria-labelledby="cadastro-title" className="py-20 sm:py-28">
        <div className={container}>
          <m.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.6 }}
            variants={stagger}
            className="grid gap-5 lg:grid-cols-2 lg:items-end lg:gap-12"
          >
            <m.h2 id="cadastro-title" variants={reveal} className={`${sectionTitle} text-balance`}>
              Do cadastro ao portal em 3 minutos, com perguntas do seu segmento.
            </m.h2>
            <m.p variants={reveal} className={`${lead} max-w-[62ch] lg:pb-1`}>
              Nada de formulário genérico. Você escolhe o segmento, responde só o que faz diferença
              para o seu tipo de negócio e conta, com suas palavras, o que os números não mostram. O
              rascunho fica salvo a cada passo.
            </m.p>
          </m.div>

          <StepsTimeline />
          <SegmentShowcase />
        </div>
      </section>
    </LazyMotion>
  )
}

/** Etapas do cadastro numa linha do tempo: horizontal no desktop, vertical no celular. */
function StepsTimeline() {
  const total = totalMinutes()
  const nodeDelay = (i: number) => (LINE_DRAW_S * i) / ONBOARDING_STEPS.length

  return (
    <m.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      className="relative mt-14 sm:mt-16 lg:flex lg:items-start"
    >
      {/* Trilho e traço de progresso: vertical até lg, horizontal a partir dele. */}
      <div
        aria-hidden
        className="absolute top-3 bottom-[2.3125rem] left-[5.5px] w-px bg-line lg:hidden"
      >
        <m.div
          variants={{
            hidden: { scaleY: 0 },
            show: { scaleY: 1, transition: { duration: LINE_DRAW_S, ease } },
          }}
          className="absolute inset-0 origin-top bg-accent"
        />
      </div>
      <div
        aria-hidden
        className="absolute top-[5.5px] right-[5.5px] left-[5.5px] hidden h-px bg-line lg:block"
      >
        <m.div
          variants={{
            hidden: { scaleX: 0 },
            show: { scaleX: 1, transition: { duration: LINE_DRAW_S, ease } },
          }}
          className="absolute inset-0 origin-left bg-accent"
        />
      </div>

      <ol aria-label="Etapas do cadastro" className="lg:grid lg:flex-1 lg:grid-cols-5">
        {ONBOARDING_STEPS.map((step, i) => {
          const tempo = formatDuration(step.segundos)
          return (
            <m.li
              key={step.etapa}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.3, ease, delay: nodeDelay(i) },
                },
              }}
              className="relative grid grid-cols-[0.75rem_minmax(0,1fr)] gap-x-4 pb-7 lg:flex lg:flex-col lg:pr-6 lg:pb-0"
            >
              <div className="flex h-6 items-center self-start lg:h-3">
                <span className="relative z-[1] grid size-3 place-items-center rounded-full border-2 border-accent bg-paper">
                  <m.span
                    variants={{
                      hidden: { scale: 0 },
                      show: {
                        scale: 1,
                        transition: { duration: 0.24, ease, delay: nodeDelay(i) + 0.12 },
                      },
                    }}
                    className="size-1 rounded-full bg-accent"
                  />
                </span>
                <span className="tabular relative z-[1] hidden bg-paper px-2 text-sm text-ink-faint lg:inline">
                  {tempo}
                </span>
              </div>
              <div className="lg:mt-5">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-ink">{step.etapa}</span>
                  <span className="tabular shrink-0 text-sm text-ink-faint lg:hidden">{tempo}</span>
                </p>
                <p className="mt-1 max-w-[34ch] text-sm text-ink-muted">{step.detalhe}</p>
              </div>
            </m.li>
          )
        })}
      </ol>

      <m.div
        variants={{
          hidden: { opacity: 0, y: 8 },
          show: { opacity: 1, y: 0, transition: { duration: 0.32, ease, delay: LINE_DRAW_S } },
        }}
        className="relative grid grid-cols-[0.75rem_minmax(0,1fr)] gap-x-4 lg:flex lg:shrink-0 lg:flex-col lg:items-end lg:pl-6 lg:text-right"
      >
        <div className="flex h-[2.125rem] items-center self-start lg:h-3">
          <span className="relative z-[1] size-3 rounded-full bg-accent ring-4 ring-paper" />
        </div>
        <div className="lg:mt-3">
          <p className="tabular text-2xl font-semibold tracking-[-0.02em] text-ink">
            <span aria-hidden>≈ {total} min</span>
            <span className="sr-only">Cerca de {total} minutos no total</span>
          </p>
          <p className="text-sm text-ink-muted">e o portal abre</p>
        </div>
      </m.div>
    </m.div>
  )
}

const panel: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease, staggerChildren: 0.06, delayChildren: 0.04 },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } },
}

const field: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease } },
}

/** Seletor de segmento (barra de abas) com a prévia do template em largura total. */
function SegmentShowcase() {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [segmentId, setSegmentId] = useState<SegmentId>('alimentacao')
  // `stopped`: a pessoa escolheu um segmento (ou pausou); a troca automática não volta sozinha.
  const [stopped, setStopped] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const regionRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inView = useInView(regionRef, { amount: 0.35 })
  const remaining = useRef(SEGMENT_CYCLE_MS)
  const [barRef, animateBar] = useAnimate<HTMLSpanElement>()
  const firstRender = useRef(true)

  const auto = !reduce && !stopped
  const running = auto && inView && !hovered && !focused
  const segment = SEGMENTS.find((s) => s.id === segmentId) ?? SEGMENTS[0]

  // Troca automática: o tempo que falta sobrevive às pausas (hover, foco, fora da tela).
  useEffect(() => {
    if (!running) return
    const started = Date.now()
    let fired = false
    const timer = window.setTimeout(() => {
      fired = true
      remaining.current = SEGMENT_CYCLE_MS
      setSegmentId((id) => {
        const index = SEGMENTS.findIndex((s) => s.id === id)
        return SEGMENTS[(index + 1) % SEGMENTS.length].id
      })
    }, remaining.current)
    const bar = barRef.current
      ? animateBar(
          barRef.current,
          { scaleX: 1 },
          { duration: remaining.current / 1000, ease: 'linear' },
        )
      : undefined
    return () => {
      window.clearTimeout(timer)
      bar?.stop()
      if (!fired) remaining.current = Math.max(0, remaining.current - (Date.now() - started))
    }
  }, [running, segmentId, barRef, animateBar])

  // No celular a barra rola: mantém a aba ativa à vista sem mexer no scroll da página.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const list = listRef.current
    const active = list?.querySelector<HTMLElement>('[data-active]')
    if (!list || !active || list.scrollWidth <= list.clientWidth) return
    list.scrollTo?.({
      left: active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2,
      behavior: reduce ? 'auto' : 'smooth',
    })
  }, [segmentId, reduce])

  const stopLabel = stopped ? 'Retomar troca automática' : 'Pausar troca automática'

  const choose = (id: SegmentId) => {
    setStopped(true)
    setSegmentId(id)
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
  }

  return (
    <div
      ref={regionRef}
      className="mt-16 sm:mt-20"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      <div className="flex min-h-11 items-center justify-between gap-4">
        <p id={labelId} className="font-medium text-ink">
          Veja o template de um segmento
        </p>
        {!reduce && (
          <button
            type="button"
            aria-label={stopLabel}
            onClick={() => setStopped((s) => !s)}
            className="-mr-2 inline-flex h-11 shrink-0 items-center rounded-control px-2 text-sm text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="sm:hidden">{stopped ? 'Retomar' : 'Pausar'}</span>
            <span className="hidden sm:inline">{stopLabel}</span>
          </button>
        )}
      </div>

      <div
        ref={listRef}
        role="group"
        aria-labelledby={labelId}
        className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-1 sm:overflow-visible sm:rounded-panel sm:border sm:border-line sm:bg-sunken sm:p-1 lg:grid-cols-8 [&::-webkit-scrollbar]:hidden"
      >
        {SEGMENTS.map((s) => {
          const active = s.id === segmentId
          return (
            <label
              key={s.id}
              data-active={active || undefined}
              className="relative flex h-11 shrink-0 cursor-pointer snap-start items-center justify-center rounded-control border border-line bg-surface px-4 text-sm font-medium whitespace-nowrap text-ink-muted transition-colors duration-150 hover:text-ink has-checked:text-on-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent sm:border-transparent sm:bg-transparent sm:px-3 sm:hover:bg-surface/70"
            >
              <input
                type="radio"
                name="segmento"
                value={s.id}
                checked={active}
                onChange={() => choose(s.id)}
                className="sr-only"
              />
              {active && (
                <m.span
                  aria-hidden
                  layoutId="segmento-indicador"
                  transition={{ type: 'spring', bounce: 0, duration: 0.38 }}
                  className="absolute -inset-px overflow-hidden rounded-control bg-accent shadow-raised"
                >
                  {auto && (
                    <span
                      ref={barRef}
                      data-testid="segmento-progresso"
                      style={{ transform: 'scaleX(0)' }}
                      className="absolute inset-x-3 bottom-1 h-0.5 origin-left rounded-full bg-on-accent/55"
                    />
                  )}
                </m.span>
              )}
              <span className="relative">{s.nome}</span>
            </label>
          )
        })}
      </div>

      <div
        aria-live={stopped ? 'polite' : 'off'}
        className="mt-4 overflow-hidden rounded-panel border border-line bg-surface shadow-raised"
      >
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={segment.id} variants={panel} initial="hidden" animate="show" exit="exit">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-4 sm:px-6">
              <h3 className="font-semibold text-ink">
                Perguntas para {segment.nome.toLowerCase()}
              </h3>
              <p className="text-sm text-ink-faint">{segment.exemplo}</p>
            </div>
            <div className="grid md:grid-cols-3">
              <dl className="space-y-4 px-5 py-5 sm:px-6 sm:py-6 md:col-span-2">
                {segment.perguntas.map((q) => (
                  <m.div key={q.pergunta} variants={field}>
                    <dt className="text-sm text-ink-muted">{q.pergunta}</dt>
                    <dd className="mt-1.5 rounded-control border border-line bg-paper px-3 py-2 text-ink">
                      {q.resposta}
                    </dd>
                  </m.div>
                ))}
              </dl>
              <div className="flex flex-col gap-5 border-t border-line bg-sunken/60 p-5 sm:p-6 md:border-t-0 md:border-l">
                <m.div variants={field}>
                  <p className="text-sm font-medium text-ink">O portal destaca</p>
                  <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                    {segment.indicadores.map((ind) => (
                      <li key={ind} className="flex gap-2.5">
                        <span aria-hidden className="mt-2 h-px w-2.5 shrink-0 bg-line-strong" />
                        {ind}
                      </li>
                    ))}
                  </ul>
                </m.div>
                <m.div variants={field} className="mt-auto border-t border-line pt-5">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-credit-ink">
                    <Faisca label="Sugestão da ErpIa" />
                    {segment.credito.produto}
                  </p>
                  <p className="mt-2 text-sm text-ink-muted">{segment.credito.motivo}</p>
                </m.div>
              </div>
            </div>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
