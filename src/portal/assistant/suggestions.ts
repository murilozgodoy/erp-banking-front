/** Telas do portal que têm perguntas próprias (as demais caem na visão geral). */
export type AssistantScreen =
  | '/app'
  | '/app/vendas'
  | '/app/recebiveis'
  | '/app/pagamentos'
  | '/app/pendencias'
  | '/app/estoque'
  | '/app/credito'

/** Ícone da sugestão (mapeado para lucide no painel). */
export type SugestaoIcone =
  | 'trend'
  | 'alert'
  | 'credit'
  | 'list'
  | 'calendar'
  | 'package'
  | 'store'
  | 'wallet'
  | 'receipt'
  | 'chat'

/** Sugestão do estado vazio: rótulo curto no chip, pergunta completa no envio. */
export interface Sugestao {
  label: string
  pergunta: string
  icone: SugestaoIcone
}

interface ScreenContext {
  nome: string
  /** 4 a 6 sugestões para o estado vazio. */
  sugestoes: Sugestao[]
}

const s = (icone: SugestaoIcone, label: string, pergunta: string): Sugestao => ({
  label,
  pergunta,
  icone,
})

const SCREENS: Record<AssistantScreen, ScreenContext> = {
  '/app': {
    nome: 'Visão geral',
    sugestoes: [
      s('alert', 'Vale de caixa', 'Quando meu caixa fica negativo, e por quê?'),
      s('credit', 'Crédito para o vale', 'Qual crédito resolve o vale do caixa?'),
      s('trend', 'Receita do mês', 'Como está minha receita em relação ao mês passado?'),
      s('list', 'Prioridades da semana', 'O que devo resolver primeiro esta semana?'),
      s('calendar', 'A receber em 90 dias', 'Quanto tenho a receber nos próximos 90 dias?'),
    ],
  },
  '/app/vendas': {
    nome: 'Vendas',
    sugestoes: [
      s('trend', 'Vendas em 30 dias', 'Quanto vendi nos últimos 30 dias?'),
      s('package', 'Mais vendidos', 'Quais produtos mais vendem?'),
      s(
        'calendar',
        'Efeito do parcelado',
        'Como o crédito parcelado afeta meu prazo de recebimento?',
      ),
      s('store', 'Ticket por canal', 'Qual canal tem o maior ticket médio?'),
    ],
  },
  '/app/recebiveis': {
    nome: 'Recebíveis',
    sugestoes: [
      s('wallet', 'Quanto antecipar', 'Quanto consigo antecipar sem apertar dezembro?'),
      s('calendar', 'Vencimentos da semana', 'Quais recebíveis vencem esta semana?'),
      s('alert', 'Vale de caixa', 'Quando meu caixa fica negativo, e por quê?'),
      s('store', 'Por adquirente', 'Qual adquirente concentra mais recebíveis?'),
      s('credit', 'Antecipar ou esperar', 'Vale a pena antecipar agora ou esperar?'),
    ],
  },
  '/app/pagamentos': {
    nome: 'Pagamentos',
    sugestoes: [
      s('calendar', 'Boletos da semana', 'Quais boletos vencem esta semana?'),
      s('wallet', 'O saldo cobre?', 'Meu saldo cobre as contas dos próximos 7 dias?'),
      s('alert', 'Juros em atraso', 'Quanto estou pagando de juros em contas atrasadas?'),
      s('credit', 'Pagar com giro', 'Quais contas posso pagar com capital de giro?'),
    ],
  },
  '/app/pendencias': {
    nome: 'Pendências',
    sugestoes: [
      s('alert', 'O que custa mais', 'Quais pendências custam mais caro se eu esperar?'),
      s('receipt', 'Contas atrasadas', 'Como resolvo as contas atrasadas?'),
      s('package', 'Estoque baixo', 'Quais itens de estoque estão abaixo do mínimo?'),
      s('credit', 'Propostas de crédito', 'Tenho propostas de crédito para aceitar?'),
    ],
  },
  '/app/estoque': {
    nome: 'Estoque',
    sugestoes: [
      s('package', 'Itens parados', 'Quais itens estão parados e quanto dinheiro eles prendem?'),
      s('alert', 'O que repor', 'O que preciso repor primeiro?'),
      s('credit', 'Financiar estoque', 'Quanto consigo financiar com o meu estoque?'),
      s('calendar', 'Cobertura em dias', 'Qual é a cobertura média do estoque em dias?'),
    ],
  },
  '/app/credito': {
    nome: 'Crédito',
    sugestoes: [
      s('credit', 'Meu limite hoje', 'Qual é o meu limite pré-aprovado hoje?'),
      s('trend', 'Crédito mais barato', 'Qual crédito sai mais barato para mim?'),
      s(
        'receipt',
        '12 parcelas de giro',
        'Quanto pago no total em 12 parcelas de capital de giro?',
      ),
      s(
        'wallet',
        'Antecipar ou giro',
        'Antecipação ou capital de giro: qual faz mais sentido agora?',
      ),
    ],
  },
}

/** Tela do assistente para um pathname (`/app/recebiveis/` → `/app/recebiveis`). */
export function screenFor(pathname: string): AssistantScreen {
  const clean = pathname.replace(/\/+$/, '') || '/app'
  const match = (Object.keys(SCREENS) as AssistantScreen[])
    .filter((screen) => screen !== '/app')
    .find((screen) => clean === screen || clean.startsWith(`${screen}/`))
  return match ?? '/app'
}

export function screenContext(pathname: string): ScreenContext {
  return SCREENS[screenFor(pathname)]
}

/** Sugestões do estado vazio para a tela atual. */
export function suggestionsFor(pathname: string): Sugestao[] {
  return screenContext(pathname).sugestoes
}

const ICONE_POR_PALAVRA: [SugestaoIcone, RegExp][] = [
  ['alert', /negativ|vale|atras|juros|risco|pendenc/],
  ['wallet', /antecip|saldo|receb/],
  ['calendar', /venc|semana|prazo|dia|mes/],
  ['package', /estoque|ite(m|ns)|produto|repor/],
  ['credit', /credito|limite|taxa|giro|parcela|emprest|custa/],
  ['trend', /vend|receita|ticket|fluxo|caixa/],
  ['store', /canal|adquirente|fornecedor/],
]

/** Ícone para uma pergunta solta (sugestões que vêm da resposta). */
export function iconFor(pergunta: string): SugestaoIcone {
  const texto = pergunta
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  return ICONE_POR_PALAVRA.find(([, regex]) => regex.test(texto))?.[0] ?? 'chat'
}

/** Pergunta escrita a partir de um insight (vai para o campo, sem enviar). */
export function insightQuestion(titulo: string, texto?: string) {
  const detalhe = texto?.trim() ? ` ${texto.trim().replace(/([^.!?])$/, '$1.')}` : ''
  return `Sobre "${titulo.trim()}":${detalhe} O que está causando isso e o que você recomenda?`
}
