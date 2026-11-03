import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { errorMessage } from '@/lib/errors'
import { usePortalApi } from '@/portal/api'
import { formatCnpj, money, pct } from '@/portal/lib/format'
import { isAiReading } from '@/portal/pages/status/analysis'
import { ReadingTitle, ScoreFigure, StrengthsAndRisks } from '@/portal/pages/status/analysisView'
import type { BusinessAnalysis, ReviewDecision, ReviewItem } from '@/portal/types'
import { Button } from '@/portal/ui/Button'
import { PRODUTO_LABEL } from '@/portal/ui/credit'
import { TextAreaField } from '@/portal/ui/Field'
import { Pill } from '@/portal/ui/Pill'
import { ErrorState, Skeleton } from '@/portal/ui/Surface'
import { Sheet } from '@/portal/ui/Sheet'

import {
  dateTime,
  formatPhone,
  GERADO_POR_LABEL,
  kpiValue,
  relativeInstant,
  reviewReasons,
  segmentoLabel,
  waitingTime,
} from './format'
import { queueKeys } from './queue'

interface ReviewSheetProps {
  item: ReviewItem | null
  canDecide: boolean
  onClose: () => void
  onDecide: (item: ReviewItem, decision: ReviewDecision) => void
  pending: boolean
  error: unknown
}

/** Detalhe de uma empresa da fila, com a análise completa do Score e a decisão. */
export function ReviewSheet({
  item,
  canDecide,
  onClose,
  onDecide,
  pending,
  error,
}: ReviewSheetProps) {
  return (
    <Sheet
      open={item !== null}
      onClose={onClose}
      title={item?.empresa.razao_social ?? ''}
      description={
        item
          ? `${formatCnpj(item.empresa.cnpj ?? '')} · ${segmentoLabel(item.segmento)}`
          : undefined
      }
      footer={
        item && canDecide ? (
          <DecisionBar
            key={item.customer_id}
            item={item}
            pending={pending}
            error={error}
            onDecide={(decision) => onDecide(item, decision)}
          />
        ) : undefined
      }
    >
      {item && <ReviewDetail item={item} />}
    </Sheet>
  )
}

function Section({
  title,
  children,
  aside,
}: {
  title: ReactNode
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        {typeof title === 'string' ? (
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
        ) : (
          title
        )}
        {aside}
      </div>
      {children}
    </section>
  )
}

function ReviewDetail({ item }: { item: ReviewItem }) {
  const { empresa } = item
  const fields: [string, ReactNode][] = [
    ['Nome fantasia', empresa.nome_fantasia || '—'],
    ['CNPJ', <span className="tabular">{formatCnpj(empresa.cnpj ?? '')}</span>],
    ['E-mail', empresa.email || '—'],
    ['Telefone', empresa.telefone ? formatPhone(empresa.telefone) : '—'],
    ['Cidade', empresa.cidade ? `${empresa.cidade}/${empresa.estado}` : '—'],
    [
      'Fundação',
      empresa.fundacao_ano ? <span className="tabular">{empresa.fundacao_ano}</span> : '—',
    ],
    [
      'Funcionários',
      empresa.funcionarios ? <span className="tabular">{empresa.funcionarios}</span> : '—',
    ],
  ]
  return (
    <div className="space-y-6">
      <Section title="Resumo da análise">
        {item.analise ? (
          <div className="space-y-3">
            <ScoreFigure analysis={item.analise} size="md" />
            <p className="text-sm text-ink-muted">
              {item.analise.gerado_por
                ? (GERADO_POR_LABEL[item.analise.gerado_por] ?? item.analise.gerado_por)
                : 'Análise em andamento'}{' '}
              · enviado {relativeInstant(item.submitted_at)}, {dateTime(item.submitted_at)} · na
              fila há <span className="tabular">{waitingTime(item.submitted_at)}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            O resumo do Score ainda não chegou. Veja a análise completa abaixo.
          </p>
        )}
      </Section>

      <Section title="Empresa">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className="break-words text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Observações da empresa">
        {item.observacoes?.trim() ? (
          <blockquote className="text-sm leading-relaxed text-ink">{item.observacoes}</blockquote>
        ) : (
          <p className="text-sm text-ink-muted">A empresa não escreveu observações.</p>
        )}
      </Section>

      <FullAnalysis customerId={item.customer_id} />
    </div>
  )
}

function FullAnalysis({ customerId }: { customerId: number }) {
  const api = usePortalApi()
  const analysis = useQuery({
    queryKey: queueKeys.analysis(customerId),
    queryFn: () => api.score.analysisOf(customerId),
    staleTime: 60_000,
  })

  if (analysis.isPending) {
    return (
      <Section title="Análise completa">
        <div role="status" aria-label="Carregando a análise completa…" className="space-y-2.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="mt-4 h-16 w-full" />
        </div>
      </Section>
    )
  }
  if (analysis.isError) {
    const notFound = isAxiosError(analysis.error) && analysis.error.response?.status === 404
    return (
      <Section title="Análise completa">
        {notFound ? (
          <p className="text-sm text-ink-muted">
            O Score ainda não tem a análise completa desta empresa. Decida pelo resumo e pelas
            observações, ou volte em alguns minutos.
          </p>
        ) : (
          <ErrorState
            title="Não conseguimos carregar a análise completa"
            message={`${errorMessage(analysis.error)} O resumo e os dados da empresa continuam valendo.`}
            onRetry={() => void analysis.refetch()}
          />
        )}
      </Section>
    )
  }
  return <AnalysisContent analysis={analysis.data} />
}

function AnalysisContent({ analysis }: { analysis: BusinessAnalysis }) {
  const ai = isAiReading(analysis.gerado_por)
  const reasons = reviewReasons(analysis)
  const kpis = analysis.kpis ?? []
  const insights = analysis.insights ?? []
  const oportunidades = analysis.oportunidades ?? []
  return (
    <>
      <Section
        title="Análise completa"
        aside={
          analysis.atualizado_em ? (
            <span className="text-xs text-ink-muted">
              Atualizada {dateTime(analysis.atualizado_em)}
            </span>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {analysis.resumo?.trim() && (
            <div className="space-y-1">
              <ReadingTitle ai={ai} as="h4">
                Leitura
              </ReadingTitle>
              <p className="text-sm leading-relaxed text-ink">{analysis.resumo}</p>
            </div>
          )}
          {reasons.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold text-ink">Por que veio para a fila</h4>
              <ul className="flex flex-wrap gap-1.5">
                {reasons.map((reason) => (
                  <li key={reason}>
                    <Pill tone="warning">{reason}</Pill>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      {kpis.length > 0 && (
        <Section title="Indicadores">
          <dl className="divide-y divide-line">
            {kpis.map((kpi) => (
              <div
                key={kpi.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2"
              >
                <dt className="text-sm text-ink-muted">{kpi.label}</dt>
                <dd className="text-right">
                  <span className="tabular text-sm font-medium text-ink">{kpiValue(kpi)}</span>
                  {kpi.leitura && (
                    <span className="block text-xs text-ink-muted">{kpi.leitura}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {insights.length > 0 && (
        <Section title={<ReadingTitle ai>Insights</ReadingTitle>}>
          <ul className="space-y-3">
            {insights.map((insight) => (
              <li key={`${insight.area}-${insight.titulo}`} className="text-sm">
                <p className="font-medium text-ink">{insight.titulo}</p>
                <p className="text-ink-muted">{insight.texto}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {oportunidades.length > 0 && (
        <Section title={<ReadingTitle ai>Oportunidades de crédito</ReadingTitle>}>
          <ul className="divide-y divide-line">
            {oportunidades.map((op) => (
              <li
                key={op.tipo}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{PRODUTO_LABEL[op.tipo] ?? op.titulo}</p>
                  <p className="text-ink-muted">{op.racional || op.descricao}</p>
                </div>
                <p className="tabular text-right text-ink">
                  até {money(op.valor_maximo)}
                  <span className="block text-xs text-ink-muted">
                    {op.taxa_mensal ? `${pct(op.taxa_mensal, 2)} a.m. · ` : ''}
                    {op.prazo_max_meses} meses
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {((analysis.pontos_fortes?.length ?? 0) > 0 || (analysis.riscos?.length ?? 0) > 0) && (
        <section className="border-t border-line pt-5">
          <StrengthsAndRisks
            ai={ai}
            pontos_fortes={analysis.pontos_fortes}
            riscos={analysis.riscos}
          />
        </section>
      )}
    </>
  )
}

type Mode = ReviewDecision['decisao'] | null

function DecisionBar({
  item,
  pending,
  error,
  onDecide,
}: {
  item: ReviewItem
  pending: boolean
  error: unknown
  onDecide: (decision: ReviewDecision) => void
}) {
  const [mode, setMode] = useState<Mode>(null)
  const [comment, setComment] = useState('')
  const [missing, setMissing] = useState(false)
  const field = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode) field.current?.querySelector('textarea')?.focus()
  }, [mode])

  if (!mode) {
    return (
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        <Button
          variant="secondary"
          icon={<X aria-hidden className="size-4" />}
          onClick={() => setMode('REPROVADO')}
        >
          Reprovar
        </Button>
        <Button icon={<Check aria-hidden className="size-4" />} onClick={() => setMode('APROVADO')}>
          Aprovar
        </Button>
      </div>
    )
  }

  const approving = mode === 'APROVADO'
  const confirm = () => {
    const text = comment.trim()
    if (!approving && !text) {
      setMissing(true)
      field.current?.querySelector('textarea')?.focus()
      return
    }
    onDecide({ decisao: mode, comentario: text })
  }

  return (
    <div className="w-full space-y-3">
      <div ref={field}>
        <TextAreaField
          label={approving ? 'Comentário (opcional)' : 'Motivo da reprovação'}
          required={!approving}
          rows={3}
          value={comment}
          maxLength={2000}
          error={
            missing ? 'Escreva o motivo: ele orienta a empresa a corrigir e reenviar.' : undefined
          }
          hint={
            approving
              ? 'Fica registrado na decisão.'
              : 'Fica registrado e orienta a empresa a corrigir o cadastro.'
          }
          onChange={(event) => {
            setComment(event.target.value)
            if (event.target.value.trim()) setMissing(false)
          }}
        />
      </div>
      <p className="text-sm text-ink-muted">
        {approving ? (
          <>
            Aprovar <span className="font-medium text-ink">{item.empresa.razao_social}</span> libera
            o portal e a conta da empresa na hora.
          </>
        ) : (
          <>
            Reprovar <span className="font-medium text-ink">{item.empresa.razao_social}</span>{' '}
            bloqueia o portal até a empresa revisar e reenviar.
          </>
        )}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-negative">
          Não registramos a decisão: {errorMessage(error)} A empresa voltou para a fila; tente de
          novo.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" disabled={pending} onClick={() => setMode(null)}>
          Voltar
        </Button>
        <Button variant={approving ? 'primary' : 'danger'} loading={pending} onClick={confirm}>
          {approving ? 'Confirmar aprovação' : 'Confirmar reprovação'}
        </Button>
      </div>
    </div>
  )
}
