import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ArrowRight, Lock, Minus, Plus } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useId, useState, type FormEvent } from 'react'

import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/errors'

import { usePortalApi } from '../../api'
import { portalKeys } from '../../layout/queries'
import { money } from '../../lib/format'
import { semPermissaoTexto } from '../../team/permissions'
import { useMembro } from '../../team/useMembro'
import type {
  ErpApiError,
  InventoryItem,
  InventoryMovementInput,
  InventoryMovementResult,
  InventoryMovementType,
  InventoryReport,
} from '../../types'
import { Button } from '../../ui/Button'
import { FieldShell, MoneyField, TextField } from '../../ui/Field'
import { Pill } from '../../ui/Pill'
import { Segmented } from '../../ui/Segmented'
import { Sheet } from '../../ui/Sheet'

import { MovementHistory } from './MovementHistory'
import {
  custoMedio,
  erroQuantidade,
  inventoryKey,
  MAX_MOTIVO,
  parseQuantidade,
  saldoFinal,
  situacaoMinimo,
  TIPO_INFO,
  unidades,
  type SituacaoMinimo,
} from './movement'

export type Aba = 'movimentar' | 'historico'

const TIPOS: InventoryMovementType[] = ['ENTRADA', 'SAIDA', 'AJUSTE']

const SITUACAO: Record<SituacaoMinimo, { tone: 'positive' | 'negative'; label: string }> = {
  abaixo: { tone: 'negative', label: 'Abaixo do mínimo' },
  'no-minimo': { tone: 'positive', label: 'No mínimo' },
  acima: { tone: 'positive', label: 'Acima do mínimo' },
}

function SituacaoPill({ quantidade, minimo }: { quantidade: number; minimo: number }) {
  const situacao = SITUACAO[situacaoMinimo(quantidade, minimo)]
  return <Pill tone={situacao.tone}>{situacao.label}</Pill>
}

/** "12 → 30 un.": o antes discreto, o depois em destaque. */
function DeAte({ de, ate }: { de: string; ate: string | null }) {
  return (
    <span className="tabular inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-ink-muted">{de}</span>
      <ArrowRight aria-label="para" className="size-3.5 text-ink-faint" />
      <span className="font-semibold text-ink">{ate ?? '—'}</span>
    </span>
  )
}

interface ErroServidor {
  campos: Partial<Record<'quantidade' | 'motivo' | 'custo_unitario', string>>
  mensagem?: string
}

function erroDoServidor(error: unknown): ErroServidor {
  if (!isAxiosError(error) || !error.response) return { campos: {}, mensagem: errorMessage(error) }
  const body = (error.response.data ?? {}) as Partial<ErpApiError>
  switch (body.error) {
    case 'ESTOQUE_INSUFICIENTE':
      return {
        campos: {
          quantidade:
            typeof body.disponivel === 'number'
              ? `Disponível: ${unidades(body.disponivel)}`
              : 'A saída é maior que o estoque disponível.',
        },
      }
    case 'ITEM_NAO_ENCONTRADO':
      return {
        campos: {},
        mensagem:
          'Este item não está mais no estoque da empresa. Feche e atualize a lista para conferir.',
      }
    case 'SEM_PERMISSAO':
      return { campos: {}, mensagem: semPermissaoTexto('gerenciar_estoque') }
    case 'validation_failed': {
      const { quantidade, motivo, custo_unitario } = body.campos ?? {}
      const campos = { quantidade, motivo, custo_unitario }
      const algum = Object.values(campos).some(Boolean)
      return {
        campos,
        mensagem: algum
          ? undefined
          : (body.campos?.tipo ?? body.message ?? 'Revise os campos e tente de novo.'),
      }
    }
    default:
      return { campos: {}, mensagem: errorMessage(error) }
  }
}

function QuantidadeField({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
}) {
  const atual = parseQuantidade(value) ?? 0
  const passo = (delta: number) => onChange(String(Math.max(0, atual + delta)))
  const stepper =
    'grid size-10 shrink-0 place-items-center rounded-control border border-line-strong bg-surface text-ink-muted transition-colors duration-150 hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:size-11'
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={stepper}
            aria-label="Diminuir 1"
            disabled={atual <= 0}
            onClick={() => passo(-1)}
          >
            <Minus aria-hidden className="size-4" />
          </button>
          <div className="relative min-w-0 flex-1">
            <input
              id={id}
              data-autofocus
              inputMode="numeric"
              autoComplete="off"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              value={value}
              onChange={(event) => onChange(event.currentTarget.value.replace(/[^\d]/g, ''))}
              className={cn(
                'tabular h-10 w-full rounded-control border border-line-strong bg-surface pr-12 pl-3 text-right text-base font-medium text-ink transition-[border-color,box-shadow] duration-150 outline-none',
                'hover:border-ink-faint focus:border-accent focus:ring-3 focus:ring-accent/20',
                'aria-[invalid=true]:border-negative aria-[invalid=true]:focus:ring-negative/20',
              )}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">
              un.
            </span>
          </div>
          <button
            type="button"
            className={stepper}
            aria-label="Aumentar 1"
            onClick={() => passo(1)}
          >
            <Plus aria-hidden className="size-4" />
          </button>
        </div>
      )}
    </FieldShell>
  )
}

/** Marca de sucesso: o traço do check se desenha em 220 ms (instantâneo com "reduzir movimento"). */
function CheckDesenhado() {
  const reduce = useReducedMotion()
  return (
    <span className="grid size-12 place-items-center rounded-full bg-positive-soft text-positive">
      <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
        <motion.path
          d="M5 12.5 10 17.5 19 7"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
    </span>
  )
}

function Confirmacao({ resultado }: { resultado: InventoryMovementResult }) {
  const { movimento, item } = resultado
  const custoMudou = movimento.custo_unitario !== null
  return (
    <div role="status" className="flex flex-col items-start gap-4 py-2">
      <CheckDesenhado />
      <div>
        <p className="text-base font-semibold text-ink">{TIPO_INFO[movimento.tipo].feito}</p>
        <p className="mt-1 text-sm text-ink-muted">
          {item.nome} agora tem {unidades(movimento.quantidade_final)} em estoque.
        </p>
      </div>
      <dl className="w-full divide-y divide-line rounded-control border border-line text-sm">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-ink-muted">Saldo</dt>
          <dd>
            <DeAte
              de={unidades(movimento.quantidade_anterior)}
              ate={unidades(movimento.quantidade_final)}
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-ink-muted">Mínimo {unidades(item.minimo)}</dt>
          <dd>
            <SituacaoPill quantidade={item.quantidade} minimo={item.minimo} />
          </dd>
        </div>
        {custoMudou && (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-ink-muted">Custo médio</dt>
            <dd className="tabular font-semibold text-ink">{money(item.custo_unitario)}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

interface FormProps {
  item: InventoryItem
  formId: string
  tipo: InventoryMovementType
  onTipo: (tipo: InventoryMovementType) => void
  onSubmit: (input: InventoryMovementInput) => void
  erroServidor: ErroServidor | null
  limparErro: () => void
}

function MovementForm({
  item,
  formId,
  tipo,
  onTipo,
  onSubmit,
  erroServidor,
  limparErro,
}: FormProps) {
  const [texto, setTexto] = useState('')
  const [custo, setCusto] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')
  const [tentou, setTentou] = useState(false)

  const quantidade = parseQuantidade(texto)
  const erroQtd = erroQuantidade(tipo, quantidade, item.quantidade)
  // Campo vazio só reclama depois de tentar enviar; o resto (ex.: saída acima do saldo), na hora.
  const mostrarErroQtd = erroQtd && (tentou || quantidade !== null) ? erroQtd : undefined
  const erroCusto =
    tipo === 'ENTRADA' && custo !== null && !(custo > 0)
      ? 'Informe um custo maior que zero.'
      : undefined
  const final = quantidade === null ? null : saldoFinal(tipo, item.quantidade, quantidade)
  const previa = final !== null && final >= 0 ? final : null
  const novoCusto =
    tipo === 'ENTRADA' && quantidade && custo && custo > 0
      ? custoMedio(item.quantidade, item.custo_unitario, quantidade, custo)
      : null

  const mudou = () => {
    if (erroServidor) limparErro()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTentou(true)
    if (erroQtd || erroCusto || quantidade === null) return
    const input: InventoryMovementInput = { tipo, quantidade }
    if (motivo.trim()) input.motivo = motivo.trim()
    if (tipo === 'ENTRADA' && custo !== null) input.custo_unitario = custo
    onSubmit(input)
  }

  const restante = MAX_MOTIVO - motivo.length

  return (
    <form id={formId} noValidate onSubmit={submit} className="space-y-5">
      <div className="flex flex-col gap-1.5">
        <span aria-hidden className="text-sm font-medium text-ink">
          Tipo
        </span>
        <Segmented<InventoryMovementType>
          label="Tipo"
          value={tipo}
          onChange={(value) => {
            onTipo(value)
            mudou()
          }}
          options={TIPOS.map((value) => ({ value, label: TIPO_INFO[value].label }))}
          className="w-full [&>button]:flex-1"
        />
      </div>

      <QuantidadeField
        label={TIPO_INFO[tipo].campo}
        value={texto}
        onChange={(value) => {
          setTexto(value)
          mudou()
        }}
        error={erroServidor?.campos.quantidade ?? mostrarErroQtd}
        hint={
          tipo === 'AJUSTE'
            ? `O saldo passa a ser o que você contou (hoje, ${unidades(item.quantidade)})`
            : tipo === 'SAIDA'
              ? `Disponível: ${unidades(item.quantidade)}`
              : undefined
        }
      />

      {tipo === 'ENTRADA' && (
        <MoneyField
          label="Custo unitário"
          value={custo}
          onValueChange={(value) => {
            setCusto(value)
            mudou()
          }}
          hint={`Opcional. Atualiza o custo médio, hoje ${money(item.custo_unitario)}.`}
          error={erroServidor?.campos.custo_unitario ?? erroCusto}
        />
      )}

      <TextField
        label="Motivo"
        value={motivo}
        maxLength={MAX_MOTIVO}
        placeholder={
          tipo === 'ENTRADA'
            ? 'Ex.: nota fiscal 4512'
            : tipo === 'SAIDA'
              ? 'Ex.: avaria, consumo interno'
              : 'Ex.: contagem mensal'
        }
        onChange={(event) => {
          setMotivo(event.currentTarget.value)
          mudou()
        }}
        error={erroServidor?.campos.motivo}
        hint={
          restante <= 40 ? (
            <span className={cn('tabular', restante <= 10 && 'font-medium text-warning')}>
              {motivo.length}/{MAX_MOTIVO} caracteres
            </span>
          ) : (
            'Opcional. Aparece no histórico do item.'
          )
        }
      />

      <section
        aria-label="Prévia do saldo"
        aria-live="polite"
        className="rounded-control bg-sunken px-4 py-3"
      >
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Saldo</dt>
            <dd>
              <DeAte
                de={unidades(item.quantidade)}
                ate={previa === null ? null : unidades(previa)}
              />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Mínimo {unidades(item.minimo)}</dt>
            <dd>
              {previa === null ? (
                <span className="text-ink-faint">—</span>
              ) : (
                <SituacaoPill quantidade={previa} minimo={item.minimo} />
              )}
            </dd>
          </div>
          {novoCusto !== null && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-muted">Custo médio</dt>
              <dd>
                <DeAte de={money(item.custo_unitario)} ate={money(novoCusto)} />
              </dd>
            </div>
          )}
        </dl>
      </section>

      {erroServidor?.mensagem && (
        <p role="alert" className="rounded-control bg-negative-soft px-3 py-2.5 text-sm text-ink">
          {erroServidor.mensagem}
        </p>
      )}
    </form>
  )
}

function Tabs({ aba, onAba }: { aba: Aba; onAba: (aba: Aba) => void }) {
  const tabs: { value: Aba; label: string }[] = [
    { value: 'movimentar', label: 'Movimentar' },
    { value: 'historico', label: 'Histórico' },
  ]
  return (
    <div
      role="tablist"
      aria-label="Seções do item"
      className="-mx-6 -mt-5 mb-5 flex gap-1 border-b border-line px-5"
    >
      {tabs.map((tab) => {
        const active = tab.value === aba
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onAba(tab.value)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
              event.preventDefault()
              onAba(aba === 'movimentar' ? 'historico' : 'movimentar')
              const list = event.currentTarget.parentElement
              requestAnimationFrame(() =>
                list?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus(),
              )
            }}
            className={cn(
              'relative h-11 px-2 text-sm font-medium transition-colors duration-150',
              active ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

interface MovementSheetProps {
  item: InventoryItem | null
  open: boolean
  aba: Aba
  onAba: (aba: Aba) => void
  onClose: () => void
}

/**
 * Movimentar um item (entrada, saída ou ajuste) com a prévia do saldo, e o histórico dele.
 * Sem `gerenciar_estoque`, abre só no histórico.
 */
export function MovementSheet({ item, open, aba, onAba, onClose }: MovementSheetProps) {
  const api = usePortalApi()
  const queryClient = useQueryClient()
  const { pode } = useMembro()
  const podeMovimentar = pode('gerenciar_estoque')
  const formId = useId()
  const [tipo, setTipo] = useState<InventoryMovementType>('ENTRADA')
  const [rodada, setRodada] = useState(0)
  const [erroServidor, setErroServidor] = useState<ErroServidor | null>(null)
  const [resultado, setResultado] = useState<InventoryMovementResult | null>(null)
  const [aberto, setAberto] = useState<number | null>(null)

  // Outro item (ou reaberto): começa do zero.
  const chave = open && item ? item.id : null
  if (chave !== aberto) {
    setAberto(chave)
    if (chave !== null) {
      setTipo('ENTRADA')
      setErroServidor(null)
      setResultado(null)
      setRodada((n) => n + 1)
    }
  }

  const mutation = useMutation({
    mutationFn: (input: InventoryMovementInput) => api.erp.moveInventory(item?.id ?? 0, input),
    onSuccess: (resposta) => {
      setResultado(resposta)
      // A linha muda na hora; indicadores, pendências e o selo do menu vêm do refetch.
      queryClient.setQueryData<InventoryReport>(inventoryKey, (report) =>
        report
          ? (() => {
              const itens = report.itens.map((i) => (i.id === resposta.item.id ? resposta.item : i))
              return {
                ...report,
                itens,
                abaixo_minimo: itens.filter((i) => i.abaixo_minimo).length,
              }
            })()
          : report,
      )
      void queryClient.invalidateQueries({ queryKey: portalKeys.erp })
      void queryClient.invalidateQueries({ queryKey: portalKeys.analysis })
    },
    onError: (error) => {
      setErroServidor(erroDoServidor(error))
      if (isAxiosError(error) && [404, 422].includes(error.response?.status ?? 0)) {
        void queryClient.invalidateQueries({ queryKey: inventoryKey })
      }
    },
  })

  const abaAtual: Aba = podeMovimentar ? aba : 'historico'
  const novaMovimentacao = () => {
    setResultado(null)
    setErroServidor(null)
    mutation.reset()
    setRodada((n) => n + 1)
  }

  let footer = null
  if (abaAtual === 'movimentar') {
    footer = resultado ? (
      <>
        <Button variant="secondary" onClick={novaMovimentacao}>
          Nova movimentação
        </Button>
        <Button onClick={onClose}>Concluir</Button>
      </>
    ) : (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" form={formId} loading={mutation.isPending}>
          {TIPO_INFO[tipo].acao}
        </Button>
      </>
    )
  }

  return (
    <Sheet
      open={open && !!item}
      onClose={onClose}
      size="sm"
      title={item?.nome ?? 'Item'}
      description={
        item ? (
          <span className="tabular">
            {item.sku} · {unidades(item.quantidade)} em estoque
          </span>
        ) : undefined
      }
      footer={footer}
    >
      {item && (
        <>
          {podeMovimentar ? (
            <Tabs aba={abaAtual} onAba={onAba} />
          ) : (
            <p className="mb-4 flex items-start gap-2 rounded-control bg-sunken px-3 py-2.5 text-sm text-ink-muted">
              <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Você vê o histórico. Para movimentar,{' '}
                {semPermissaoTexto('gerenciar_estoque').replace(/^Peça/, 'peça')}
              </span>
            </p>
          )}
          {abaAtual === 'movimentar' ? (
            resultado ? (
              <Confirmacao resultado={resultado} />
            ) : (
              <MovementForm
                key={rodada}
                item={item}
                formId={formId}
                tipo={tipo}
                onTipo={setTipo}
                erroServidor={erroServidor}
                limparErro={() => setErroServidor(null)}
                onSubmit={(input) => {
                  setErroServidor(null)
                  mutation.mutate(input)
                }}
              />
            )
          ) : (
            <MovementHistory item={item} />
          )}
        </>
      )}
    </Sheet>
  )
}
