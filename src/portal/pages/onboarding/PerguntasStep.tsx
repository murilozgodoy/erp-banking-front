import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { cn } from '@/lib/cn'

import type { OnboardingTemplate, RespostaValor, Respostas } from '../../types'
import { DynamicField } from './DynamicField'
import { isRequired, isVisible, type Errors } from './model'

interface PerguntasStepProps {
  template: OnboardingTemplate
  respostas: Respostas
  errors: Errors
  onChange: (campo: string, value: RespostaValor) => void
}

/** Seções e campos do template, renderizados dinamicamente pelo `tipo`. */
export function PerguntasStep({ template, respostas, errors, onChange }: PerguntasStepProps) {
  const reduce = useReducedMotion()
  return (
    <div className="space-y-6">
      <p className="max-w-[60ch] text-sm text-ink-muted">
        Valores aproximados bastam: a análise usa ordens de grandeza, não centavos. Os campos com *
        são obrigatórios.
      </p>
      {template.secoes.map((secao) => (
        <section
          key={secao.id}
          aria-labelledby={`secao-${secao.id}`}
          className="grid gap-x-4 gap-y-5 border-t border-line pt-5 sm:grid-cols-2"
        >
          <h3 id={`secao-${secao.id}`} className="text-sm font-semibold text-ink sm:col-span-2">
            {secao.titulo}
          </h3>
          <AnimatePresence initial={false}>
            {secao.campos
              .filter((campo) => isVisible(campo, respostas))
              .map((campo) => (
                <motion.div
                  key={campo.id}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={cn('min-w-0', campo.tipo === 'multiselect' && 'sm:col-span-2')}
                >
                  <DynamicField
                    campo={campo}
                    value={respostas[campo.id]}
                    required={isRequired(campo, respostas)}
                    error={errors[campo.id]}
                    onChange={(value) => onChange(campo.id, value)}
                  />
                </motion.div>
              ))}
          </AnimatePresence>
        </section>
      ))}
    </div>
  )
}
