import {
  Briefcase,
  Building2,
  Cpu,
  Factory,
  HardHat,
  Shapes,
  Stethoscope,
  Store,
  Utensils,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import { useId } from 'react'

import { cn } from '@/lib/cn'

import type { OnboardingTemplate, Segmento } from '../../types'
import { camposDe } from './model'

/** `icone` do template (nome lucide) → componente. Ícone desconhecido cai no prédio. */
const ICONS: Record<string, LucideIcon> = {
  store: Store,
  utensils: Utensils,
  briefcase: Briefcase,
  stethoscope: Stethoscope,
  cpu: Cpu,
  factory: Factory,
  wheat: Wheat,
  'hard-hat': HardHat,
  shapes: Shapes,
}

export function SegmentIcon({ icone, className }: { icone: string; className?: string }) {
  const Icon = ICONS[icone] ?? Building2
  return <Icon aria-hidden className={className} />
}

interface SegmentoStepProps {
  templates: OnboardingTemplate[]
  value: Segmento | null
  onChange: (segmento: Segmento) => void
  error?: string
}

export function SegmentoStep({ templates, value, onChange, error }: SegmentoStepProps) {
  const id = useId()
  const principais = templates.filter((template) => template.segmento !== 'outro')
  const outro = templates.find((template) => template.segmento === 'outro')
  const escolhido = templates.find((template) => template.segmento === value)
  const describedBy = error ? `${id}-error` : `${id}-hint`

  const option = (template: OnboardingTemplate, variant: 'main' | 'other') => {
    const checked = template.segmento === value
    return (
      <label
        key={template.segmento}
        className={cn(
          'group flex cursor-pointer items-center gap-3 rounded-control border px-3 py-3 transition-[background-color,border-color,box-shadow] duration-150',
          'has-focus-visible:ring-3 has-focus-visible:ring-accent/30',
          checked
            ? 'border-accent bg-accent-soft'
            : variant === 'main'
              ? 'border-transparent hover:bg-sunken'
              : 'border-dashed border-line-strong hover:bg-sunken',
        )}
      >
        <input
          type="radio"
          name="segmento"
          value={template.segmento}
          checked={checked}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className="sr-only"
          onChange={() => onChange(template.segmento)}
        />
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-control transition-colors duration-150',
            checked ? 'bg-accent text-on-accent' : 'bg-sunken text-ink-muted group-hover:text-ink',
          )}
        >
          <SegmentIcon icone={template.icone} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{template.nome}</span>
          <span className="block text-sm text-ink-muted">{template.descricao}</span>
        </span>
        <span
          aria-hidden
          className={cn(
            'grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-150',
            checked ? 'border-accent bg-accent' : 'border-line-strong bg-surface',
          )}
        >
          {checked && <span className="size-1.5 rounded-full bg-on-accent" />}
        </span>
      </label>
    )
  }

  return (
    <fieldset aria-describedby={describedBy} className="min-w-0 space-y-5">
      <legend className="sr-only">Segmento do negócio</legend>
      <p id={`${id}-hint`} className="max-w-[60ch] text-sm text-ink-muted">
        O segmento define as perguntas do próximo passo e a régua da análise. Escolha o que gera a
        maior parte da receita.
      </p>
      <div className="grid gap-1 md:grid-cols-2 md:gap-x-3">
        {principais.map((template) => option(template, 'main'))}
      </div>
      {outro && (
        <div className="space-y-2 border-t border-line pt-5">
          <p className="text-sm text-ink-muted">
            Não achou o seu? Escolha a opção abaixo: um analista lê o cadastro antes da decisão.
          </p>
          <div className="md:w-1/2 md:pr-1.5">{option(outro, 'other')}</div>
        </div>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-negative">
          {error}
        </p>
      )}
      {escolhido && (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Próximo passo:{' '}
          <span className="tabular font-medium text-ink">
            {camposDe(escolhido).length} perguntas
          </span>{' '}
          sobre {escolhido.secoes.map((secao) => secao.titulo.toLowerCase()).join(', ')}.
        </p>
      )}
    </fieldset>
  )
}
