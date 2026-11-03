import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

import { cn } from '@/lib/cn'

import { parseBrlInput } from '../lib/format'

const control =
  'w-full rounded-control border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150 outline-none ' +
  'border-line-strong hover:border-ink-faint focus:border-accent focus:ring-3 focus:ring-accent/20 ' +
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted ' +
  'aria-[invalid=true]:border-negative aria-[invalid=true]:focus:ring-negative/20'

interface FieldShellProps {
  label: string
  hint?: ReactNode
  error?: string
  required?: boolean
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
  className?: string
}

/** Rótulo + controle + ajuda/erro ligados por id (aria-describedby). */
export function FieldShell({ label, hint, error, required, children, className }: FieldShellProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="text-ink-muted" aria-hidden>
            {' '}
            *
          </span>
        )}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-negative">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-xs text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: ReactNode
  error?: string
  /** Texto fixo antes do valor (ex.: "R$"). */
  prefix?: string
  /** Texto fixo depois do valor (ex.: "%", "dias"). */
  suffix?: string
}

export function TextField({
  label,
  hint,
  error,
  prefix,
  suffix,
  required,
  className,
  ...props
}: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {prefix && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-muted">
              {prefix}
            </span>
          )}
          <input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            required={required}
            className={cn(control, 'h-10', prefix && 'pl-9', suffix && 'pr-14')}
            {...props}
          />
          {suffix && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">
              {suffix}
            </span>
          )}
        </div>
      )}
    </FieldShell>
  )
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  hint?: ReactNode
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export function SelectField({
  label,
  hint,
  error,
  options,
  placeholder,
  required,
  className,
  ...props
}: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={cn(control, 'h-10 pr-8')}
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  )
}

interface TextAreaFieldProps extends Omit<InputHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  hint?: ReactNode
  error?: string
  rows?: number
}

export function TextAreaField({
  label,
  hint,
  error,
  required,
  className,
  rows = 5,
  ...props
}: TextAreaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={cn(control, 'resize-y py-2.5 leading-relaxed')}
          {...props}
        />
      )}
    </FieldShell>
  )
}

interface MoneyFieldProps extends Omit<TextFieldProps, 'value' | 'onChange' | 'prefix' | 'type'> {
  value: number | null
  onValueChange: (value: number | null) => void
}

function formatBrlInput(value: number | null): string {
  return value === null || Number.isNaN(value)
    ? ''
    : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Campo de valor em reais: aceita "1.234,56", avisa a cada tecla e formata ao sair do campo. */
export function MoneyField({ value, onValueChange, onBlur, ...props }: MoneyFieldProps) {
  const [text, setText] = useState(() => formatBrlInput(value))
  const [lastValue, setLastValue] = useState(value)
  // Valor trocado por fora (ex.: preenchido por um link): sincroniza o texto.
  if (value !== lastValue) {
    setLastValue(value)
    if (parseBrlInput(text) !== value) setText(formatBrlInput(value))
  }
  return (
    <TextField
      {...props}
      prefix="R$"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      className={cn('[&_input]:tabular', props.className)}
      onChange={(event) => {
        setText(event.currentTarget.value)
        const parsed = parseBrlInput(event.currentTarget.value)
        setLastValue(parsed)
        onValueChange(parsed)
      }}
      onBlur={(event) => {
        setText(formatBrlInput(parseBrlInput(event.currentTarget.value)))
        onBlur?.(event)
      }}
    />
  )
}
