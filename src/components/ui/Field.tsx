import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

const controlClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink shadow-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none disabled:bg-sunken'

interface FieldProps {
  label: string
  hint?: ReactNode
}

/** Input com label associado (acessível e fácil de achar nos testes por `getByLabelText`). */
export function InputField({
  label,
  hint,
  className = '',
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      <input id={id} className={controlClass} {...props} />
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}

export function SelectField({
  label,
  hint,
  className = '',
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      <select id={id} className={controlClass} {...props}>
        {children}
      </select>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}
