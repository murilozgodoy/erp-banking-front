import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { RequirePermission } from '@/components/auth/RequirePermission'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { Card } from '@/components/ui/Card'
import { InputField } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'
import { onlyDigits } from '@/lib/format'
import type { CustomerInput } from '@/types/api'

const emptyForm = {
  nome: '',
  cpf: '',
  email: '',
  telefone: '',
  rua: '',
  numero: '',
  cidade: '',
  estado: '',
  cep: '',
  renda_mensal: '',
  patrimonio: '',
  ocupacao: '',
}

type FormState = typeof emptyForm

/** Converte o formulário (strings) no payload da Onboarding API. */
function toCustomerInput(form: FormState): CustomerInput {
  return {
    nome: form.nome.trim(),
    cpf: onlyDigits(form.cpf),
    email: form.email.trim(),
    telefone: onlyDigits(form.telefone),
    address: {
      rua: form.rua.trim(),
      numero: form.numero.trim(),
      cidade: form.cidade.trim(),
      estado: form.estado.trim().toUpperCase(),
      cep: onlyDigits(form.cep),
    },
    financial_profile: {
      renda_mensal: Number(form.renda_mensal),
      patrimonio: Number(form.patrimonio),
      ocupacao: form.ocupacao.trim(),
    },
  }
}

export function NewCustomerPage() {
  return (
    <RequirePermission permission="write:customers">
      <NewCustomerForm />
    </RequirePermission>
  )
}

function NewCustomerForm() {
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(emptyForm)

  const create = useMutation({
    mutationFn: (input: CustomerInput) => api.customers.create(input),
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      navigate(`/clientes/${customer.id}`)
    },
  })

  const field = (name: keyof FormState) => ({
    name,
    value: form[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [name]: event.target.value })),
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    create.mutate(toCustomerInput(form))
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Novo cliente"
        description="Cadastro no Onboarding com endereço e perfil financeiro"
      />

      <form onSubmit={submit} className="space-y-6">
        <Card title="Dados pessoais">
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="Nome completo" required maxLength={120} {...field('nome')} />
            <InputField
              label="CPF"
              required
              inputMode="numeric"
              pattern="\d{3}\.?\d{3}\.?\d{3}-?\d{2}"
              title="11 dígitos, com ou sem pontuação"
              placeholder="000.000.000-00"
              {...field('cpf')}
            />
            <InputField label="E-mail" type="email" required {...field('email')} />
            <InputField
              label="Telefone"
              type="tel"
              required
              minLength={8}
              maxLength={20}
              placeholder="(11) 99999-9999"
              {...field('telefone')}
            />
          </div>
        </Card>

        <Card title="Endereço">
          <div className="grid gap-4 sm:grid-cols-6">
            <InputField label="Rua" required className="sm:col-span-4" {...field('rua')} />
            <InputField label="Número" required className="sm:col-span-2" {...field('numero')} />
            <InputField label="Cidade" required className="sm:col-span-3" {...field('cidade')} />
            <InputField
              label="UF"
              required
              maxLength={2}
              pattern="[A-Za-z]{2}"
              title="Sigla do estado, ex.: SP"
              className="sm:col-span-1"
              {...field('estado')}
            />
            <InputField
              label="CEP"
              required
              inputMode="numeric"
              pattern="\d{5}-?\d{3}"
              title="8 dígitos"
              className="sm:col-span-2"
              {...field('cep')}
            />
          </div>
        </Card>

        <Card title="Perfil financeiro" description="Base para o cálculo do score de crédito">
          <div className="grid gap-4 sm:grid-cols-3">
            <InputField
              label="Renda mensal (R$)"
              type="number"
              min={0}
              step="0.01"
              required
              {...field('renda_mensal')}
            />
            <InputField
              label="Patrimônio (R$)"
              type="number"
              min={0}
              step="0.01"
              required
              {...field('patrimonio')}
            />
            <InputField
              label="Ocupação"
              required
              maxLength={60}
              placeholder="CLT, PJ, autônomo…"
              {...field('ocupacao')}
            />
          </div>
        </Card>

        {create.isError && <Alert tone="error">{errorMessage(create.error)}</Alert>}

        <div className="flex gap-3">
          <Button type="submit" loading={create.isPending}>
            Cadastrar cliente
          </Button>
          <ButtonLink to="/clientes" variant="secondary">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </section>
  )
}
