import { Check } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { MoneyField, SelectField, TextField } from '../../ui/Field'
import { number } from '../../lib/format'
import type { CampoTemplate, RespostaValor } from '../../types'
import { boundsOf, decimalText, parseDecimal, parseInteger } from './model'

interface DynamicFieldProps {
  campo: CampoTemplate
  value: RespostaValor | undefined
  onChange: (value: RespostaValor) => void
  required: boolean
  error?: string
}

function rangeHint(campo: CampoTemplate): string | null {
  if (!['number', 'integer', 'percent', 'currency'].includes(campo.tipo)) return null
  if (campo.tipo === 'currency' && campo.min === 0 && campo.max === undefined) return null
  const { min, max } = boundsOf(campo)
  if (min !== undefined && max !== undefined) return `De ${number(min)} a ${number(max)}.`
  if (max !== undefined) return `Até ${number(max)}.`
  if (min !== undefined && min !== 0) return `A partir de ${number(min)}.`
  return null
}

function hintOf(campo: CampoTemplate): string | undefined {
  return [campo.ajuda, rangeHint(campo)].filter(Boolean).join(' ') || undefined
}

/** Campo do template renderizado pelo `tipo` (PORTAL_CLIENTE.md, seção 3). */
export function DynamicField({ campo, value, onChange, required, error }: DynamicFieldProps) {
  const hint = hintOf(campo)
  switch (campo.tipo) {
    case 'currency':
      return (
        <MoneyField
          name={campo.id}
          label={campo.label}
          hint={hint}
          error={error}
          required={required}
          value={typeof value === 'number' ? value : null}
          onValueChange={onChange}
        />
      )
    case 'percent':
    case 'number':
    case 'integer':
      return (
        <NumberField
          campo={campo}
          hint={hint}
          error={error}
          required={required}
          value={value}
          onChange={onChange}
        />
      )
    case 'select':
      return (
        <SelectField
          name={campo.id}
          label={campo.label}
          hint={hint}
          error={error}
          required={required}
          placeholder="Selecione"
          value={typeof value === 'string' ? value : ''}
          options={(campo.opcoes ?? []).map((opcao) => ({ value: opcao, label: opcao }))}
          onChange={(event) => onChange(event.currentTarget.value || null)}
        />
      )
    case 'multiselect':
      return (
        <Chips
          campo={campo}
          hint={hint}
          error={error}
          required={required}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      )
    case 'boolean':
      return (
        <YesNo
          campo={campo}
          hint={hint}
          error={error}
          required={required}
          value={typeof value === 'boolean' ? value : null}
          onChange={onChange}
        />
      )
    default:
      return (
        <TextField
          name={campo.id}
          label={campo.label}
          hint={hint}
          error={error}
          required={required}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )
  }
}

interface NumberFieldProps {
  campo: CampoTemplate
  value: RespostaValor | undefined
  onChange: (value: number | null) => void
  required: boolean
  hint?: string
  error?: string
}

/** Percentual, número e inteiro: o texto digitado fica local ("12,") e o valor sobe como número. */
function NumberField({ campo, value, onChange, required, hint, error }: NumberFieldProps) {
  const integer = campo.tipo === 'integer'
  const parse = integer ? parseInteger : parseDecimal
  const [text, setText] = useState(() => decimalText(value))
  const [last, setLast] = useState(value)
  if (value !== last) {
    setLast(value)
    if (parse(text) !== value) setText(decimalText(value))
  }
  return (
    <TextField
      name={campo.id}
      label={campo.label}
      hint={hint}
      error={error}
      required={required}
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      suffix={campo.tipo === 'percent' ? '%' : undefined}
      className="[&_input]:tabular"
      value={text}
      onChange={(event) => {
        const raw = event.currentTarget.value
        const clean = integer ? raw.replace(/\D/g, '') : raw.replace(/[^\d.,-]/g, '')
        const parsed = parse(clean)
        setText(clean)
        setLast(parsed)
        onChange(parsed)
      }}
    />
  )
}

interface ChoiceShellProps {
  label: string
  required: boolean
  hint?: string
  error?: string
  children: (props: { describedBy?: string; invalid: boolean }) => ReactNode
}

/** Grupo de opções (fieldset + legend) com ajuda e erro ligados por id. */
function ChoiceShell({ label, required, hint, error, children }: ChoiceShellProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5" aria-describedby={describedBy}>
      <legend className="mb-1.5 text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="text-ink-muted" aria-hidden>
            {' '}
            *
          </span>
        )}
      </legend>
      {children({ describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-negative">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-ink-muted">
            {hint}
          </p>
        )
      )}
    </fieldset>
  )
}

const choice =
  'cursor-pointer select-none transition-[background-color,border-color,color,box-shadow] duration-150 ' +
  'has-focus-visible:ring-3 has-focus-visible:ring-accent/30'

function Chips({
  campo,
  value,
  onChange,
  required,
  hint,
  error,
}: Omit<NumberFieldProps, 'value' | 'onChange'> & {
  value: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <ChoiceShell label={campo.label} required={required} hint={hint} error={error}>
      {({ describedBy, invalid }) => (
        <div className="flex flex-wrap gap-2">
          {(campo.opcoes ?? []).map((opcao) => {
            const checked = value.includes(opcao)
            return (
              <label
                key={opcao}
                className={cn(
                  choice,
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm',
                  checked
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line-strong bg-surface text-ink-muted hover:border-ink-faint hover:text-ink',
                  invalid && !checked && 'border-negative/60',
                )}
              >
                <input
                  type="checkbox"
                  name={campo.id}
                  value={opcao}
                  checked={checked}
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                  className="sr-only"
                  onChange={() =>
                    onChange(checked ? value.filter((v) => v !== opcao) : [...value, opcao])
                  }
                />
                {checked && <Check aria-hidden className="size-3.5" />}
                {opcao}
              </label>
            )
          })}
        </div>
      )}
    </ChoiceShell>
  )
}

function YesNo({
  campo,
  value,
  onChange,
  required,
  hint,
  error,
}: Omit<NumberFieldProps, 'value' | 'onChange'> & {
  value: boolean | null
  onChange: (value: boolean) => void
}) {
  const options = [
    { label: 'Sim', value: true },
    { label: 'Não', value: false },
  ]
  return (
    <ChoiceShell label={campo.label} required={required} hint={hint} error={error}>
      {({ describedBy, invalid }) => (
        <div
          className={cn(
            'inline-flex w-fit rounded-control border bg-sunken p-0.5',
            invalid ? 'border-negative' : 'border-line',
          )}
        >
          {options.map((option) => {
            const checked = value === option.value
            return (
              <label
                key={option.label}
                className={cn(
                  choice,
                  'grid h-8 min-w-16 place-items-center rounded-[5px] px-4 text-sm font-medium',
                  checked ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                <input
                  type="radio"
                  name={campo.id}
                  value={option.value ? 'sim' : 'nao'}
                  checked={checked}
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                  className="sr-only"
                  onChange={() => onChange(option.value)}
                />
                {option.label}
              </label>
            )
          })}
        </div>
      )}
    </ChoiceShell>
  )
}
