import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Can } from '@/components/auth/Can'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { InputField } from '@/components/ui/Field'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'
import { formatCurrency, formatDateTime, formatPercent } from '@/lib/format'
import type { AnamnesisInput, Customer } from '@/types/api'

/** Anamnese financeira (dívidas e comprometimento da renda), usada no cálculo do score. */
export function AnamnesisCard({ customer }: { customer: Customer }) {
  const { anamnesis } = customer
  return (
    <Card title="Anamnese financeira" description="Dívidas e comprometimento da renda">
      <div className="space-y-4">
        {anamnesis ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Dívidas ativas</dt>
              <dd className="text-lg font-semibold">{formatCurrency(anamnesis.dividas_ativas)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Comprometimento da renda</dt>
              <dd className="text-lg font-semibold">
                {formatPercent(anamnesis.comprometimento_renda, 1)}
              </dd>
            </div>
            <p className="col-span-2 text-xs text-slate-500">
              Atualizada em {formatDateTime(anamnesis.updated_at)}
            </p>
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Anamnese ainda não registrada.</p>
        )}
        <Can permission="write:customers">
          <AnamnesisForm customer={customer} />
        </Can>
      </div>
    </Card>
  )
}

function AnamnesisForm({ customer }: { customer: Customer }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [dividas, setDividas] = useState(String(customer.anamnesis?.dividas_ativas ?? ''))
  const [comprometimento, setComprometimento] = useState(
    String(customer.anamnesis?.comprometimento_renda ?? ''),
  )

  const save = useMutation({
    mutationFn: (input: AnamnesisInput) => api.customers.saveAnamnesis(customer.id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', customer.id] }),
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    save.mutate({
      dividas_ativas: Number(dividas),
      comprometimento_renda: Number(comprometimento),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField
          label="Dívidas ativas (R$)"
          type="number"
          min={0}
          step="0.01"
          required
          value={dividas}
          onChange={(event) => setDividas(event.target.value)}
        />
        <InputField
          label="Comprometimento da renda (%)"
          type="number"
          min={0}
          max={100}
          step="0.1"
          required
          value={comprometimento}
          onChange={(event) => setComprometimento(event.target.value)}
        />
      </div>
      {save.isError && <Alert tone="error">{errorMessage(save.error)}</Alert>}
      {save.isSuccess && <Alert tone="success">Anamnese salva.</Alert>}
      <Button type="submit" variant="secondary" loading={save.isPending}>
        Salvar anamnese
      </Button>
    </form>
  )
}
