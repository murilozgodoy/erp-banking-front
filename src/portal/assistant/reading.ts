import { money, number } from '../lib/format'
import type { Fonte, Overview } from '../types'
import { screenFor } from './suggestions'

/** Trecho de uma etapa do card de leitura: texto, ou número em destaque (negrito). */
export type Trecho = string | { forte: string; atencao?: boolean }
export type Etapa = { trechos: Trecho[]; atencao?: boolean }

const mil = (valor: number) => money(valor, { compact: true }).replace(/\s/g, ' ')
const t = (...trechos: Trecho[]): Etapa => ({ trechos })
const forte = (texto: string) => ({ forte: texto })

/**
 * Etapas do "Lendo seus dados…" para a tela atual (no máximo 4), com os números do overview já
 * em cache quando houver. São uma leitura do que o assistente consulta, não um log real.
 */
export function readingSteps(pathname: string, overview?: Overview): Etapa[] {
  const o = overview
  const projeta = t('Projetando o caixa dos próximos 60 dias')
  const ofertas = t('Conferindo suas ofertas de crédito')
  switch (screenFor(pathname)) {
    case '/app/vendas':
      return [
        o
          ? t('Lendo ', forte(mil(o.receita_30d)), ' em vendas dos últimos 30 dias')
          : t('Lendo suas vendas dos últimos 30 dias'),
        t('Comparando canais e formas de pagamento'),
        o
          ? t('Calculando o ticket médio de ', forte(mil(o.ticket_medio_30d)))
          : t('Calculando o ticket médio'),
      ]
    case '/app/recebiveis':
      return [
        o
          ? t('Lendo ', forte(mil(o.recebiveis_90d)), ' a receber em 90 dias')
          : t('Lendo seus recebíveis previstos'),
        o
          ? t('Cruzando com ', forte(mil(o.a_pagar_30d)), ' a pagar em 30 dias')
          : t('Cruzando com as contas a pagar'),
        projeta,
        ofertas,
      ]
    case '/app/pagamentos':
      return [
        o
          ? t('Lendo ', forte(mil(o.a_pagar_30d)), ' a pagar em 30 dias')
          : t('Lendo suas contas a pagar'),
        o ? t('Conferindo o saldo de ', forte(mil(o.saldo))) : t('Conferindo o saldo da conta'),
        projeta,
      ]
    case '/app/pendencias':
      return [
        o
          ? t('Lendo ', forte(number(o.pendencias_count)), ' pendências')
          : t('Lendo suas pendências'),
        t('Ordenando pelo custo de esperar'),
        ofertas,
      ]
    case '/app/estoque':
      return [
        o ? t('Lendo ', forte(mil(o.estoque_valor)), ' em estoque') : t('Lendo seu estoque'),
        t('Calculando o giro dos itens'),
        t('Conferindo o financiamento de estoque'),
      ]
    case '/app/credito':
      return [ofertas, t('Simulando as condições'), t('Comparando taxas e prazos')]
    default:
      return [
        o
          ? t('Lendo a receita de ', forte(mil(o.receita_30d)), ' dos últimos 30 dias')
          : t('Lendo suas vendas e recebíveis'),
        o
          ? t(
              'Cruzando ',
              forte(mil(o.recebiveis_90d)),
              ' a receber com ',
              forte(mil(o.a_pagar_30d)),
              ' a pagar',
            )
          : t('Cruzando recebíveis com contas a pagar'),
        projeta,
        ofertas,
      ]
  }
}

/** Valor negativo em destaque na resposta (ex. `**-R$ 11.750,00**`). */
const NEGATIVO = /\*\*([-−]\s?R\$\s?[\d.,]+(?:\s?mil)?)\*\*/

/**
 * Etapas concluídas a partir da resposta: uma por fonte consultada (no máximo 3) e, se a
 * resposta destacar um valor negativo, um "Encontrado:" em atenção.
 */
export function stepsFromAnswer(fontes: Fonte[], resposta: string): Etapa[] {
  const etapas: Etapa[] = fontes.slice(0, 3).map((fonte) => t(`Lendo ${fonte.label.toLowerCase()}`))
  const negativo = NEGATIVO.exec(resposta)?.[1]
  if (negativo) {
    etapas.push({ trechos: ['Encontrado: ', { forte: negativo, atencao: true }], atencao: true })
  }
  return etapas
}
