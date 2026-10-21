import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'
import { formatCurrency, formatPercent } from '@/lib/format'
import type { CreditRequest, CreditRequestInput } from '@/types/api'

/**
 * Solicita crédito. A Transactions API consulta o score vigente na Credit Score API
 * (repassando o token do usuário) e decide: risco baixo aprova, médio vai para revisão.
 */
export function CreditRequestForm({ customerId }: { customerId?: number }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [customer, setCustomer] = useState(customerId ? String(customerId) : '')
  const [valor, setValor] = useState('')
  const [prazo, setPrazo] = useState('12')

  const request = useMutation({
    mutationFn: (input: CreditRequestInput) => api.credits.request(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['credits'] }),
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    request.mutate({
      customerId: Number(customer),
      valor: Number(valor),
      prazoMeses: Number(prazo),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {customerId === undefined && (
          <InputField
            label="ID do cliente"
            type="number"
            min={1}
            required
            value={customer}
            onChange={(event) => setCustomer(event.target.value)}
            className="w-40"
          />
        )}
        <InputField
          label="Valor solicitado (R$)"
          type="number"
          min="0.01"
          step="0.01"
          required
          value={valor}
          onChange={(event) => setValor(event.target.value)}
          className="w-48"
        />
        <InputField
          label="Prazo (meses)"
          type="number"
          min={1}
          max={360}
          required
          value={prazo}
          onChange={(event) => setPrazo(event.target.value)}
          className="w-36"
        />
        <Button type="submit" loading={request.isPending}>
          Solicitar crédito
        </Button>
      </div>
      {request.isError && <Alert tone="error">{errorMessage(request.error)}</Alert>}
      {request.isSuccess && <CreditOutcome credit={request.data} />}
    </form>
  )
}

function CreditOutcome({ credit }: { credit: CreditRequest }) {
  if (credit.status === 'APROVADO') {
    return (
      <Alert tone="success" title="Crédito aprovado">
        {formatCurrency(credit.valorAprovado)} em {credit.prazoMeses} meses, com taxa de{' '}
        {formatPercent(credit.taxaJuros * 100)} a.m.
      </Alert>
    )
  }
  if (credit.status === 'REVISAO') {
    return (
      <Alert tone="warning" title="Pedido enviado para revisão manual">
        {credit.motivo}
      </Alert>
    )
  }
  return (
    <Alert tone="error" title="Crédito negado">
      {credit.motivo}
    </Alert>
  )
}
