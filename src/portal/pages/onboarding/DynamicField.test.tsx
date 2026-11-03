import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { CampoTemplate, RespostaValor } from '../../types'
import { DynamicField } from './DynamicField'

function Harness({
  campo,
  initial = null,
  onValue,
  error,
}: {
  campo: CampoTemplate
  initial?: RespostaValor
  onValue: (value: RespostaValor) => void
  error?: string
}) {
  const [value, setValue] = useState<RespostaValor>(initial)
  return (
    <DynamicField
      campo={campo}
      value={value}
      required={Boolean(campo.obrigatorio)}
      error={error}
      onChange={(next) => {
        setValue(next)
        onValue(next)
      }}
    />
  )
}

function renderField(campo: CampoTemplate, initial: RespostaValor = null, error?: string) {
  const onValue = vi.fn()
  render(<Harness campo={campo} initial={initial} onValue={onValue} error={error} />)
  return { onValue, user: userEvent.setup() }
}

describe('DynamicField: um controle por tipo do template', () => {
  it('currency usa o campo de reais', async () => {
    const { onValue, user } = renderField({
      id: 'faturamento_mensal',
      label: 'Faturamento médio mensal',
      tipo: 'currency',
      obrigatorio: true,
      min: 0,
      ajuda: 'Média dos últimos 6 meses.',
    })
    const input = screen.getByRole('textbox', { name: /Faturamento médio mensal/ })
    expect(input).toBeRequired()
    expect(screen.getByText('R$')).toBeInTheDocument()
    expect(screen.getByText('Média dos últimos 6 meses.')).toBeInTheDocument()
    await user.type(input, '182000')
    expect(onValue).toHaveBeenLastCalledWith(182000)
  })

  it('percent aceita vírgula, mostra % e o intervalo 0–100', async () => {
    const { onValue, user } = renderField({ id: 'p', label: 'Margem bruta', tipo: 'percent' })
    const input = screen.getByRole('textbox', { name: 'Margem bruta' })
    expect(screen.getByText('%')).toBeInTheDocument()
    expect(screen.getByText('De 0 a 100.')).toBeInTheDocument()
    expect(input).toHaveAttribute('inputmode', 'decimal')
    await user.type(input, '12,5')
    expect(input).toHaveValue('12,5')
    expect(onValue).toHaveBeenLastCalledWith(12.5)
    await user.clear(input)
    expect(onValue).toHaveBeenLastCalledWith(null)
  })

  it('integer só aceita dígitos e envia número inteiro', async () => {
    const { onValue, user } = renderField(
      { id: 'mes', label: 'Mês de colheita', tipo: 'integer', min: 1, max: 12 },
      3,
    )
    const input = screen.getByRole('textbox', { name: 'Mês de colheita' })
    expect(input).toHaveValue('3')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getByText('De 1 a 12.')).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, '1,5x')
    expect(input).toHaveValue('15')
    expect(onValue).toHaveBeenLastCalledWith(15)
  })

  it('number aceita decimais e mostra o limite', async () => {
    const { onValue, user } = renderField({
      id: 'n',
      label: 'Parcelamento',
      tipo: 'number',
      max: 24,
    })
    expect(screen.getByText('Até 24.')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Parcelamento' }), '2,5')
    expect(onValue).toHaveBeenLastCalledWith(2.5)
  })

  it('select lista as opções do template', async () => {
    const { onValue, user } = renderField({
      id: 'sazonalidade',
      label: 'Sazonalidade',
      tipo: 'select',
      opcoes: ['Baixa', 'Média', 'Alta'],
    })
    const select = screen.getByRole('combobox', { name: 'Sazonalidade' })
    await user.selectOptions(select, 'Alta')
    expect(onValue).toHaveBeenLastCalledWith('Alta')
    await user.selectOptions(select, '')
    expect(onValue).toHaveBeenLastCalledWith(null)
  })

  it('multiselect vira chips marcáveis', async () => {
    const { onValue, user } = renderField(
      { id: 'canais', label: 'Canais', tipo: 'multiselect', opcoes: ['Loja', 'Site', 'App'] },
      ['Loja'],
    )
    const grupo = screen.getByRole('group', { name: 'Canais' })
    expect(grupo).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Loja' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Site' }))
    expect(onValue).toHaveBeenLastCalledWith(['Loja', 'Site'])
    await user.click(screen.getByRole('checkbox', { name: 'Loja' }))
    expect(onValue).toHaveBeenLastCalledWith(['Site'])
  })

  it('boolean é um par Sim/Não com semântica de rádio', async () => {
    const { onValue, user } = renderField(
      { id: 'possui_estoque', label: 'Trabalha com estoque?', tipo: 'boolean', obrigatorio: true },
      null,
      'Campo obrigatório.',
    )
    const sim = screen.getByRole('radio', { name: 'Sim' })
    expect(sim).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('group', { name: /Trabalha com estoque/ })).toHaveAccessibleDescription(
      'Campo obrigatório.',
    )
    await user.click(sim)
    expect(onValue).toHaveBeenLastCalledWith(true)
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Não' })).toBeChecked()
    expect(onValue).toHaveBeenLastCalledWith(false)
  })

  it('text é um campo livre, com erro ligado por aria-describedby', async () => {
    const { onValue, user } = renderField(
      { id: 'cultura', label: 'Cultura principal', tipo: 'text' },
      null,
      'Texto inválido.',
    )
    const input = screen.getByRole('textbox', { name: 'Cultura principal' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Texto inválido.')
    await user.type(input, 'Soja')
    expect(onValue).toHaveBeenLastCalledWith('Soja')
  })
})
