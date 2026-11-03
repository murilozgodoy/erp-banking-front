import type {
  AnalysisStatus,
  BusinessAnalysis,
  Empresa,
  FaixaRisco,
  Insight,
  Kpi,
  Oportunidade,
  ProdutoCredito,
  ReviewItem,
} from '../types'
import { PRAZO_MAX_MESES, r2, taxaMensal } from './pricing'

/** Valores em reais no formato brasileiro (R$ 1.234,56). */
export function reais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "R$ 42 mil" (arredondado para cima). */
export function mil(valor: number): string {
  return `R$ ${Math.ceil(valor / 1000).toLocaleString('pt-BR')} mil`
}

function pct(valor: number): string {
  return `${Math.round(valor)}%`
}

/** Dígitos verificadores de CNPJ a partir dos 12 primeiros dígitos. */
export function cnpjComDv(base12: string): string {
  const dv = (digitos: string) => {
    const pesos =
      digitos.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = [...digitos].reduce((total, d, i) => total + Number(d) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  const primeiro = `${base12}${dv(base12)}`
  return `${primeiro}${dv(primeiro)}`
}

export function cnpjValido(cnpj: string): boolean {
  return (
    /^\d{14}$/.test(cnpj) && !/^(\d)\1{13}$/.test(cnpj) && cnpjComDv(cnpj.slice(0, 12)) === cnpj
  )
}

export function faixaDoScore(score: number): FaixaRisco {
  if (score >= 800) return 'BAIXO'
  if (score >= 600) return 'MEDIO'
  if (score >= 400) return 'ALTO'
  return 'MUITO_ALTO'
}

/** Números do negócio calculados a partir dos dados do ERP. */
export interface MetricasNegocio {
  receitaMensal: number
  receitaAnterior: number
  receitaVariacaoPct: number
  ticketMedio: number
  pctCredito: number
  pctFimSemana: number
  pctDelivery: number
  margemPct: number
  pmr: number
  pmp: number
  coberturaEstoque: number
  dividas: number
  parcelaMensal: number
  recebiveis90: number
  /** Dias até o caixa ficar negativo (null = não fica). */
  valeInicio: number | null
  valeFim: number | null
  valeMinimo: number
  antecipacaoSugerida: number
  boletosSemana: number
  boletosCobertos: number
  estoqueValor: number
  estoqueParado: number
  abaixoMinimo: number
  maiorAtraso: { fornecedor: string; dias: number; juros: number } | null
  limites: Record<ProdutoCredito, number>
}

const BENCHMARK_ALIMENTACAO = {
  receita: 150_000,
  margem: 55,
  ticket: 28,
  pmr: 12,
  pmp: 28,
  ciclo: 8,
  endividamento: 0.9,
  parcelas: 6,
  cobertura: 20,
}

function leitura(valor: number, benchmark: number, maiorEhMelhor: boolean): string {
  const diferenca = (valor - benchmark) / benchmark
  if (Math.abs(diferenca) < 0.05) return 'na média do segmento'
  return diferenca > 0 === maiorEhMelhor
    ? 'melhor que a média do segmento'
    : 'pior que a média do segmento'
}

function kpis(m: MetricasNegocio): Kpi[] {
  const b = BENCHMARK_ALIMENTACAO
  const ciclo = Math.round(m.pmr + m.coberturaEstoque - m.pmp)
  const endividamento = r2(m.dividas / m.receitaMensal)
  const comprometimento = r2((m.parcelaMensal / m.receitaMensal) * 100)
  const kpi = (
    id: Kpi['id'],
    label: string,
    valor: number,
    unidade: Kpi['unidade'],
    benchmark: number,
    maiorEhMelhor: boolean,
  ): Kpi => ({
    id,
    label,
    valor,
    unidade,
    benchmark_segmento: benchmark,
    leitura: leitura(valor, benchmark, maiorEhMelhor),
  })
  return [
    {
      ...kpi('receita_mensal', 'Receita mensal', r2(m.receitaMensal), 'BRL', b.receita, true),
      leitura: `acima da média do segmento (${m.receitaVariacaoPct >= 0 ? '+' : ''}${m.receitaVariacaoPct.toFixed(1).replace('.', ',')}% em 30 dias)`,
    },
    kpi('margem_bruta_pct', 'Margem bruta', m.margemPct, 'PCT', b.margem, true),
    kpi('ticket_medio', 'Ticket médio', r2(m.ticketMedio), 'BRL', b.ticket, true),
    kpi(
      'prazo_medio_recebimento_dias',
      'Prazo médio de recebimento',
      Math.round(m.pmr),
      'DIAS',
      b.pmr,
      false,
    ),
    kpi('prazo_medio_pagamento_dias', 'Prazo médio de pagamento', m.pmp, 'DIAS', b.pmp, true),
    kpi('ciclo_caixa_dias', 'Ciclo de caixa', ciclo, 'DIAS', b.ciclo, false),
    kpi(
      'endividamento_sobre_receita',
      'Dívida sobre receita mensal',
      endividamento,
      'X',
      b.endividamento,
      false,
    ),
    kpi(
      'comprometimento_parcelas_pct',
      'Receita comprometida com parcelas',
      comprometimento,
      'PCT',
      b.parcelas,
      false,
    ),
    kpi(
      'cobertura_estoque_dias',
      'Cobertura de estoque',
      Math.round(m.coberturaEstoque),
      'DIAS',
      b.cobertura,
      false,
    ),
  ]
}

function dataCurta(dias: number, base: Date): string {
  const data = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias)
  return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`
}

function insights(m: MetricasNegocio, base: Date): Insight[] {
  const lista: Insight[] = []
  if (m.valeInicio !== null) {
    lista.push({
      area: 'geral',
      titulo: 'Vale de caixa à vista',
      texto: `Seu caixa fica negativo em ${m.valeInicio} dias (${dataCurta(m.valeInicio, base)}) e chega a ${reais(Math.round(m.valeMinimo))}; antecipar ${mil(m.antecipacaoSugerida)} de recebíveis cobre o vale.`,
      severidade: 'atencao',
    })
  } else {
    lista.push({
      area: 'geral',
      titulo: 'Caixa positivo nos próximos 60 dias',
      texto: 'Com as vendas atuais, o saldo projetado cobre todas as contas do período.',
      severidade: 'info',
    })
  }
  lista.push(
    {
      area: 'vendas',
      titulo: 'Fim de semana puxa a receita',
      texto: `Sábados e domingos concentram ${pct(m.pctFimSemana)} da receita; ${pct(m.pctCredito)} das vendas são no crédito e alongam seu prazo médio para ${Math.round(m.pmr)} dias.`,
      severidade: 'info',
    },
    {
      area: 'vendas',
      titulo: 'Delivery cresce',
      texto: `iFood e WhatsApp já são ${pct(m.pctDelivery)} do faturamento. Vendas no cartão podem virar caixa na hora com antecipação.`,
      severidade: 'oportunidade',
    },
    {
      area: 'recebiveis',
      titulo: 'Agenda de recebíveis',
      texto: `${mil(m.recebiveis90)} a receber nos próximos 90 dias. Até ${mil(m.limites.ANTECIPACAO_RECEBIVEIS)} podem ser antecipados hoje.`,
      severidade: 'oportunidade',
    },
    {
      area: 'pagamentos',
      titulo: 'Semana apertada',
      texto: `${m.boletosSemana} boletos vencem esta semana; o saldo cobre ${m.boletosCobertos}.`,
      severidade: m.boletosCobertos < m.boletosSemana ? 'atencao' : 'info',
    },
    {
      area: 'estoque',
      titulo: 'Dinheiro parado na prateleira',
      texto: `${mil(m.estoqueParado)} parados em itens com giro acima de 120 dias, enquanto ${m.abaixoMinimo} itens de fim de ano estão abaixo do mínimo.`,
      severidade: 'atencao',
    },
  )
  if (m.maiorAtraso) {
    lista.push({
      area: 'pendencias',
      titulo: 'Fornecedor em atraso',
      texto: `${m.maiorAtraso.fornecedor} atrasado há ${m.maiorAtraso.dias} dias: juros e multa de ${reais(m.maiorAtraso.juros)}.`,
      severidade: 'atencao',
    })
  }
  lista.push({
    area: 'credito',
    titulo: 'Limite pré-aprovado maior',
    texto: `Seu limite pré-aprovado subiu após 30 dias de vendas: capital de giro de até ${mil(m.limites.CAPITAL_DE_GIRO)}.`,
    severidade: 'oportunidade',
  })
  return lista
}

function oportunidades(m: MetricasNegocio, faixa: FaixaRisco): Oportunidade[] {
  const taxa = (produto: ProdutoCredito) => taxaMensal(faixa, produto) ?? 0
  return [
    {
      tipo: 'ANTECIPACAO_RECEBIVEIS',
      titulo: 'Antecipe recebíveis e atravesse o vale',
      descricao: `Receba hoje as vendas no cartão que cairiam nas próximas semanas.`,
      valor_maximo: r2(m.limites.ANTECIPACAO_RECEBIVEIS),
      taxa_mensal: taxa('ANTECIPACAO_RECEBIVEIS'),
      prazo_max_meses: PRAZO_MAX_MESES.ANTECIPACAO_RECEBIVEIS,
      racional: `Antecipar ${mil(m.antecipacaoSugerida)} cobre o saldo negativo projetado sem novo endividamento de longo prazo.`,
    },
    {
      tipo: 'CAPITAL_DE_GIRO',
      titulo: 'Capital de giro para o fim de ano',
      descricao: 'Reforço de caixa para compras de Natal e 13º salário.',
      valor_maximo: r2(m.limites.CAPITAL_DE_GIRO),
      taxa_mensal: taxa('CAPITAL_DE_GIRO'),
      prazo_max_meses: PRAZO_MAX_MESES.CAPITAL_DE_GIRO,
      racional: 'Receita estável e crescente nos últimos 120 dias, com margem acima da média.',
    },
    {
      tipo: 'FINANCIAMENTO_ESTOQUE',
      titulo: 'Financie o estoque de Natal',
      descricao: 'Reponha panetones, chocotones e café antes do pico de dezembro.',
      valor_maximo: r2(m.limites.FINANCIAMENTO_ESTOQUE),
      taxa_mensal: taxa('FINANCIAMENTO_ESTOQUE'),
      prazo_max_meses: PRAZO_MAX_MESES.FINANCIAMENTO_ESTOQUE,
      racional: `${m.abaixoMinimo} itens de giro rápido estão abaixo do mínimo.`,
    },
    {
      tipo: 'ALAVANCAGEM',
      titulo: 'Expansão: segunda unidade',
      descricao: 'Crédito de longo prazo para abrir uma loja ou ampliar a produção.',
      valor_maximo: r2(m.limites.ALAVANCAGEM),
      taxa_mensal: taxa('ALAVANCAGEM'),
      prazo_max_meses: PRAZO_MAX_MESES.ALAVANCAGEM,
      racional: 'Ticket e margem acima do segmento indicam operação replicável.',
    },
    {
      tipo: 'CONSOLIDACAO_DIVIDAS',
      titulo: 'Troque a dívida cara',
      descricao: 'Quite o capital de giro atual e reduza a parcela mensal.',
      valor_maximo: r2(m.dividas),
      taxa_mensal: r2((taxaMensal(faixa, 'CAPITAL_DE_GIRO') ?? 0) - 0.3),
      prazo_max_meses: 36,
      racional: `As parcelas comprometem ${((m.parcelaMensal / m.receitaMensal) * 100).toFixed(1).replace('.', ',')}% da receita; alongar o prazo libera caixa todo mês.`,
    },
  ]
}

/** Análise completa do cliente logado, a partir das métricas do ERP. */
export function analiseNegocio(
  customerId: number,
  status: AnalysisStatus,
  m: MetricasNegocio,
  base: Date,
  atualizadoEm: string,
): BusinessAnalysis {
  const score = 742
  const faixa = faixaDoScore(score)
  if (status === 'EM_ANALISE') {
    return {
      customer_id: customerId,
      status,
      score: 0,
      faixa_risco: faixa,
      resumo: 'Estamos analisando os dados do seu negócio. Isso leva poucos segundos.',
      gerado_por: 'regras',
      atualizado_em: atualizadoEm,
      kpis: [],
      insights: [],
      oportunidades: [],
      pontos_fortes: [],
      riscos: [],
    }
  }
  return {
    customer_id: customerId,
    status,
    score,
    faixa_risco: faixa,
    resumo:
      'Padaria com receita acima da média do segmento, margem saudável e vendas crescentes. O ponto de atenção é o caixa de fim de ano: compras de Natal e 13º salário concentram saídas antes dos recebíveis do cartão.',
    gerado_por: 'llm+regras',
    atualizado_em: atualizadoEm,
    kpis: kpis(m),
    insights: insights(m, base),
    oportunidades: oportunidades(m, faixa),
    pontos_fortes: [
      'Receita recorrente e diversificada entre balcão, encomendas e delivery',
      'Margem bruta acima da média de padarias',
      'Histórico de pagamentos em dia com o banco',
    ],
    riscos: [
      'Vale de caixa no fim do mês por compras sazonais',
      'Estoque parado em itens de cesta e importados',
      '3 contas em atraso com fornecedores e concessionária',
    ],
  }
}

// ---------- fila de análise manual (backoffice) ----------

/** Item da fila com a análise completa (a API devolve só o resumo). */
export type ReviewRegistro = Omit<ReviewItem, 'analise'> & { analise: BusinessAnalysis | null }

interface Caso {
  customer_id: number
  empresa: Empresa
  segmento: ReviewItem['segmento']
  observacoes: string
  score: number
  gerado_por: BusinessAnalysis['gerado_por']
  resumo: string
  receita: number
  margem: number
  dividas: number
  parcelas: number
  pmr: number
  riscos: string[]
  pontos_fortes: string[]
  insight: Insight
  diasAtras: number
}

function analiseDoCaso(caso: Caso, base: Date): BusinessAnalysis {
  const faixa = faixaDoScore(caso.score)
  const kpi = (
    id: Kpi['id'],
    label: string,
    valor: number,
    unidade: Kpi['unidade'],
    leituraKpi: string,
  ): Kpi => ({
    id,
    label,
    valor,
    unidade,
    benchmark_segmento: null,
    leitura: leituraKpi,
  })
  const endividamento = r2(caso.dividas / caso.receita)
  return {
    customer_id: caso.customer_id,
    status: 'ANALISE_MANUAL',
    score: caso.score,
    faixa_risco: faixa,
    resumo: caso.resumo,
    gerado_por: caso.gerado_por,
    atualizado_em: new Date(base.getTime() - caso.diasAtras * 86_400_000 + 3_600_000).toISOString(),
    kpis: [
      kpi('receita_mensal', 'Receita mensal', caso.receita, 'BRL', 'informada no onboarding'),
      kpi('margem_bruta_pct', 'Margem bruta', caso.margem, 'PCT', 'informada no onboarding'),
      kpi(
        'prazo_medio_recebimento_dias',
        'Prazo médio de recebimento',
        caso.pmr,
        'DIAS',
        'sem benchmark',
      ),
      kpi(
        'endividamento_sobre_receita',
        'Dívida sobre receita mensal',
        endividamento,
        'X',
        endividamento > 3 ? 'acima do limite de 3×: regra crítica' : 'dentro do esperado',
      ),
      kpi(
        'comprometimento_parcelas_pct',
        'Receita comprometida com parcelas',
        r2((caso.parcelas / caso.receita) * 100),
        'PCT',
        'sem benchmark',
      ),
    ],
    insights: [caso.insight],
    oportunidades: [],
    pontos_fortes: caso.pontos_fortes,
    riscos: caso.riscos,
  }
}

function empresa(
  base12: string,
  razao: string,
  fantasia: string,
  cidade: string,
  estado: string,
  fundacao: number,
  funcionarios: number,
  email: string,
  telefone: string,
): Empresa {
  return {
    razao_social: razao,
    nome_fantasia: fantasia,
    cnpj: cnpjComDv(base12),
    email,
    telefone,
    cidade,
    estado,
    fundacao_ano: fundacao,
    funcionarios,
  }
}

const CASOS: Caso[] = [
  {
    customer_id: 2087,
    empresa: empresa(
      '318274650001',
      'Ateliê Lume Cerâmica Artesanal Ltda',
      'Ateliê Lume',
      'Florianópolis',
      'SC',
      2019,
      6,
      'contato@atelielume.com.br',
      '48991234567',
    ),
    segmento: 'outro',
    observacoes:
      'Produzimos cerâmica utilitária sob encomenda para restaurantes e lojas de decoração. Metade da receita vem de 3 restaurantes; fornos a gás com alto consumo.',
    score: 655,
    gerado_por: 'regras',
    resumo: 'Segmento "outro": fora dos templates, vai para análise manual por regra.',
    receita: 68_000,
    margem: 61,
    dividas: 42_000,
    parcelas: 2_900,
    pmr: 38,
    riscos: ['Concentração em 3 clientes', 'Prazo de recebimento longo para o porte'],
    pontos_fortes: ['Margem alta', 'Dívida baixa'],
    insight: {
      area: 'geral',
      titulo: 'Fora dos templates',
      texto: 'Cerâmica sob encomenda não tem benchmark: avalie a concentração de clientes.',
      severidade: 'info',
    },
    diasAtras: 1,
  },
  {
    customer_id: 2091,
    empresa: empresa(
      '274519830001',
      'Transportes Rota Sul Ltda',
      'Rota Sul Logística',
      'Curitiba',
      'PR',
      2012,
      48,
      'financeiro@rotasul.com.br',
      '41933221144',
    ),
    segmento: 'servicos',
    observacoes:
      'Transporte rodoviário de cargas fracionadas no Sul. Renovamos a frota em 2025 (12 cavalos mecânicos) com financiamento.',
    score: 471,
    gerado_por: 'regras',
    resumo: 'Regra crítica: dívida de 3,7× o faturamento mensal após renovação de frota.',
    receita: 520_000,
    margem: 24,
    dividas: 1_920_000,
    parcelas: 88_000,
    pmr: 45,
    riscos: ['Dívida acima de 3× o faturamento', 'Margem apertada e diesel volátil'],
    pontos_fortes: ['Frota nova', 'Contratos com 2 grandes embarcadores'],
    insight: {
      area: 'credito',
      titulo: 'Endividamento crítico',
      texto: 'Parcelas comprometem 17% da receita; qualquer novo crédito deve consolidar dívidas.',
      severidade: 'atencao',
    },
    diasAtras: 2,
  },
  {
    customer_id: 2096,
    empresa: empresa(
      '405128760001',
      'Clínica Veterinária Quatro Patas Ltda',
      'Quatro Patas 24h',
      'Ribeirão Preto',
      'SP',
      2016,
      22,
      'adm@quatropatas24h.com.br',
      '16998765432',
    ),
    segmento: 'saude',
    observacoes:
      'Hospital veterinário 24h com internação e centro cirúrgico. 40% da receita vem de planos de saúde pet, que pagam em 60 dias.',
    score: 708,
    gerado_por: 'llm+regras',
    resumo:
      'LLM classificou como ESPECIFICO (confiança 0,71): saúde animal com internação não segue o template de clínicas humanas.',
    receita: 236_000,
    margem: 47,
    dividas: 310_000,
    parcelas: 14_500,
    pmr: 31,
    riscos: ['Recebimento de planos pet em 60 dias', 'Folha alta pelo plantão 24h'],
    pontos_fortes: ['Demanda recorrente', 'Ticket alto em cirurgias'],
    insight: {
      area: 'recebiveis',
      titulo: 'Planos pet alongam o caixa',
      texto: 'Antecipação dos repasses dos planos pode reduzir o ciclo de caixa em 20 dias.',
      severidade: 'oportunidade',
    },
    diasAtras: 0,
  },
  {
    customer_id: 2102,
    empresa: empresa(
      '512903470001',
      'Vinícola Altos da Serra Ltda',
      'Altos da Serra',
      'Bento Gonçalves',
      'RS',
      2008,
      15,
      'contato@altosdaserra.com.br',
      '54996541230',
    ),
    segmento: 'agro',
    observacoes:
      'Produzimos vinhos finos e espumantes; 70% das vendas no 4º trimestre. Também fazemos enoturismo aos fins de semana.',
    score: 632,
    gerado_por: 'llm+regras',
    resumo:
      'Baixa confiança do LLM (0,52): mistura de agro, indústria e turismo; sazonalidade extrema.',
    receita: 145_000,
    margem: 52,
    dividas: 260_000,
    parcelas: 11_200,
    pmr: 28,
    riscos: ['Receita concentrada no fim do ano', 'Estoque de longa maturação'],
    pontos_fortes: ['Marca premiada', 'Margem alta'],
    insight: {
      area: 'estoque',
      titulo: 'Estoque em maturação',
      texto:
        'Vinhos em barrica imobilizam capital por 18 meses: financiamento de estoque é o produto natural.',
      severidade: 'oportunidade',
    },
    diasAtras: 3,
  },
]

/** Fila inicial de análise manual (4 empresas que não se enquadram nas regras automáticas). */
export function filaInicial(base: Date): ReviewRegistro[] {
  return CASOS.map((caso) => ({
    customer_id: caso.customer_id,
    empresa: caso.empresa,
    segmento: caso.segmento,
    observacoes: caso.observacoes,
    analise: analiseDoCaso(caso, base),
    submitted_at: new Date(base.getTime() - caso.diasAtras * 86_400_000 - 5_400_000).toISOString(),
  }))
}
