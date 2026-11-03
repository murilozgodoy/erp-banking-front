import type {
  FormaPagamento,
  InventoryItem,
  Payable,
  PayableCategoria,
  Payment,
  Receivable,
  StatementEntry,
} from '../types'
import { r2 } from './pricing'

// ---------- utilitários determinísticos ----------

/** PRNG mulberry32: mesma semente, mesma sequência. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** `YYYY-MM-DD` no fuso local. */
export function isoDate(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

/** Meia-noite local de hoje. */
const FORMATO_SP = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Data (`YYYY-MM-DD`) de um instante no fuso de São Paulo, como as APIs calculam "hoje". */
export function dataSp(instante: Date | string = new Date()): string {
  return FORMATO_SP.format(typeof instante === 'string' ? new Date(instante) : instante)
}

/** Meia-noite (local) do dia de hoje em São Paulo. */
export function hoje(): Date {
  return parseIso(dataSp())
}

/** Instante ISO de um horário do dia em São Paulo (UTC−3, sem horário de verão desde 2019). */
export function instanteSp(data: string, minutosDoDia: number): string {
  const inicio = new Date(`${data}T00:00:00-03:00`).getTime()
  return new Date(inicio + minutosDoDia * 60_000).toISOString()
}

export function addDias(data: Date, dias: number): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias)
}

export function parseIso(valor: string): Date {
  const [ano, mes, dia] = valor.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

export function diasEntre(inicio: string, fim: string): number {
  return Math.round((parseIso(fim).getTime() - parseIso(inicio).getTime()) / 86_400_000)
}

/** Segunda-feira da semana da data (ISO). */
export function inicioSemana(valor: string): string {
  const data = parseIso(valor)
  return isoDate(addDias(data, -((data.getDay() + 6) % 7)))
}

/** Gera `n` dígitos com o PRNG. */
export function digitos(rng: () => number, n: number): string {
  return Array.from({ length: n }, () => Math.floor(rng() * 10)).join('')
}

// ---------- catálogo da padaria ----------

export interface Produto {
  sku: string
  nome: string
  preco: number
  custo: number
  /** Peso relativo na receita. */
  peso: number
}

export const PRODUTOS: Produto[] = [
  { sku: 'PAO-FRANCES-KG', nome: 'Pão francês (kg)', preco: 18.9, custo: 6.8, peso: 16 },
  { sku: 'PAO-QUEIJO-KG', nome: 'Pão de queijo (kg)', preco: 54.9, custo: 19.5, peso: 9 },
  { sku: 'CAFE-ESPRESSO', nome: 'Café espresso', preco: 6.5, custo: 1.4, peso: 7 },
  { sku: 'CAPPUCCINO', nome: 'Cappuccino', preco: 10.5, custo: 2.9, peso: 5 },
  { sku: 'CROISSANT', nome: 'Croissant de manteiga', preco: 11.9, custo: 4.1, peso: 5 },
  { sku: 'COXINHA', nome: 'Coxinha de frango', preco: 8.5, custo: 2.6, peso: 6 },
  { sku: 'MISTO-QUENTE', nome: 'Misto quente', preco: 14.9, custo: 4.8, peso: 5 },
  { sku: 'SONHO-CREME', nome: 'Sonho de creme', preco: 7.9, custo: 2.5, peso: 3 },
  { sku: 'BOLO-CENOURA', nome: 'Bolo de cenoura com chocolate', preco: 44.9, custo: 15.2, peso: 4 },
  { sku: 'TORTA-FRANGO', nome: 'Torta de frango (fatia)', preco: 13.9, custo: 4.6, peso: 3 },
  { sku: 'PAO-FORMA-ART', nome: 'Pão de forma artesanal', preco: 17.9, custo: 6.2, peso: 3 },
  { sku: 'BAGUETE', nome: 'Baguete tradicional', preco: 12.5, custo: 3.9, peso: 2 },
  { sku: 'SUCO-NATURAL', nome: 'Suco natural 400 ml', preco: 11.9, custo: 3.6, peso: 3 },
  { sku: 'BOLO-ANIV-KG', nome: 'Bolo de aniversário (kg)', preco: 94.9, custo: 34.5, peso: 6 },
  {
    sku: 'DOCINHOS-CENTO',
    nome: 'Docinhos para festa (cento)',
    preco: 129.0,
    custo: 46.0,
    peso: 4,
  },
  { sku: 'SALGADOS-CENTO', nome: 'Salgados para festa (cento)', preco: 99.0, custo: 36.0, peso: 4 },
  { sku: 'CESTA-CAFE', nome: 'Cesta de café da manhã', preco: 169.9, custo: 72.0, peso: 3 },
  { sku: 'TORTA-HOLANDESA', nome: 'Torta holandesa', preco: 84.9, custo: 31.0, peso: 2 },
  { sku: 'PANETONE-ART', nome: 'Panetone artesanal 750 g', preco: 69.9, custo: 27.0, peso: 2 },
  { sku: 'CAFE-TORRADO', nome: 'Café torrado Aurora 500 g', preco: 38.9, custo: 19.8, peso: 1.5 },
]

/** Multiplicador por dia da semana (domingo = 0): pico no fim de semana. */
const SAZONALIDADE_SEMANA = [1.3, 0.72, 0.85, 0.9, 0.95, 1.12, 1.45]

interface Canal {
  nome: string
  share: number
  ticket: number
  formas: Partial<Record<FormaPagamento, number>>
  /** Fração do crédito parcelada em 3×. */
  parcelado: number
}

const CANAIS: Canal[] = [
  {
    nome: 'Balcão',
    share: 0.58,
    ticket: 24,
    formas: { PIX: 0.32, CARTAO_DEBITO: 0.3, CARTAO_CREDITO: 0.22, DINHEIRO: 0.16 },
    parcelado: 0,
  },
  {
    nome: 'iFood',
    share: 0.2,
    ticket: 62,
    formas: { CARTAO_CREDITO: 0.72, PIX: 0.28 },
    parcelado: 0,
  },
  {
    nome: 'Encomendas',
    share: 0.14,
    ticket: 185,
    formas: { PIX: 0.5, CARTAO_CREDITO: 0.38, CARTAO_DEBITO: 0.12 },
    parcelado: 0.8,
  },
  {
    nome: 'WhatsApp',
    share: 0.08,
    ticket: 78,
    formas: { PIX: 0.7, CARTAO_CREDITO: 0.2, DINHEIRO: 0.1 },
    parcelado: 0,
  },
]

export const ADQUIRENTES = [
  { nome: 'Cielo', share: 0.45, debito: 2.09, credito: 3.19, parcelado: 3.49 },
  { nome: 'Stone', share: 0.35, debito: 1.99, credito: 2.89, parcelado: 3.29 },
  { nome: 'Rede', share: 0.2, debito: 2.19, credito: 3.09, parcelado: 3.45 },
]

export interface VendaDia {
  data: string
  valor: number
  quantidade: number
  porForma: Partial<Record<FormaPagamento, number>>
  porCanal: Record<string, number>
  porProduto: Record<string, { valor: number; quantidade: number }>
  creditoParcelado: number
}

export const DIAS_VENDAS = 120

/** Receita média de um dia da semana, antes do ajuste fino (escala 1 ≈ R$ 182 mil/mês). */
function receitaBase(data: Date, offset: number, rng: () => number): number {
  const tendencia = 1 + 0.0016 * (offset + DIAS_VENDAS)
  return 5_600 * SAZONALIDADE_SEMANA[data.getDay()] * tendencia * (0.9 + rng() * 0.2)
}

function somar(destino: Record<string, number>, chave: string, valor: number) {
  destino[chave] = (destino[chave] ?? 0) + valor
}

/** 120 dias de vendas até ontem, normalizadas para os últimos 30 dias somarem `receitaMensal`. */
export function gerarVendas(base: Date, receitaMensal: number, rng: () => number): VendaDia[] {
  const brutos: { data: Date; offset: number; valor: number }[] = []
  for (let offset = -DIAS_VENDAS; offset < 0; offset++) {
    const data = addDias(base, offset)
    brutos.push({ data, offset, valor: receitaBase(data, offset, rng) })
  }
  const ultimos30 = brutos.slice(-30).reduce((total, dia) => total + dia.valor, 0)
  const fator = receitaMensal / ultimos30
  const pesoTotal = PRODUTOS.reduce((total, produto) => total + produto.peso, 0)

  return brutos.map(({ data, valor }) => {
    const dia: VendaDia = {
      data: isoDate(data),
      valor: 0,
      quantidade: 0,
      porForma: {},
      porCanal: {},
      porProduto: {},
      creditoParcelado: 0,
    }
    const total = valor * fator
    // Ruído no mix de canais sem mudar o total do dia.
    const ruido = CANAIS.map(() => 0.92 + rng() * 0.16)
    const norma = CANAIS.reduce((soma, canal, i) => soma + canal.share * ruido[i], 0)
    for (const [i, canal] of CANAIS.entries()) {
      const valorCanal = r2((total * canal.share * ruido[i]) / norma)
      dia.valor += valorCanal
      dia.quantidade += Math.max(1, Math.round(valorCanal / canal.ticket))
      somar(dia.porCanal, canal.nome, valorCanal)
      for (const [forma, share] of Object.entries(canal.formas)) {
        somar(dia.porForma, forma, r2(valorCanal * share))
        if (forma === 'CARTAO_CREDITO')
          dia.creditoParcelado += r2(valorCanal * share * canal.parcelado)
      }
    }
    dia.valor = r2(dia.valor)
    for (const produto of PRODUTOS) {
      const valorProduto = r2(((dia.valor * produto.peso) / pesoTotal) * (0.85 + rng() * 0.3))
      dia.porProduto[produto.sku] = {
        valor: valorProduto,
        quantidade: Math.max(1, Math.round(valorProduto / produto.preco)),
      }
    }
    return dia
  })
}

// ---------- recebíveis ----------

interface LoteRecebivel {
  vencimento: string
  adquirente: string
  bruto: number
  liquido: number
}

function acumular(lotes: Map<string, LoteRecebivel>, lote: LoteRecebivel) {
  const chave = `${lote.vencimento}|${lote.adquirente}`
  const atual = lotes.get(chave)
  if (atual) {
    atual.bruto += lote.bruto
    atual.liquido += lote.liquido
  } else lotes.set(chave, { ...lote })
}

/** Recebíveis das vendas no cartão: débito D+1, crédito D+30, parcelado 3× (D+30/60/90). */
export function gerarRecebiveis(
  base: Date,
  vendas: VendaDia[],
  extras: LoteRecebivel[],
): LoteRecebivel[] {
  const lotes = new Map<string, LoteRecebivel>()
  for (const dia of vendas) {
    const data = parseIso(dia.data)
    const debito = dia.porForma.CARTAO_DEBITO ?? 0
    const credito = dia.porForma.CARTAO_CREDITO ?? 0
    const avista = credito - dia.creditoParcelado
    for (const adq of ADQUIRENTES) {
      const lote = (dias: number, valor: number, taxa: number) =>
        acumular(lotes, {
          vencimento: isoDate(addDias(data, dias)),
          adquirente: adq.nome,
          bruto: valor * adq.share,
          liquido: valor * adq.share * (1 - taxa / 100),
        })
      lote(1, debito, adq.debito)
      lote(30, avista, adq.credito)
      for (const dias of [30, 60, 90]) lote(dias, dia.creditoParcelado / 3, adq.parcelado)
    }
  }
  for (const extra of extras) acumular(lotes, extra)
  const limite = isoDate(addDias(base, 90))
  return [...lotes.values()]
    .filter((lote) => lote.vencimento <= limite)
    .map((lote) => ({ ...lote, bruto: r2(lote.bruto), liquido: r2(lote.liquido) }))
    .sort(
      (a, b) =>
        a.vencimento.localeCompare(b.vencimento) || a.adquirente.localeCompare(b.adquirente),
    )
}

// ---------- contas a pagar ----------

interface Recorrencia {
  fornecedor: string
  categoria: PayableCategoria
  valor: number
  /** Primeiro vencimento (dias a partir de hoje, negativo = passado). */
  inicio: number
  /** Intervalo em dias; 0 = conta única. */
  cada: number
  /** Offsets que ficaram em atraso. */
  atrasados?: number[]
}

/** Agenda de contas (escala 1). Inclui as compras de fim de ano que criam o vale de caixa. */
export const RECORRENCIAS: Recorrencia[] = [
  {
    fornecedor: 'Folha de pagamento — salários',
    categoria: 'FOLHA',
    valor: 23_100,
    inicio: -26,
    cada: 30,
  },
  {
    fornecedor: 'Folha de pagamento — adiantamento',
    categoria: 'FOLHA',
    valor: 15_400,
    inicio: -11,
    cada: 30,
  },
  { fornecedor: 'FGTS Digital', categoria: 'IMPOSTO', valor: 3_080, inicio: -23, cada: 30 },
  {
    fornecedor: 'DAS Simples Nacional',
    categoria: 'IMPOSTO',
    valor: 15_480,
    inicio: -13,
    cada: 30,
  },
  {
    fornecedor: 'Imobiliária Cambuí — aluguel',
    categoria: 'ALUGUEL',
    valor: 12_000,
    inicio: -20,
    cada: 30,
  },
  {
    fornecedor: 'CPFL Energia',
    categoria: 'SERVICOS',
    valor: 5_812.37,
    inicio: -3,
    cada: 30,
    atrasados: [-3],
  },
  { fornecedor: 'Comgás', categoria: 'SERVICOS', valor: 3_240.9, inicio: -8, cada: 30 },
  {
    fornecedor: 'Sanasa — água e esgoto',
    categoria: 'SERVICOS',
    valor: 1_092.44,
    inicio: -16,
    cada: 30,
  },
  { fornecedor: 'Contabilidade Exata', categoria: 'SERVICOS', valor: 1_450, inicio: -24, cada: 30 },
  {
    fornecedor: 'Banco Horizonte — parcela capital de giro',
    categoria: 'EMPRESTIMO',
    valor: 9_800,
    inicio: -15,
    cada: 30,
  },
  {
    fornecedor: 'Moinho Paulista',
    categoria: 'FORNECEDOR',
    valor: 9_240,
    inicio: -20,
    cada: 15,
    atrasados: [-5],
  },
  {
    fornecedor: 'Laticínios Serra Azul',
    categoria: 'FORNECEDOR',
    valor: 3_480.6,
    inicio: -28,
    cada: 7,
  },
  {
    fornecedor: 'Hortifruti Campinas',
    categoria: 'FORNECEDOR',
    valor: 1_384.2,
    inicio: -25,
    cada: 7,
  },
  {
    fornecedor: 'Granja Santa Clara — ovos',
    categoria: 'FORNECEDOR',
    valor: 1_256,
    inicio: -26,
    cada: 7,
  },
  {
    fornecedor: 'Distribuidora Taquaral — bebidas',
    categoria: 'FORNECEDOR',
    valor: 2_652.8,
    inicio: -22,
    cada: 14,
  },
  {
    fornecedor: 'Açúcar & Cia Distribuidora',
    categoria: 'FORNECEDOR',
    valor: 2_118.5,
    inicio: -19,
    cada: 14,
  },
  {
    fornecedor: 'Embalagens Ideal',
    categoria: 'FORNECEDOR',
    valor: 1_964.3,
    inicio: -23,
    cada: 14,
    atrasados: [-9],
  },
  {
    fornecedor: 'Torrefação Bom Grão',
    categoria: 'FORNECEDOR',
    valor: 2_904,
    inicio: -18,
    cada: 30,
  },
  // Compras de fim de ano e 13º: concentram as saídas entre o 15º e o 25º dia.
  {
    fornecedor: 'Moinho Paulista — insumos de Natal',
    categoria: 'FORNECEDOR',
    valor: 15_600,
    inicio: 16,
    cada: 0,
  },
  {
    fornecedor: 'Embalagens Ideal — linha de Natal',
    categoria: 'FORNECEDOR',
    valor: 7_850,
    inicio: 18,
    cada: 0,
  },
  {
    fornecedor: 'Chocolates Vale Doce — panetones',
    categoria: 'FORNECEDOR',
    valor: 14_320,
    inicio: 20,
    cada: 0,
  },
  {
    fornecedor: 'Folha de pagamento — 13º salário (1ª parcela)',
    categoria: 'FOLHA',
    valor: 19_250,
    inicio: 22,
    cada: 0,
  },
]

const SEM_BOLETO: PayableCategoria[] = ['FOLHA']
/** Contas recorrentes em débito automático/agendadas. */
const AGENDADAS = ['Imobiliária Cambuí — aluguel', 'Banco Horizonte — parcela capital de giro']

export function linhaDigitavel(rng: () => number): string {
  return digitos(rng, 47)
}

export function gerarContas(base: Date, escala: number, rng: () => number): Payable[] {
  const contas: Payable[] = []
  let id = 5001
  for (const rec of RECORRENCIAS) {
    const offsets: number[] = []
    if (rec.cada === 0) offsets.push(rec.inicio)
    else for (let o = rec.inicio; o < 60; o += rec.cada) if (o >= -30) offsets.push(o)
    for (const offset of offsets) {
      const vencimento = isoDate(addDias(base, offset))
      const atrasado = rec.atrasados?.includes(offset) ?? false
      let status: Payable['status'] = 'ABERTO'
      if (offset < 0) status = atrasado ? 'ATRASADO' : 'PAGO'
      else if (AGENDADAS.includes(rec.fornecedor)) status = 'AGENDADO'
      // Variação pequena nos fornecedores, para não parecer planilha.
      const variacao = rec.categoria === 'FORNECEDOR' && rec.cada > 0 ? 0.94 + rng() * 0.12 : 1
      contas.push({
        id: id++,
        fornecedor: rec.fornecedor,
        categoria: rec.categoria,
        vencimento,
        valor: r2(rec.valor * escala * variacao),
        status,
        codigo_barras: SEM_BOLETO.includes(rec.categoria) ? null : linhaDigitavel(rng),
        pago_em: status === 'PAGO' ? vencimento : null,
      })
    }
  }
  return contas.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.id - b.id)
}

// ---------- estoque ----------

interface ItemEstoque {
  sku: string
  nome: string
  quantidade: number
  minimo: number
  custo: number
  preco: number
  giro: number
  /** Dias desde a última venda (null = nunca vendeu). */
  ultimaVenda: number | null
}

const ESTOQUE: ItemEstoque[] = [
  {
    sku: 'PANETONE-ART',
    nome: 'Panetone artesanal 750 g',
    quantidade: 38,
    minimo: 120,
    custo: 27,
    preco: 69.9,
    giro: 9,
    ultimaVenda: 0,
  },
  {
    sku: 'CAFE-TORRADO',
    nome: 'Café torrado Aurora 500 g',
    quantidade: 14,
    minimo: 40,
    custo: 19.8,
    preco: 38.9,
    giro: 12,
    ultimaVenda: 0,
  },
  {
    sku: 'CHOCOTONE-500',
    nome: 'Chocotone 500 g',
    quantidade: 22,
    minimo: 80,
    custo: 21.5,
    preco: 54.9,
    giro: 11,
    ultimaVenda: 1,
  },
  {
    sku: 'REFRI-LATA',
    nome: 'Refrigerante lata 350 ml (fardo 12)',
    quantidade: 6,
    minimo: 15,
    custo: 31.2,
    preco: 66,
    giro: 6,
    ultimaVenda: 0,
  },
  {
    sku: 'AGUA-500',
    nome: 'Água mineral 500 ml (fardo 12)',
    quantidade: 18,
    minimo: 10,
    custo: 14.4,
    preco: 36,
    giro: 8,
    ultimaVenda: 0,
  },
  {
    sku: 'SUCO-INTEGRAL',
    nome: 'Suco de uva integral 1 L',
    quantidade: 46,
    minimo: 24,
    custo: 12.9,
    preco: 24.9,
    giro: 21,
    ultimaVenda: 2,
  },
  {
    sku: 'GELEIA-MORANGO',
    nome: 'Geleia artesanal de morango',
    quantidade: 34,
    minimo: 15,
    custo: 13.5,
    preco: 29.9,
    giro: 38,
    ultimaVenda: 3,
  },
  {
    sku: 'DOCE-LEITE',
    nome: 'Doce de leite artesanal 400 g',
    quantidade: 41,
    minimo: 20,
    custo: 11.8,
    preco: 26.9,
    giro: 29,
    ultimaVenda: 1,
  },
  {
    sku: 'BISCOITO-AMANT',
    nome: 'Biscoito amanteigado (pote)',
    quantidade: 58,
    minimo: 30,
    custo: 9.6,
    preco: 24.5,
    giro: 18,
    ultimaVenda: 0,
  },
  {
    sku: 'GRANOLA-ART',
    nome: 'Granola artesanal 500 g',
    quantidade: 27,
    minimo: 15,
    custo: 14.2,
    preco: 32.9,
    giro: 34,
    ultimaVenda: 2,
  },
  {
    sku: 'MEL-SILVESTRE',
    nome: 'Mel silvestre 300 g',
    quantidade: 30,
    minimo: 12,
    custo: 16.4,
    preco: 34.9,
    giro: 47,
    ultimaVenda: 4,
  },
  {
    sku: 'CHOC-BARRA',
    nome: 'Chocolate nobre em barra 100 g',
    quantidade: 96,
    minimo: 40,
    custo: 7.9,
    preco: 16.9,
    giro: 25,
    ultimaVenda: 0,
  },
  {
    sku: 'QUEIJO-MINAS-KG',
    nome: 'Queijo minas padrão (kg)',
    quantidade: 32,
    minimo: 20,
    custo: 39.5,
    preco: 69.9,
    giro: 9,
    ultimaVenda: 0,
  },
  {
    sku: 'PRESUNTO-KG',
    nome: 'Presunto cozido (kg)',
    quantidade: 25,
    minimo: 15,
    custo: 32.8,
    preco: 59.9,
    giro: 7,
    ultimaVenda: 0,
  },
  {
    sku: 'IOGURTE-NAT',
    nome: 'Iogurte natural 170 g',
    quantidade: 64,
    minimo: 40,
    custo: 3.1,
    preco: 6.9,
    giro: 6,
    ultimaVenda: 0,
  },
  {
    sku: 'PAO-MEL',
    nome: 'Pão de mel recheado',
    quantidade: 120,
    minimo: 60,
    custo: 2.7,
    preco: 7.5,
    giro: 14,
    ultimaVenda: 0,
  },
  {
    sku: 'CAIXA-BOLO',
    nome: 'Caixa para bolo 30 cm',
    quantidade: 420,
    minimo: 200,
    custo: 3.4,
    preco: 6.9,
    giro: 41,
    ultimaVenda: 1,
  },
  // Parados: giro > 120 dias.
  {
    sku: 'COLOMBA-PASCAL',
    nome: 'Colomba pascal 500 g',
    quantidade: 64,
    minimo: 0,
    custo: 24.5,
    preco: 59.9,
    giro: 196,
    ultimaVenda: 188,
  },
  {
    sku: 'VINHO-RESERVA',
    nome: 'Vinho tinto reserva (cestas)',
    quantidade: 72,
    minimo: 12,
    custo: 48.9,
    preco: 99.9,
    giro: 164,
    ultimaVenda: 61,
  },
  {
    sku: 'AZEITE-EV-500',
    nome: 'Azeite extravirgem 500 ml',
    quantidade: 88,
    minimo: 12,
    custo: 36.7,
    preco: 64.9,
    giro: 142,
    ultimaVenda: 33,
  },
  {
    sku: 'CESTA-VIME',
    nome: 'Cesta de vime para presente',
    quantidade: 145,
    minimo: 30,
    custo: 28.6,
    preco: 54.9,
    giro: 210,
    ultimaVenda: 96,
  },
  {
    sku: 'GELEIA-DAMASCO',
    nome: 'Geleia de damasco importada',
    quantidade: 52,
    minimo: 6,
    custo: 22.4,
    preco: 45.9,
    giro: 133,
    ultimaVenda: 47,
  },
]

export function gerarEstoque(base: Date, escala: number): InventoryItem[] {
  return ESTOQUE.map((item, index) => ({
    id: index + 1,
    sku: item.sku,
    nome: item.nome,
    quantidade: Math.max(1, Math.round(item.quantidade * 2 * escala)),
    minimo: Math.round(item.minimo * 2 * escala),
    custo_unitario: item.custo,
    preco_venda: item.preco,
    giro_dias: item.giro,
    ultima_venda: item.ultimaVenda === null ? null : isoDate(addDias(base, -item.ultimaVenda)),
    // Consumo diário estimado pelo giro sobre o estoque "cheio" (o maior entre saldo e mínimo).
    cobertura_dias: Math.round(
      (item.giro * item.quantidade) / Math.max(item.quantidade, item.minimo),
    ),
    abaixo_minimo: item.quantidade < item.minimo,
    parado: item.giro > 90,
  }))
}

// ---------- extrato e pagamentos passados ----------

export function autenticacao(rng: () => number): string {
  const hex = () =>
    Math.floor(rng() * 0x10000)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0')
  return Array.from({ length: 8 }, hex).join('-')
}

interface Lancamento {
  data: string
  descricao: string
  tipo: StatementEntry['tipo']
  valor: number
}

/**
 * Extrato dos últimos 30 dias: PIX recebidos, depósitos de dinheiro, liquidações das adquirentes e
 * contas pagas. O saldo é calculado de trás para frente, terminando no saldo atual.
 */
export function gerarExtrato(
  base: Date,
  saldoAtual: number,
  vendas: VendaDia[],
  lotes: LoteRecebivel[],
  contas: Payable[],
): StatementEntry[] {
  const inicio = isoDate(addDias(base, -30))
  const fim = isoDate(base)
  const lancamentos: Lancamento[] = []
  let dinheiroAcumulado = 0
  for (const dia of vendas) {
    if (dia.data < inicio) continue
    lancamentos.push({
      data: dia.data,
      descricao: 'Recebimentos PIX do dia',
      tipo: 'CREDIT',
      valor: r2(dia.porForma.PIX ?? 0),
    })
    dinheiroAcumulado += dia.porForma.DINHEIRO ?? 0
    // Depósito do caixa em espécie às segundas e quintas.
    const semana = parseIso(dia.data).getDay()
    if (semana === 1 || semana === 4) {
      lancamentos.push({
        data: dia.data,
        descricao: 'Depósito em dinheiro',
        tipo: 'CREDIT',
        valor: r2(dinheiroAcumulado),
      })
      dinheiroAcumulado = 0
    }
  }
  for (const lote of lotes) {
    if (lote.vencimento < inicio || lote.vencimento >= fim) continue
    lancamentos.push({
      data: lote.vencimento,
      descricao: `Liquidação ${lote.adquirente}`,
      tipo: 'CREDIT',
      valor: lote.liquido,
    })
  }
  for (const conta of contas) {
    if (conta.status !== 'PAGO' || !conta.pago_em || conta.pago_em < inicio) continue
    const meio = conta.categoria === 'FOLHA' ? 'TED' : 'Pagamento de boleto'
    lancamentos.push({
      data: conta.pago_em,
      descricao: `${meio} — ${conta.fornecedor}`,
      tipo: 'DEBIT',
      valor: conta.valor,
    })
  }
  // Dentro do dia: créditos antes dos débitos.
  lancamentos.sort(
    (a, b) =>
      a.data.localeCompare(b.data) || (a.tipo === b.tipo ? 0 : a.tipo === 'CREDIT' ? -1 : 1),
  )
  // Horário: a partir das 8h, um lançamento a cada 20 minutos dentro do dia.
  const horarios: string[] = []
  let ordemNoDia = 0
  lancamentos.forEach((lancamento, i) => {
    const ordem = i > 0 && lancamentos[i - 1].data === lancamento.data ? ordemNoDia + 1 : 0
    ordemNoDia = ordem
    horarios.push(instanteSp(lancamento.data, 8 * 60 + ordem * 20))
  })
  let saldo = saldoAtual
  const comSaldo: StatementEntry[] = []
  // Mais recente primeiro, como a API.
  for (let i = lancamentos.length - 1; i >= 0; i--) {
    const lancamento = lancamentos[i]
    comSaldo.push({ id: 9000 + i, ...lancamento, data: horarios[i], saldo_apos: r2(saldo) })
    saldo += lancamento.tipo === 'CREDIT' ? -lancamento.valor : lancamento.valor
  }
  return comSaldo
}

export function gerarPagamentos(contas: Payable[], rng: () => number): Payment[] {
  return contas
    .filter((conta) => conta.status === 'PAGO')
    .map((conta, indice) => ({
      id: 7001 + indice,
      tipo: conta.categoria === 'FOLHA' ? 'TED' : 'BOLETO',
      destinatario: conta.fornecedor,
      valor: conta.valor,
      descricao: conta.categoria === 'FOLHA' ? 'Pagamento da folha' : 'Pagamento de boleto',
      payable_id: conta.id,
      agendado_para: null,
      codigo_barras: conta.codigo_barras,
      status: 'EFETIVADO' as const,
      autenticacao: autenticacao(rng),
      criado_em: instanteSp(conta.pago_em as string, 9 * 60 + 10 + (indice % 50)),
    }))
}

export type { LoteRecebivel }

/** Recebíveis no formato da API, com status pela data. */
export function paraRecebiveis(base: Date, lotes: LoteRecebivel[]): Receivable[] {
  const fim = isoDate(base)
  const corte = isoDate(addDias(base, -15))
  return lotes
    .filter((lote) => lote.vencimento >= corte)
    .map((lote, indice) => ({
      id: 3001 + indice,
      vencimento: lote.vencimento,
      valor_bruto: lote.bruto,
      valor_liquido: lote.liquido,
      adquirente: lote.adquirente,
      status: lote.vencimento < fim ? 'RECEBIDO' : 'PREVISTO',
    }))
}
