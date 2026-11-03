import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { Button, ButtonLink } from './Button'
import { DataTable } from './DataTable'
import { Delta } from './Delta'
import { parseBrlInput } from '../lib/format'
import { MoneyField, SelectField, TextAreaField, TextField } from './Field'
import { simulatorHref } from './credit'
import { InsightBlock } from './InsightBlock'
import { Money } from './Money'
import { Pill } from './Pill'
import { Segmented } from './Segmented'
import { Sheet } from './Sheet'
import { StatStrip } from './StatStrip'
import { EmptyState, ErrorState, PageHeader, Panel, PanelSkeleton } from './Surface'

function MoneyHarness({ onValue }: { onValue: (value: number | null) => void }) {
  const [value, setValue] = useState<number | null>(1000)
  return (
    <MoneyField
      label="Faturamento"
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onValue(next)
      }}
    />
  )
}

describe('primitivas do portal', () => {
  it('Button mostra carregando e bloqueia; ButtonLink navega', () => {
    render(
      <MemoryRouter>
        <Button loading>Pagar</Button>
        <ButtonLink to="/app/credito" variant="credit">
          Simular
        </ButtonLink>
      </MemoryRouter>,
    )
    const button = screen.getByRole('button', { name: 'Pagar' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('link', { name: 'Simular' })).toHaveAttribute('href', '/app/credito')
  })

  it('Money lê o valor completo e colore pelo sinal', () => {
    const { rerender } = render(<Money value={-1234.5} signed size="display" />)
    expect(screen.getByText('−R$ 1.234,50')).toHaveClass('sr-only')
    rerender(<Money value={10} signed />)
    expect(screen.getByText('+R$ 10,00').parentElement).toHaveClass('text-positive')
  })

  it('Delta usa seta e sinal, e inverte o significado quando subir é ruim', () => {
    const { container, rerender } = render(<Delta value={4} context="vs. mês anterior" />)
    expect(screen.getByText('+4,0%')).toHaveClass('text-positive')
    expect(screen.getByText('vs. mês anterior')).toBeInTheDocument()
    rerender(<Delta value={4} inverse />)
    expect(screen.getByText('+4,0%')).toHaveClass('text-negative')
    rerender(<Delta value={0} />)
    expect(container.querySelector('.bg-sunken')).toBeInTheDocument()
  })

  it('Pill, PageHeader, Panel e estados vazio/erro/carregando', async () => {
    const retry = vi.fn()
    render(
      <>
        <PageHeader
          title="Vendas"
          description="Últimos 30 dias"
          actions={<button>Exportar</button>}
        />
        <Panel
          id="canais"
          title="Canais"
          description="Por origem"
          actions={<Pill tone="positive">ok</Pill>}
        >
          conteúdo
        </Panel>
        <Panel flush>sem título</Panel>
        <PanelSkeleton label="Carregando vendas…" />
        <EmptyState icon={<span />} title="Nenhuma venda" action={<button>Importar</button>}>
          Registre vendas para ver a série.
        </EmptyState>
        <ErrorState message="Servidor fora do ar." onRetry={retry} />
      </>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Vendas' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Canais' })).toHaveTextContent('conteúdo')
    expect(screen.getByRole('status', { name: 'Carregando vendas…' })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma venda')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(retry).toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Servidor fora do ar.')
  })

  it('StatStrip mostra os indicadores ou o esqueleto', () => {
    const stats = [
      { label: 'Receita 30d', value: 'R$ 182 mil', detail: '+4%' },
      { label: 'Ticket', value: 'R$ 34' },
    ]
    const { rerender } = render(<StatStrip stats={stats} />)
    expect(screen.getByText('Receita 30d')).toBeInTheDocument()
    expect(screen.getByText('+4%')).toBeInTheDocument()
    rerender(<StatStrip stats={stats} loading />)
    expect(screen.queryByText('R$ 182 mil')).not.toBeInTheDocument()
  })

  it('Segmented é um radiogroup navegável por setas', async () => {
    function Harness() {
      const [value, setValue] = useState<'d' | 's' | 'm'>('d')
      return (
        <Segmented
          label="Agrupar por"
          value={value}
          onChange={setValue}
          options={[
            { value: 'd', label: 'Dia' },
            { value: 's', label: 'Semana' },
            { value: 'm', label: 'Mês' },
          ]}
        />
      )
    }
    render(<Harness />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Semana' }))
    expect(screen.getByRole('radio', { name: 'Semana' })).toBeChecked()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Mês' })).toBeChecked()
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Mês' })).toBeChecked()
    await user.keyboard('{Enter}')
  })

  it('InsightBlock liga o insight à oferta com link para o simulador', () => {
    render(
      <MemoryRouter>
        <InsightBlock
          insight={{
            titulo: 'Caixa negativo em 18 dias',
            texto: 'Antecipe.',
            severidade: 'atencao',
          }}
          offer={{
            produto: 'ANTECIPACAO_RECEBIVEIS',
            valor: 42000,
            taxa_mensal: 2.09,
            racional: 'cobre o vale',
          }}
        />
      </MemoryRouter>,
    )
    const block = screen.getByRole('complementary', { name: 'Insight da ErpIa' })
    expect(within(block).getByText('Caixa negativo em 18 dias')).toBeInTheDocument()
    expect(within(block).getByText(/a partir de 2,09% a\.m\./)).toBeInTheDocument()
    expect(within(block).getByRole('link', { name: /Simular/ })).toHaveAttribute(
      'href',
      '/app/credito?produto=ANTECIPACAO_RECEBIVEIS&valor=42000',
    )
    expect(simulatorHref('CAPITAL_DE_GIRO')).toBe('/app/credito?produto=CAPITAL_DE_GIRO')
  })

  it('InsightBlock sem conteúdo não renderiza; só insight ou só oferta funciona', () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <InsightBlock />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
    rerender(
      <MemoryRouter>
        <InsightBlock insight={{ titulo: 'Leitura', texto: 'ok', severidade: 'info' }} />
        <InsightBlock insight={{ titulo: 'Boa', texto: 'ok', severidade: 'oportunidade' }} />
        <InsightBlock offer={{ produto: 'ALAVANCAGEM', valor: 1000, cta: 'Ver proposta' }} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /Ver proposta/ })).toBeInTheDocument()
  })

  it('campos ligam rótulo, ajuda e erro', async () => {
    const onValue = vi.fn()
    render(
      <>
        <TextField label="Razão social" required hint="Como no CNPJ" />
        <TextField label="Margem" suffix="%" error="Informe a margem" />
        <SelectField
          label="UF"
          placeholder="Selecione"
          options={[{ value: 'SP', label: 'São Paulo' }]}
          error="Escolha a UF"
        />
        <TextAreaField label="Observações" hint="Opcional" />
        <MoneyHarness onValue={onValue} />
      </>,
    )
    expect(screen.getByLabelText(/Razão social/)).toHaveAccessibleDescription('Como no CNPJ')
    expect(screen.getByLabelText('Margem')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('UF')).toHaveAccessibleDescription('Escolha a UF')
    const money = screen.getByLabelText('Faturamento')
    expect(money).toHaveValue('1.000,00')
    await userEvent.clear(money)
    await userEvent.type(money, '2500,5')
    expect(onValue).toHaveBeenLastCalledWith(2500.5)
    await userEvent.tab()
    expect(money).toHaveValue('2.500,50')
    expect(parseBrlInput('')).toBeNull()
    expect(parseBrlInput('R$ 1.234,56')).toBe(1234.56)
  })
})

describe('layout em telas estreitas e de toque', () => {
  it('Panel pode encolher num grid (min-w-0) e os alvos sobem para 44 px no toque', () => {
    render(
      <Panel title="Extrato" id="extrato">
        <Button size="sm">Pagar</Button>
        <Segmented
          label="Período"
          value="7"
          options={[{ value: '7', label: '7 dias' }]}
          onChange={() => {}}
        />
      </Panel>,
    )
    expect(screen.getByRole('region', { name: 'Extrato' })).toHaveClass('min-w-0')
    expect(screen.getByRole('button', { name: 'Pagar' })).toHaveClass('pointer-coarse:h-11')
    expect(screen.getByRole('radio', { name: '7 dias' })).toHaveClass('pointer-coarse:h-11')
  })
})

describe('DataTable', () => {
  const rows = [
    { id: 1, nome: 'Farinha', valor: 30 },
    { id: 2, nome: 'Açúcar', valor: 10 },
    { id: 3, nome: 'Manteiga', valor: 20 },
  ]
  const columns = [
    {
      key: 'nome',
      header: 'Item',
      cell: (r: (typeof rows)[0]) => r.nome,
      sort: (r: (typeof rows)[0]) => r.nome,
    },
    {
      key: 'valor',
      header: 'Valor',
      align: 'right' as const,
      hideBelow: 'sm' as const,
      cell: (r: (typeof rows)[0]) => r.valor,
      sort: (r: (typeof rows)[0]) => r.valor,
    },
    { key: 'acao', header: 'Ação', cell: () => '—' },
  ]

  it('rola dentro do próprio contêiner, que contém o texto sr-only das células', () => {
    render(<DataTable caption="Itens" columns={columns} rows={rows} rowKey={(r) => r.id} />)
    const scroller = screen.getByRole('table').parentElement!
    expect(scroller).toHaveClass('relative', 'overflow-x-auto')
  })

  it('ordena pelos cabeçalhos com aria-sort', async () => {
    render(<DataTable caption="Itens" columns={columns} rows={rows} rowKey={(r) => r.id} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Valor' }))
    expect(screen.getByRole('columnheader', { name: 'Valor' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Farinha')
    await user.click(screen.getByRole('button', { name: 'Valor' }))
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Açúcar')
    await user.click(screen.getByRole('button', { name: 'Item' }))
    expect(screen.getByRole('columnheader', { name: 'Item' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  })

  it('seleciona linhas e todas as selecionáveis; mostra o vazio', async () => {
    const onToggle = vi.fn()
    const onToggleAll = vi.fn()
    const { rerender } = render(
      <DataTable
        caption="Itens"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        initialSort={{ key: 'valor', direction: 'asc' }}
        rowClassName={(r) => (r.valor > 25 ? 'destaque' : undefined)}
        selection={{
          selected: new Set([1, 3]),
          onToggle,
          onToggleAll,
          isSelectable: (r) => r.id !== 2,
        }}
      />,
    )
    expect(screen.getByRole('checkbox', { name: 'Selecionar todos' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Selecionar 2' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar 1' }))
    expect(onToggle).toHaveBeenCalledWith(1)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar todos' }))
    expect(onToggleAll).toHaveBeenCalledWith([1, 3])
    rerender(
      <DataTable
        caption="Itens"
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        empty={<p>Nada aqui</p>}
      />,
    )
    expect(screen.getByText('Nada aqui')).toBeInTheDocument()
  })
})

describe('Sheet', () => {
  it('abre como diálogo, prende o foco, fecha com Esc e pelo botão', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Sheet
        open
        onClose={onClose}
        title="Pagar boleto"
        description="Conta corrente"
        footer={<button>Confirmar</button>}
      >
        <input aria-label="Código" />
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Pagar boleto' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const user = userEvent.setup()
    // O foco inicial vai para o primeiro campo no próximo frame.
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Código' })).toHaveFocus())
    screen.getByRole('button', { name: 'Confirmar' }).focus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    rerender(
      <Sheet open={false} onClose={onClose} title="Pagar boleto">
        x
      </Sheet>,
    )
  })

  it('um novo onClose do pai não tira o foco do campo; Esc usa o mais recente e o foco volta ao gatilho', async () => {
    const first = vi.fn()
    const latest = vi.fn()
    const user = userEvent.setup()
    const ui = (open: boolean, onClose: () => void) => (
      <>
        <button>Abrir</button>
        <Sheet open={open} onClose={onClose} title="Antecipar">
          <input aria-label="Valor" />
          <input aria-label="Prazo" />
        </Sheet>
      </>
    )
    const { rerender } = render(ui(false, first))
    screen.getByRole('button', { name: 'Abrir' }).focus()
    rerender(ui(true, first))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Valor' })).toHaveFocus())
    await user.click(screen.getByRole('textbox', { name: 'Prazo' }))
    rerender(ui(true, latest))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(screen.getByRole('textbox', { name: 'Prazo' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(latest).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    rerender(ui(false, latest))
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })
})
