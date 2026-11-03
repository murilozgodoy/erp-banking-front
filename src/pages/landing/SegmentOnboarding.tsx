import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'

import { Faisca } from '@/components/brand/Logo'

import { ONBOARDING_STEPS, SEGMENTS, type SegmentId } from './segments'
import { container, ease, lead, sectionTitle } from './styles'

export function SegmentOnboarding() {
  const [segmentId, setSegmentId] = useState<SegmentId>('alimentacao')
  const segment = SEGMENTS.find((s) => s.id === segmentId) ?? SEGMENTS[0]

  return (
    <section id="cadastro" aria-labelledby="cadastro-title" className="py-20 sm:py-28">
      <div className={container}>
        <div className="grid gap-6 lg:grid-cols-12">
          <h2 id="cadastro-title" className={`${sectionTitle} lg:col-span-6`}>
            Do cadastro ao portal em 3 minutos, com perguntas do seu segmento.
          </h2>
          <p className={`${lead} max-w-[56ch] lg:col-span-5 lg:col-start-8 lg:pt-2`}>
            Nada de formulário genérico. Você escolhe o segmento, responde só o que faz diferença
            para o seu tipo de negócio e conta, com suas palavras, o que os números não mostram. O
            rascunho fica salvo a cada passo.
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-1 border-t border-line sm:grid-cols-5">
          {ONBOARDING_STEPS.map((step) => (
            <li
              key={step.etapa}
              className="flex items-baseline justify-between gap-4 border-b border-line py-4 sm:block sm:border-b-0 sm:py-5 sm:pr-4"
            >
              <div>
                <p className="font-medium text-ink">{step.etapa}</p>
                <p className="mt-1 hidden text-sm text-ink-muted sm:block">{step.detalhe}</p>
              </div>
              <p className="tabular text-sm text-ink-faint sm:mt-3">{step.tempo}</p>
            </li>
          ))}
        </ol>

        <div className="mt-14 grid gap-8 lg:grid-cols-12">
          <fieldset className="lg:col-span-4">
            <legend className="text-sm font-medium text-ink">Veja o template de um segmento</legend>
            <div className="mt-4 flex flex-wrap gap-2 lg:flex-col lg:items-start">
              {SEGMENTS.map((s) => (
                <label
                  key={s.id}
                  className="relative inline-flex h-11 cursor-pointer items-center rounded-full border border-line-strong bg-surface px-4 text-sm text-ink transition-colors duration-150 hover:border-ink-faint has-checked:border-accent has-checked:bg-accent has-checked:text-on-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
                >
                  <input
                    type="radio"
                    name="segmento"
                    value={s.id}
                    checked={s.id === segmentId}
                    onChange={() => setSegmentId(s.id)}
                    className="sr-only"
                  />
                  {s.nome}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="lg:col-span-8" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={segment.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease }}
                className="overflow-hidden rounded-panel border border-line bg-surface shadow-raised"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
                  <h3 className="font-semibold text-ink">
                    Perguntas para {segment.nome.toLowerCase()}
                  </h3>
                  <p className="text-sm text-ink-faint">{segment.exemplo}</p>
                </div>
                <div className="grid sm:grid-cols-[minmax(0,1fr)_15rem]">
                  <dl className="divide-y divide-line px-5 sm:px-6">
                    {segment.perguntas.map((q) => (
                      <div key={q.pergunta} className="py-4">
                        <dt className="text-sm text-ink-muted">{q.pergunta}</dt>
                        <dd className="mt-1.5 rounded-control border border-line bg-paper px-3 py-2 text-ink">
                          {q.resposta}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="space-y-5 border-t border-line bg-sunken/60 p-5 sm:border-t-0 sm:border-l sm:p-6">
                    <div>
                      <p className="text-sm font-medium text-ink">O portal destaca</p>
                      <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
                        {segment.indicadores.map((ind) => (
                          <li key={ind}>{ind}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="border-t border-line pt-5">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-credit-ink">
                        <Faisca label="Sugestão da ErpIa" />
                        {segment.credito.produto}
                      </p>
                      <p className="mt-2 text-sm text-ink-muted">{segment.credito.motivo}</p>
                    </div>
                  </div>
                </div>
              </m.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
