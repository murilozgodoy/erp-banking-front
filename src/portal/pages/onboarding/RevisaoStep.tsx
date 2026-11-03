import { PencilLine } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { Button } from '../../ui/Button'
import { TextAreaField } from '../../ui/Field'
import { formatCnpj } from '../../lib/format'
import type { OnboardingTemplate } from '../../types'
import { formatAnswer, formatPhone, isVisible, type Errors, type WizardState } from './model'
import { SegmentIcon } from './SegmentoStep'

interface RevisaoStepProps {
  state: WizardState
  template: OnboardingTemplate | null
  errors: Errors
  onObservacoes: (value: string) => void
  onEdit: (step: number) => void
}

function Block({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string
  onEdit: () => void
  editLabel: string
  children: ReactNode
}) {
  return (
    <section className="border-t border-line pt-4" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          icon={<PencilLine aria-hidden className="size-3.5" />}
          aria-label={editLabel}
          onClick={onEdit}
        >
          Editar
        </Button>
      </div>
      {children}
    </section>
  )
}

function Rows({ rows }: { rows: { label: string; value: string; error?: string }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[minmax(0,15rem)_1fr]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-ink-muted">{row.label}</dt>
          <dd
            className={cn(
              'tabular min-w-0 break-words',
              row.value === 'Não informado' ? 'text-ink-faint' : 'text-ink',
            )}
          >
            {row.value}
            {row.error && (
              <span className="mt-0.5 block text-xs font-medium text-negative">{row.error}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const ou = (value: string | null | undefined) => (value?.trim() ? value : 'Não informado')

export function RevisaoStep({ state, template, errors, onObservacoes, onEdit }: RevisaoStepProps) {
  const { empresa } = state
  const e = (campo: string) => errors[`empresa.${campo}`]
  return (
    <div className="space-y-6">
      <TextAreaField
        name="observacoes"
        label="Observações sobre o negócio"
        rows={5}
        value={state.observacoes}
        error={errors.observacoes}
        placeholder="Ex.: dezembro concentra 30% das vendas; temos um contrato novo com um hospital a partir de março."
        hint="Opcional, e ajuda bastante: sazonalidade, contratos grandes, investimentos planejados ou qualquer coisa que os números sozinhos não mostram."
        onChange={(event) => onObservacoes(event.currentTarget.value)}
      />

      <div className="space-y-5">
        <h3 className="sr-only">Resumo do cadastro</h3>
        <Block title="Empresa" editLabel="Editar dados da empresa" onEdit={() => onEdit(0)}>
          <Rows
            rows={[
              { label: 'Razão social', value: ou(empresa.razao_social), error: e('razao_social') },
              { label: 'Nome fantasia', value: ou(empresa.nome_fantasia) },
              { label: 'CNPJ', value: ou(formatCnpj(empresa.cnpj)), error: e('cnpj') },
              { label: 'E-mail', value: ou(empresa.email), error: e('email') },
              {
                label: 'Telefone',
                value: ou(formatPhone(empresa.telefone ?? '')),
                error: e('telefone'),
              },
              {
                label: 'Cidade',
                value: ou(
                  [empresa.cidade, empresa.estado].filter((parte) => parte?.trim()).join(' / '),
                ),
                error: e('cidade') ?? e('estado'),
              },
              {
                label: 'Fundação',
                value:
                  empresa.fundacao_ano === null ? 'Não informado' : String(empresa.fundacao_ano),
              },
              {
                label: 'Funcionários',
                value:
                  empresa.funcionarios === null ? 'Não informado' : String(empresa.funcionarios),
              },
            ]}
          />
        </Block>

        <Block title="Segmento" editLabel="Trocar o segmento" onEdit={() => onEdit(1)}>
          {template ? (
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-control bg-sunken text-ink-muted">
                <SegmentIcon icone={template.icone} className="size-4.5" />
              </span>
              <div>
                <p className="text-sm font-medium text-ink">{template.nome}</p>
                <p className="text-sm text-ink-muted">{template.descricao}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-negative">
              {errors.segmento ?? 'Nenhum segmento escolhido.'}
            </p>
          )}
        </Block>

        {template && (
          <Block
            title="Respostas do segmento"
            editLabel="Editar respostas do segmento"
            onEdit={() => onEdit(2)}
          >
            <div className="space-y-4">
              {template.secoes.map((secao) => {
                const campos = secao.campos.filter((campo) => isVisible(campo, state.respostas))
                return (
                  <div key={secao.id} className="space-y-2">
                    <h4 className="text-xs font-medium text-ink-faint">{secao.titulo}</h4>
                    <Rows
                      rows={campos.map((campo) => ({
                        label: campo.label,
                        value: formatAnswer(campo, state.respostas[campo.id]),
                        error: errors[campo.id],
                      }))}
                    />
                  </div>
                )
              })}
            </div>
          </Block>
        )}
      </div>
    </div>
  )
}
