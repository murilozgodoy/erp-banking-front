import { Lock } from 'lucide-react'
import { useId, type ComponentProps, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { semPermissaoTexto } from '../team/permissions'
import { useMembro } from '../team/useMembro'
import type { Permissao } from '../types'

import { Button, ButtonLink } from './Button'
import { buttonClass } from './buttonClass'

/**
 * Explica por que a ação está bloqueada: aparece no hover e no foco do botão (que continua
 * focável, com `aria-disabled`), e é o `aria-describedby` dele.
 */
export function LockedAction({
  permissao,
  className,
  children,
}: {
  permissao: Permissao
  className?: string
  children: (props: { 'aria-describedby': string }) => ReactNode
}) {
  const id = useId()
  return (
    <span className={cn('group/gate relative inline-flex', className)}>
      {children({ 'aria-describedby': id })}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-64 -translate-x-1/2 rounded-control bg-ink px-2.5 py-1.5 text-xs text-paper opacity-0 shadow-overlay transition-opacity duration-150 group-focus-within/gate:opacity-100 group-hover/gate:opacity-100"
      >
        {semPermissaoTexto(permissao)}
      </span>
    </span>
  )
}

type ButtonProps = ComponentProps<typeof Button> & { permissao: Permissao }

/**
 * Botão que respeita as permissões do membro: sem a permissão, aparece desabilitado com o
 * cadeado e o tooltip "Peça a um administrador…", em vez de sumir.
 */
export function GatedButton({ permissao, className, onClick, children, ...props }: ButtonProps) {
  const { pode } = useMembro()
  if (pode(permissao)) {
    return (
      <Button className={className} onClick={onClick} {...props}>
        {children}
      </Button>
    )
  }
  return (
    <LockedAction permissao={permissao}>
      {(describe) => (
        <Button
          {...props}
          {...describe}
          icon={<Lock aria-hidden className="size-3.5" />}
          aria-disabled="true"
          onClick={(event) => event.preventDefault()}
          className={cn('cursor-not-allowed opacity-55 active:translate-y-0', className)}
        >
          {children}
        </Button>
      )}
    </LockedAction>
  )
}

type LinkProps = ComponentProps<typeof ButtonLink> & { permissao: Permissao }

/** Mesmo comportamento para ações que são links (ex.: "Simular" levando ao simulador). */
export function GatedButtonLink({ permissao, className, children, ...props }: LinkProps) {
  const { pode } = useMembro()
  if (pode(permissao)) {
    return (
      <ButtonLink className={className} {...props}>
        {children}
      </ButtonLink>
    )
  }
  const { variant = 'secondary', size = 'md' } = props
  return (
    <LockedAction permissao={permissao}>
      {(describe) => (
        <span
          role="link"
          tabIndex={0}
          aria-disabled="true"
          {...describe}
          className={cn(
            buttonClass(variant, size),
            'cursor-not-allowed opacity-55 active:translate-y-0',
            className,
          )}
        >
          <Lock aria-hidden className="size-3.5" />
          {children}
        </span>
      )}
    </LockedAction>
  )
}
