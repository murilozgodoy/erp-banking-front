/**
 * Simulador ilustrativo da landing. As taxas são fixas e servem só para dar ordem de grandeza:
 * taxa, limite e CET reais saem da análise de cada empresa.
 */

export type CreditProductId = 'antecipacao' | 'capital-giro' | 'estoque' | 'alavancagem'

export interface CreditProduct {
  id: CreditProductId
  nome: string
  /** Rótulo curto, para o controle segmentado do celular. */
  rotulo: string
  /** Onde o produto aparece no portal. */
  telas: string
  /** Quando a ErpIa sugere o produto. */
  quando: string
  /** Taxa ilustrativa ao mês (0,0219 = 2,19% a.m.). */
  taxaMensal: number
  /** `parcelas`: tabela Price. `desconto`: antecipação, desconto simples sobre o valor. */
  modalidade: 'parcelas' | 'desconto'
  prazoMin: number
  prazoMax: number
}

export const CREDIT_PRODUCTS: CreditProduct[] = [
  {
    id: 'antecipacao',
    nome: 'Antecipação de recebíveis',
    rotulo: 'Antecipação',
    telas: 'Vendas e Recebíveis',
    quando: 'O caixa projetado fica negativo e há vendas no cartão ou boletos a receber.',
    taxaMensal: 0.0139,
    modalidade: 'desconto',
    prazoMin: 1,
    prazoMax: 12,
  },
  {
    id: 'capital-giro',
    nome: 'Capital de giro',
    rotulo: 'Capital de giro',
    telas: 'Pagamentos e Pendências',
    quando: 'O saldo não cobre as contas da semana ou um fornecedor está para atrasar.',
    taxaMensal: 0.0219,
    modalidade: 'parcelas',
    prazoMin: 3,
    prazoMax: 24,
  },
  {
    id: 'estoque',
    nome: 'Financiamento de estoque',
    rotulo: 'Estoque',
    telas: 'Estoque',
    quando: 'Itens de alto giro ficam abaixo do mínimo e comprar em volume sai mais barato.',
    taxaMensal: 0.0179,
    modalidade: 'parcelas',
    prazoMin: 3,
    prazoMax: 18,
  },
  {
    id: 'alavancagem',
    nome: 'Alavancagem',
    rotulo: 'Alavancagem',
    telas: 'Visão geral e Crédito',
    quando:
      'Margem e receita recorrente sustentam um passo maior, como uma loja ou uma contratação.',
    taxaMensal: 0.0159,
    modalidade: 'parcelas',
    prazoMin: 6,
    prazoMax: 36,
  },
]

export const VALOR_MIN = 5_000
export const VALOR_MAX = 500_000
export const VALOR_STEP = 1_000

const centavos = (value: number) => Math.round(value * 100) / 100

/** Parcela fixa da tabela Price: PMT = V · i / (1 − (1 + i)^−n). */
export function parcelaPrice(valor: number, taxaMensal: number, meses: number): number {
  if (meses <= 0) throw new RangeError('O prazo precisa ser de pelo menos 1 mês.')
  if (taxaMensal === 0) return centavos(valor / meses)
  return centavos((valor * taxaMensal) / (1 - (1 + taxaMensal) ** -meses))
}

export type SimulationResult =
  | { modalidade: 'parcelas'; parcela: number; total: number; juros: number }
  | { modalidade: 'desconto'; liquido: number; custo: number }

export function simular(produto: CreditProduct, valor: number, meses: number): SimulationResult {
  if (produto.modalidade === 'desconto') {
    const custo = centavos(valor * produto.taxaMensal * meses)
    return { modalidade: 'desconto', liquido: centavos(valor - custo), custo }
  }
  const parcela = parcelaPrice(valor, produto.taxaMensal, meses)
  const total = centavos(parcela * meses)
  return { modalidade: 'parcelas', parcela, total, juros: centavos(total - valor) }
}

export interface ParcelaPrice {
  mes: number
  juros: number
  amortizacao: number
}

/**
 * Decomposição da tabela Price mês a mês: a parcela é fixa, os juros caem e a amortização cresce.
 * A última amortização absorve o arredondamento para o saldo fechar em zero.
 */
export function tabelaPrice(valor: number, taxaMensal: number, meses: number): ParcelaPrice[] {
  const parcela = parcelaPrice(valor, taxaMensal, meses)
  const linhas: ParcelaPrice[] = []
  let saldo = valor
  for (let mes = 1; mes <= meses; mes++) {
    const juros = centavos(saldo * taxaMensal)
    const amortizacao = mes === meses ? centavos(saldo) : centavos(parcela - juros)
    saldo = centavos(saldo - amortizacao)
    linhas.push({ mes, juros, amortizacao })
  }
  return linhas
}

/** Mantém o prazo dentro da faixa do produto ao trocar de produto. */
export function clampPrazo(produto: CreditProduct, meses: number): number {
  return Math.min(produto.prazoMax, Math.max(produto.prazoMin, meses))
}
