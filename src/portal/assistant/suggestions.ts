/** Telas do portal que têm perguntas próprias (as demais caem na visão geral). */
export type AssistantScreen =
  | '/app'
  | '/app/vendas'
  | '/app/recebiveis'
  | '/app/pagamentos'
  | '/app/pendencias'
  | '/app/estoque'
  | '/app/credito'

interface ScreenContext {
  /** Nome da tela, para "Sugestões para …". */
  nome: string
  /** 4 a 6 perguntas para o estado vazio. */
  perguntas: string[]
  /** Status calmos do "pensando", na ordem em que o assistente trabalha. */
  status: string[]
}

const SCREENS: Record<AssistantScreen, ScreenContext> = {
  '/app': {
    nome: 'Visão geral',
    perguntas: [
      'Quando meu caixa fica negativo, e por quê?',
      'Qual crédito resolve o vale do caixa?',
      'Como está minha receita em relação ao mês passado?',
      'O que devo resolver primeiro esta semana?',
      'Quanto tenho a receber nos próximos 90 dias?',
    ],
    status: ['Lendo o fluxo de caixa…', 'Cruzando com recebíveis e contas…'],
  },
  '/app/vendas': {
    nome: 'Vendas',
    perguntas: [
      'Quanto vendi nos últimos 30 dias?',
      'Quais produtos mais vendem?',
      'Como o crédito parcelado afeta meu prazo de recebimento?',
      'Qual canal tem o maior ticket médio?',
    ],
    status: ['Lendo suas vendas…', 'Comparando canais e formas de pagamento…'],
  },
  '/app/recebiveis': {
    nome: 'Recebíveis',
    perguntas: [
      'Quanto consigo antecipar sem apertar dezembro?',
      'Quanto tenho a receber nos próximos 90 dias?',
      'Qual adquirente concentra mais recebíveis?',
      'Vale a pena antecipar agora ou esperar?',
    ],
    status: ['Lendo seus recebíveis…', 'Simulando a antecipação…'],
  },
  '/app/pagamentos': {
    nome: 'Pagamentos',
    perguntas: [
      'Quais boletos vencem esta semana?',
      'Meu saldo cobre as contas dos próximos 7 dias?',
      'Quanto estou pagando de juros em contas atrasadas?',
      'Quais contas posso pagar com capital de giro?',
    ],
    status: ['Lendo suas contas a pagar…', 'Conferindo o saldo…'],
  },
  '/app/pendencias': {
    nome: 'Pendências',
    perguntas: [
      'Quais pendências custam mais caro se eu esperar?',
      'Como resolvo as contas atrasadas?',
      'Quais itens de estoque estão abaixo do mínimo?',
      'Tenho propostas de crédito para aceitar?',
    ],
    status: ['Lendo suas pendências…', 'Ordenando pelo custo de esperar…'],
  },
  '/app/estoque': {
    nome: 'Estoque',
    perguntas: [
      'Quais itens estão parados e quanto dinheiro eles prendem?',
      'O que preciso repor primeiro?',
      'Quanto consigo financiar com o meu estoque?',
      'Qual é a cobertura média do estoque em dias?',
    ],
    status: ['Lendo seu estoque…', 'Calculando o giro dos itens…'],
  },
  '/app/credito': {
    nome: 'Crédito',
    perguntas: [
      'Qual é o meu limite pré-aprovado hoje?',
      'Qual crédito sai mais barato para mim?',
      'Quanto pago no total em 12 parcelas de capital de giro?',
      'Antecipação ou capital de giro: qual faz mais sentido agora?',
    ],
    status: ['Lendo suas ofertas de crédito…', 'Simulando as condições…'],
  },
}

/** Último status, comum a todas as telas. */
export const STATUS_FINAL = 'Escrevendo a resposta…'

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

/** Perguntas sugeridas para a tela atual. */
export function suggestionsFor(pathname: string): string[] {
  return screenContext(pathname).perguntas
}

/** Sequência de status do "pensando" para a tela atual. */
export function thinkingStatus(pathname: string): string[] {
  return [...screenContext(pathname).status, STATUS_FINAL]
}

/** Pergunta escrita a partir de um insight (vai para o campo, sem enviar). */
export function insightQuestion(titulo: string, texto?: string) {
  const detalhe = texto?.trim() ? ` ${texto.trim().replace(/([^.!?])$/, '$1.')}` : ''
  return `Sobre "${titulo.trim()}":${detalhe} O que está causando isso e o que você recomenda?`
}
