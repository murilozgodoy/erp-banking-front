import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BarChart } from './BarChart'
import { ShareBar } from './ShareBar'
import { TimeSeriesChart } from './TimeSeriesChart'

const dias = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']

describe('gráficos do portal', () => {
  it('série temporal: tabela acessível, legenda, zona negativa e tooltip por teclado', () => {
    render(
      <TimeSeriesChart
        title="Fluxo de caixa projetado"
        negativeZone
        marker={{ date: dias[0], label: 'Hoje' }}
        bands={[{ from: dias[1], to: dias[2], label: 'Vale', className: 'fill-negative/10' }]}
        tooltipExtra={(date) => <span>extra {date}</span>}
        series={[
          {
            key: 'saldo',
            label: 'Saldo',
            color: 'var(--color-series-1)',
            area: true,
            values: dias.map((date, i) => ({ date, value: [5000, -2000, -1000, 3000][i] })),
          },
          {
            key: 'entradas',
            label: 'Entradas',
            color: 'var(--color-series-2)',
            dashed: true,
            values: dias.map((date) => ({ date, value: 1000 })),
          },
        ]}
      />,
    )
    const chart = screen.getByRole('img', { name: 'Fluxo de caixa projetado' })
    expect(screen.getByRole('table', { name: 'Fluxo de caixa projetado' })).toBeInTheDocument()
    expect(screen.getByText('Hoje')).toBeInTheDocument()
    expect(screen.getAllByText('Entradas').length).toBeGreaterThan(0)

    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(screen.getByRole('status')).toHaveTextContent('04 nov')
    expect(screen.getByText('extra 2026-11-04')).toBeInTheDocument()
    fireEvent.keyDown(chart, { key: 'ArrowLeft' })
    fireEvent.keyDown(chart, { key: 'Enter' })
    expect(screen.getByRole('status')).toHaveTextContent('03 nov')
    fireEvent.pointerMove(chart, { clientX: 400 })
    expect(screen.getByRole('status')).toBeInTheDocument()
    fireEvent.pointerLeave(chart)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.keyDown(chart, { key: 'ArrowLeft' })
    fireEvent.blur(chart)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('série temporal vazia não quebra', () => {
    render(<TimeSeriesChart title="Vazio" series={[]} />)
    expect(screen.getByRole('img', { name: 'Vazio' })).toBeInTheDocument()
  })

  it('barras: tooltip no hover, seleção e tabela acessível', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <BarChart
        title="Recebíveis por semana"
        onSelect={onSelect}
        data={[
          { key: 's1', label: 'S45', value: 12000, detail: 'Cielo e Stone', highlight: true },
          { key: 's2', label: 'S46', value: 8000 },
        ]}
      />,
    )
    expect(screen.getByRole('table', { name: 'Recebíveis por semana' })).toHaveTextContent(
      'Cielo e Stone',
    )
    const targets = container.querySelectorAll('rect[fill="transparent"]')
    fireEvent.pointerEnter(targets[0])
    expect(screen.getByRole('status')).toHaveTextContent('S45')
    fireEvent.click(targets[0])
    expect(onSelect).toHaveBeenCalledWith('s1')
    fireEvent.pointerLeave(targets[0])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('composição agrupa além de 5 partes em "Outros"', () => {
    const shares = ['PIX', 'Crédito', 'Débito', 'Dinheiro', 'Boleto', 'Vale'].map((label, i) => ({
      key: label,
      label,
      value: 600 - i * 100,
      pct: (600 - i * 100) / 21,
    }))
    render(<ShareBar title="Formas de pagamento" shares={shares} />)
    expect(screen.getByRole('img', { name: 'Formas de pagamento' })).toBeInTheDocument()
    expect(screen.getByText('Outros')).toBeInTheDocument()
    expect(screen.queryByText('Vale')).not.toBeInTheDocument()
  })
})
