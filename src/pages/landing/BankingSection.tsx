import { m } from 'motion/react'

import { Faisca, Marca } from '@/components/brand/Logo'

import { BarcodeIcon, CalendarIcon, PixIcon } from './icons'
import { container, ease } from './styles'

const FEATURES = [
  {
    icon: PixIcon,
    titulo: 'PIX',
    texto:
      'Envie e receba por chave ou QR Code, agende transferências e baixe o comprovante na hora.',
  },
  {
    icon: BarcodeIcon,
    titulo: 'Boletos',
    texto:
      'Pague pelo código de barras e emita cobranças. Quando o cliente paga, a baixa entra sozinha.',
  },
  {
    icon: CalendarIcon,
    titulo: 'Agenda de pagamentos',
    texto:
      'Contas a pagar e a receber na mesma linha do tempo, com aviso antes de cada vencimento.',
  },
]

const AGENDA = [
  {
    dia: 'Seg 3',
    item: 'Moinho Sul · farinha',
    meio: 'Boleto',
    valor: 'R$ 8.420,00',
    status: 'Pago',
  },
  {
    dia: 'Qua 5',
    item: 'Laticínios Serra',
    meio: 'Boleto',
    valor: 'R$ 5.360,00',
    status: 'Agendado',
  },
  {
    dia: 'Qui 6',
    item: 'Folha · 9 pessoas',
    meio: 'PIX',
    valor: 'R$ 21.900,00',
    status: 'Agendado',
  },
  {
    dia: 'Sex 7',
    item: 'Embalagens Vale',
    meio: 'Boleto',
    valor: 'R$ 3.910,00',
    status: 'Sem saldo',
  },
]

export function BankingSection() {
  return (
    <section
      id="banking"
      aria-labelledby="banking-title"
      className="bg-rail py-20 text-rail-ink sm:py-28"
    >
      <div className={`${container} grid gap-12 lg:grid-cols-12 lg:gap-10`}>
        <div className="lg:col-span-5">
          <h2
            id="banking-title"
            className="text-[clamp(1.875rem,1.2rem+2.6vw,2.875rem)] leading-[1.08] font-semibold tracking-[-0.028em]"
          >
            O banco da empresa, dentro do ERP.
          </h2>
          <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-rail-muted">
            Pague, receba e organize a semana sem trocar de sistema. Cada pagamento já entra no
            fluxo de caixa, e o saldo que você vê é o mesmo que a <Marca /> usa para projetar.
          </p>
          <dl className="mt-10 divide-y divide-rail-raised border-y border-rail-raised">
            {FEATURES.map(({ icon: Icon, titulo, texto }) => (
              <div key={titulo} className="flex gap-4 py-5">
                <Icon className="mt-0.5 size-5 shrink-0 text-rail-muted" />
                <div>
                  <dt className="font-medium">{titulo}</dt>
                  <dd className="mt-1 text-rail-muted">{texto}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <m.figure
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease }}
          className="m-0 lg:col-span-7 lg:col-start-6 lg:pl-6"
        >
          <figcaption className="sr-only">
            Exemplo de agenda de pagamentos da semana: o saldo cobre três dos quatro pagamentos e a
            ErpIa sugere capital de giro para o último.
          </figcaption>
          <div
            aria-hidden
            className="rounded-panel border border-rail-raised bg-rail-raised p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">Agenda desta semana</p>
              <p className="tabular text-sm text-rail-muted">Saldo R$ 29.500,00</p>
            </div>
            <ul className="mt-4 divide-y divide-rail">
              {AGENDA.map((row) => (
                <li
                  key={row.item}
                  className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 py-3 text-sm"
                >
                  <span className="tabular text-rail-muted">{row.dia}</span>
                  <span className="truncate">{row.item}</span>
                  <span className="tabular text-right">{row.valor}</span>
                  <span className="col-start-2 text-xs text-rail-muted">{row.meio}</span>
                  <span
                    className={
                      row.status === 'Sem saldo'
                        ? 'text-right text-xs font-medium text-credit'
                        : 'text-right text-xs text-rail-muted'
                    }
                  >
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-control border border-credit/40 p-4">
              <p className="flex items-center gap-1.5 text-sm font-medium text-credit">
                <Faisca label={null} />
                Saldo cobre 3 de 4 pagamentos
              </p>
              <p className="mt-1.5 text-sm text-rail-muted">
                Pagar Embalagens Vale com capital de giro custa cerca de R$ 86 no mês e evita multa
                e juros de atraso. As vendas de sábado repõem o saldo.
              </p>
            </div>
          </div>
        </m.figure>
      </div>
    </section>
  )
}
