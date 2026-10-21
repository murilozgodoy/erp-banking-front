import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'
import type { AccountInput } from '@/types/api'

/** Abre uma conta; com `customerId` fixo (ficha do cliente) o campo de cliente some. */
export function OpenAccountForm({ customerId }: { customerId?: number }) {
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [customer, setCustomer] = useState(customerId ? String(customerId) : '')
  const [saldoInicial, setSaldoInicial] = useState('0')

  const open = useMutation({
    mutationFn: (input: AccountInput) => api.accounts.create(input),
    onSuccess: (account) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      navigate(`/contas/${account.id}`)
    },
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    open.mutate({ customerId: Number(customer), saldoInicial: Number(saldoInicial) })
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
          label="Saldo inicial (R$)"
          type="number"
          min={0}
          step="0.01"
          required
          value={saldoInicial}
          onChange={(event) => setSaldoInicial(event.target.value)}
          className="w-48"
        />
        <Button type="submit" loading={open.isPending}>
          Abrir conta
        </Button>
      </div>
      {open.isError && <Alert tone="error">{errorMessage(open.error)}</Alert>}
    </form>
  )
}
