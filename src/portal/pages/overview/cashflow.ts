import { dayMonth, money, parseDay } from '../../lib/format'
import type { FluxoCaixaDia, Oportunidade } from '../../types'

/** Trecho contínuo em que o saldo projetado fica abaixo de zero. */
export interface Vale {
  inicio: string
  /** Último dia negativo; `null` quando o caixa não volta ao positivo dentro do período. */
  fim: string | null
  dias: number
  minimo: number
  minimoData: string
}

/** Todos os vales do período, na ordem em que acontecem. */
export function findVales(fluxo: FluxoCaixaDia[]): Vale[] {
  const vales: Vale[] = []
  let atual: Vale | null = null
  fluxo.forEach((dia, i) => {
    if (dia.saldo_projetado < 0) {
      if (!atual) {
        atual = { inicio: dia.data, fim: null, dias: 0, minimo: 0, minimoData: dia.data }
        vales.push(atual)
      }
      atual.dias++
      if (dia.saldo_projetado < atual.minimo) {
        atual.minimo = dia.saldo_projetado
        atual.minimoData = dia.data
      }
    } else if (atual) {
      atual.fim = fluxo[i - 1].data
      atual = null
    }
  })
  return vales
}

/** Menor saldo projetado do período (e o dia). */
export function lowestPoint(fluxo: FluxoCaixaDia[]): { valor: number; data: string } | null {
  if (!fluxo.length) return null
  const dia = fluxo.reduce((min, d) => (d.saldo_projetado < min.saldo_projetado ? d : min))
  return { valor: dia.saldo_projetado, data: dia.data }
}

/** "18 a 26 nov", "28 nov a 3 dez" ou "a partir de 18 nov". */
export function valeRange(vale: Pick<Vale, 'inicio' | 'fim'>): string {
  if (!vale.fim) return `a partir de ${dayMonth(vale.inicio)}`
  if (vale.fim === vale.inicio) return `em ${dayMonth(vale.inicio)}`
  const a = parseDay(vale.inicio)
  const b = parseDay(vale.fim)
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  return `de ${sameMonth ? a.getDate() : dayMonth(vale.inicio)} a ${dayMonth(vale.fim)}`
}

/** Quanto antecipar para cobrir o ponto mais baixo, com 10% de folga, em milhares. */
export function amountToCover(minimo: number): number {
  if (minimo >= 0) return 0
  return Math.ceil((-minimo * 1.1) / 1000) * 1000
}

export interface Bridge {
  oportunidade: Oportunidade
  valor: number
  /** O valor sugerido cobre o vale inteiro (limite suficiente). */
  cobre: boolean
}

const BRIDGE_PRODUCTS = ['ANTECIPACAO_RECEBIVEIS', 'CAPITAL_DE_GIRO'] as const

/**
 * A ponte de crédito do vale: a antecipação de recebíveis (ou, se o limite não basta, o capital
 * de giro) no valor que cobre o ponto mais baixo. Sem nenhuma das duas, `null`.
 */
export function creditBridge(minimo: number, oportunidades: Oportunidade[]): Bridge | null {
  const necessario = amountToCover(minimo)
  if (!necessario) return null
  const candidatas = BRIDGE_PRODUCTS.map((tipo) =>
    oportunidades.find((o) => o.tipo === tipo && o.valor_maximo > 0),
  ).filter((o): o is Oportunidade => Boolean(o))
  if (!candidatas.length) return null
  const cobre = candidatas.find((o) => o.valor_maximo >= necessario)
  if (cobre) return { oportunidade: cobre, valor: necessario, cobre: true }
  const maior = candidatas.reduce((a, b) => (b.valor_maximo > a.valor_maximo ? b : a))
  return { oportunidade: maior, valor: maior.valor_maximo, cobre: false }
}

/** "R$ 42 mil" para valores redondos de ponte. */
export function shortMoney(valor: number): string {
  return money(valor, { compact: true }).replace(/\s/g, ' ')
}

export interface MainOffer {
  oportunidade: Oportunidade
  /** Valor sugerido: o que cobre o vale, ou o limite pré-aprovado. */
  valor: number
  /** Frase da oferta no card da Leitura. */
  headline: string
}

/**
 * A oportunidade principal da Visão geral: a ponte do vale de caixa, se houver; senão a primeira
 * do ranking da análise. `null` sem ofertas.
 */
export function mainOffer(fluxo: FluxoCaixaDia[], oportunidades: Oportunidade[]): MainOffer | null {
  const low = lowestPoint(fluxo)
  const [vale] = findVales(fluxo)
  const bridge = low && vale ? creditBridge(low.valor, oportunidades) : null
  if (bridge && vale) {
    const verbo = bridge.oportunidade.tipo === 'ANTECIPACAO_RECEBIVEIS' ? 'Antecipar' : 'Tomar'
    return {
      oportunidade: bridge.oportunidade,
      valor: bridge.valor,
      headline: `Seu caixa fica negativo ${valeRange(vale)}. ${verbo} ${shortMoney(bridge.valor)} ${
        bridge.cobre ? 'cobre o vale' : 'reduz o vale'
      }.`,
    }
  }
  const [primeira] = oportunidades
  if (!primeira) return null
  return { oportunidade: primeira, valor: primeira.valor_maximo, headline: primeira.titulo }
}
