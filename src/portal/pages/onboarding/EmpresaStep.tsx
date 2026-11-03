import type { ChangeEvent, ReactNode } from 'react'

import { SelectField, TextField } from '../../ui/Field'
import { formatCnpj } from '../../lib/format'
import type { Empresa } from '../../types'
import { EMPRESA_LABELS, formatPhone, MAX_NOME, parseInteger, UFS, type Errors } from './model'

interface EmpresaStepProps {
  empresa: Empresa
  errors: Errors
  onChange: <K extends keyof Empresa>(campo: K, value: Empresa[K]) => void
  /** Valida um campo ao sair dele (CNPJ, e-mail, telefone). */
  onBlurField: (campo: keyof Empresa) => void
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-5 border-t border-line pt-5 first:border-t-0 first:pt-0 sm:grid-cols-6">
      <h3 className="text-sm font-semibold text-ink sm:col-span-6">{title}</h3>
      {children}
    </div>
  )
}

export function EmpresaStep({ empresa, errors, onChange, onBlurField }: EmpresaStepProps) {
  const err = (campo: keyof Empresa) => errors[`empresa.${campo}`]
  const text = (campo: 'razao_social' | 'nome_fantasia' | 'cidade') => ({
    name: `empresa.${campo}`,
    label: EMPRESA_LABELS[campo],
    maxLength: campo === 'cidade' ? undefined : MAX_NOME,
    error: err(campo),
    value: empresa[campo],
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(campo, event.currentTarget.value),
  })
  return (
    <div className="space-y-6">
      <Group title="Identificação">
        <TextField
          {...text('razao_social')}
          required
          autoComplete="organization"
          className="sm:col-span-6"
        />
        <TextField
          {...text('nome_fantasia')}
          hint="Como os clientes conhecem a empresa."
          className="sm:col-span-3"
        />
        <TextField
          name="empresa.cnpj"
          label={EMPRESA_LABELS.cnpj}
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="00.000.000/0000-00"
          className="[&_input]:tabular sm:col-span-3"
          error={err('cnpj')}
          value={formatCnpj(empresa.cnpj)}
          onChange={(event) =>
            onChange('cnpj', event.currentTarget.value.replace(/\D/g, '').slice(0, 14))
          }
          onBlur={() => onBlurField('cnpj')}
        />
      </Group>

      <Group title="Contato">
        <TextField
          name="empresa.email"
          label={EMPRESA_LABELS.email}
          required
          type="email"
          autoComplete="email"
          hint="Para onde mandamos o resultado da análise."
          className="sm:col-span-3"
          error={err('email')}
          value={empresa.email ?? ''}
          onChange={(event) => onChange('email', event.currentTarget.value)}
          onBlur={() => onBlurField('email')}
        />
        <TextField
          name="empresa.telefone"
          label={EMPRESA_LABELS.telefone}
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(00) 00000-0000"
          className="[&_input]:tabular sm:col-span-3"
          error={err('telefone')}
          value={formatPhone(empresa.telefone ?? '')}
          onChange={(event) =>
            onChange('telefone', event.currentTarget.value.replace(/\D/g, '').slice(0, 11))
          }
          onBlur={() => onBlurField('telefone')}
        />
      </Group>

      <Group title="Localização e porte">
        <TextField
          {...text('cidade')}
          required
          autoComplete="address-level2"
          className="sm:col-span-4"
        />
        <SelectField
          name="empresa.estado"
          label={EMPRESA_LABELS.estado}
          required
          placeholder="UF"
          className="sm:col-span-2"
          error={err('estado')}
          value={empresa.estado}
          options={UFS.map((uf) => ({ value: uf, label: uf }))}
          onChange={(event) => onChange('estado', event.currentTarget.value)}
        />
        <TextField
          name="empresa.fundacao_ano"
          label={EMPRESA_LABELS.fundacao_ano}
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          placeholder="2015"
          className="[&_input]:tabular sm:col-span-3"
          error={err('fundacao_ano')}
          value={empresa.fundacao_ano === null ? '' : String(empresa.fundacao_ano)}
          onChange={(event) =>
            onChange('fundacao_ano', parseInteger(event.currentTarget.value.slice(0, 4)))
          }
        />
        <TextField
          name="empresa.funcionarios"
          label={EMPRESA_LABELS.funcionarios}
          inputMode="numeric"
          autoComplete="off"
          hint="Com carteira assinada, incluindo sócios que trabalham na operação."
          className="[&_input]:tabular sm:col-span-3"
          error={err('funcionarios')}
          value={empresa.funcionarios === null ? '' : String(empresa.funcionarios)}
          onChange={(event) => onChange('funcionarios', parseInteger(event.currentTarget.value))}
        />
      </Group>
    </div>
  )
}
