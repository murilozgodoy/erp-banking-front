import { delay, http, HttpResponse, type HttpHandler } from 'msw'

import { dayMonth, money, pct } from '../lib/format'
import { screenFor } from '../assistant/suggestions'
import type { AssistantRequest, AssistantResponse, ProdutoCredito } from '../types'
import { PRODUTO_LABEL, simulatorHref } from '../ui/credit'
import * as db from './db'

/**
 * Mock do `POST /me/assistant/messages` (Score, seção 9): respostas prontas, mas com os números
 * do banco em memória, escolhidas pela pergunta e, sem palavra-chave, pela tela (`rota`).
 *
 * Para testar erros, inclua na pergunta `[503]`, `[429]`, `[409]` ou `[500]`.
 */

const MAX_MESSAGES = 20
const MAX_CHARS = 2000

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

const brl = (valor: number) => money(valor).replace(/\s/g, ' ')
const milhar = (valor: number) => Math.ceil(valor / 1000) * 1000

type Topico =
  'caixa' | 'recebiveis' | 'estoque' | 'pagamentos' | 'vendas' | 'pendencias' | 'credito'

const PALAVRAS: [Topico, RegExp][] = [
  ['estoque', /estoque|parad|repor|\bitens\b/],
  ['recebiveis', /antecip|receb|adquirente/],
  ['pagamentos', /boleto|pagar|pagament|contas?\b|venc|juros|saldo cobre/],
  ['pendencias', /pendenc|resolver|primeiro/],
  ['caixa', /caixa|negativ|vale|fluxo/],
  ['vendas', /vend|ticket|canal|produto|receita/],
  ['credito', /credito|limite|taxa|emprest|parcela|capital/],
]

const POR_TELA: Record<ReturnType<typeof screenFor>, Topico> = {
  '/app': 'caixa',
  '/app/vendas': 'vendas',
  '/app/recebiveis': 'recebiveis',
  '/app/pagamentos': 'pagamentos',
  '/app/pendencias': 'pendencias',
  '/app/estoque': 'estoque',
  '/app/credito': 'credito',
}

function topico(pergunta: string, rota?: string): Topico {
  const texto = normalizar(pergunta)
  return PALAVRAS.find(([, regex]) => regex.test(texto))?.[0] ?? POR_TELA[screenFor(rota ?? '/app')]
}

function limite(produto: ProdutoCredito) {
  return db.ofertas().find((oferta) => oferta.produto === produto)
}

function caixa(): AssistantResponse {
  const { fluxo_caixa, saldo } = db.overview()
  const negativo = fluxo_caixa.find((dia) => dia.saldo_projetado < 0)
  const vale = Math.min(...fluxo_caixa.map((dia) => dia.saldo_projetado))
  if (!negativo) {
    return {
      resposta: `Seu caixa **não fica negativo** nos próximos 60 dias. O menor saldo projetado é de **${brl(vale)}**, partindo de ${brl(saldo)} hoje.\n\nMesmo assim, vale acompanhar as contas a pagar da semana.`,
      sugestoes: [
        'Quais boletos vencem esta semana?',
        'Quanto tenho a receber nos próximos 90 dias?',
      ],
      fontes: [{ tipo: 'overview', label: 'Visão geral' }],
      acoes: [{ label: 'Ver pagamentos', rota: '/app/pagamentos' }],
    }
  }
  const valor = milhar(-vale)
  return {
    resposta: [
      `Seu caixa fica negativo em **${dayMonth(negativo.data)}** e chega a **${brl(vale)}** no pior dia.`,
      'O motivo é a concentração de saídas antes da entrada dos recebíveis:',
      `- Saldo hoje: ${brl(saldo)}`,
      `- Saídas no dia em que vira: ${brl(negativo.saidas)}`,
      `- Entradas no mesmo dia: ${brl(negativo.entradas)}`,
      `Antecipar **${brl(valor)}** de recebíveis cobre o vale sem mexer no seu limite de capital de giro.`,
    ].join('\n\n'),
    sugestoes: [
      'Quanto consigo antecipar sem apertar dezembro?',
      'Qual crédito resolve o vale do caixa?',
      'Quais boletos vencem esta semana?',
    ],
    fontes: [
      { tipo: 'overview', label: 'Visão geral' },
      { tipo: 'recebiveis', label: 'Recebíveis' },
    ],
    acoes: [{ label: 'Simular antecipação', rota: simulatorHref('ANTECIPACAO_RECEBIVEIS', valor) }],
  }
}

function recebiveis(): AssistantResponse {
  const { total_previsto, por_semana } = db.recebiveis({ status: 'PREVISTO' })
  const oferta = limite('ANTECIPACAO_RECEBIVEIS')
  const pico = [...por_semana].sort((a, b) => b.valor - a.valor)[0]
  const sugerido = oferta ? Math.min(oferta.limite, milhar(total_previsto * 0.35)) : 0
  return {
    resposta: [
      `Você tem **${brl(total_previsto)}** em recebíveis previstos.${pico ? ` A semana mais forte começa em ${dayMonth(pico.semana)}, com ${brl(pico.valor)}.` : ''}`,
      oferta
        ? `Seu limite de antecipação é de **${brl(oferta.limite)}**, a partir de ${pct(oferta.taxa_mensal_a_partir, 2)} ao mês. Antecipar até **${brl(sugerido)}** mantém a maior parte das entradas de dezembro.`
        : 'No momento não há limite de antecipação disponível para a sua empresa.',
    ].join('\n\n'),
    sugestoes: [
      'Qual adquirente concentra mais recebíveis?',
      'Quando meu caixa fica negativo, e por quê?',
    ],
    fontes: [
      { tipo: 'recebiveis', label: 'Recebíveis' },
      { tipo: 'credito', label: 'Ofertas de crédito' },
    ],
    acoes: oferta
      ? [{ label: 'Simular antecipação', rota: simulatorHref('ANTECIPACAO_RECEBIVEIS', sugerido) }]
      : [{ label: 'Ver recebíveis', rota: '/app/recebiveis' }],
  }
}

function estoque(): AssistantResponse {
  const relatorio = db.estoque()
  const parados = relatorio.itens
    .filter((item) => item.giro_dias > 90)
    .map((item) => ({ ...item, valor: item.quantidade * item.custo_unitario }))
    .sort((a, b) => b.valor - a.valor)
  const oferta = limite('FINANCIAMENTO_ESTOQUE')
  return {
    resposta: [
      `Há **${brl(relatorio.valor_parado)}** parados em ${parados.length} itens com giro acima de 90 dias.`,
      ...parados
        .slice(0, 3)
        .map((item) => `- ${item.nome}: ${brl(item.valor)} (giro de ${item.giro_dias} dias)`),
      `${relatorio.abaixo_minimo} itens estão abaixo do mínimo. Uma promoção nos parados libera caixa para repor esses itens.`,
    ].join('\n'),
    sugestoes: ['O que preciso repor primeiro?', 'Quanto consigo financiar com o meu estoque?'],
    fontes: [{ tipo: 'estoque', label: 'Estoque' }],
    acoes: [
      { label: 'Ver estoque', rota: '/app/estoque' },
      ...(oferta
        ? [
            {
              label: 'Simular financiamento de estoque',
              rota: simulatorHref('FINANCIAMENTO_ESTOQUE', oferta.limite),
            },
          ]
        : []),
    ],
  }
}

function pagamentos(): AssistantResponse {
  const contas = db.contas(null)
  const { saldo } = db.overview()
  const cobre = saldo >= contas.proximos_7d
  return {
    resposta: [
      `Nos próximos 7 dias vencem **${brl(contas.proximos_7d)}** em contas. Seu saldo é de ${brl(saldo)}: ${cobre ? '**cobre** tudo.' : `**faltam ${brl(contas.proximos_7d - saldo)}**.`}`,
      contas.total_atrasado > 0
        ? `Você também tem ${brl(contas.total_atrasado)} em contas atrasadas, que acumulam juros a cada dia.`
        : 'Não há contas atrasadas.',
    ].join('\n\n'),
    sugestoes: [
      'Quanto estou pagando de juros em contas atrasadas?',
      'Quais contas posso pagar com capital de giro?',
    ],
    fontes: [
      { tipo: 'pagamentos', label: 'Pagamentos' },
      { tipo: 'overview', label: 'Visão geral' },
    ],
    acoes: [{ label: 'Ver contas a pagar', rota: '/app/pagamentos' }],
  }
}

function vendas(): AssistantResponse {
  const relatorio = db.vendas({})
  const forma = relatorio.por_forma_pagamento[0]
  const top = relatorio.top_produtos.slice(0, 3)
  return {
    resposta: [
      `Nos últimos 30 dias você vendeu **${brl(relatorio.total)}**, com ticket médio de ${brl(relatorio.ticket_medio)}.`,
      forma
        ? `A forma de pagamento que mais pesa é ${forma.forma.toLowerCase().replace(/_/g, ' ')}, com ${pct(forma.pct)} das vendas.`
        : '',
      top.length ? 'Os produtos que mais vendem:' : '',
      ...top.map((produto, index) => `${index + 1}. ${produto.nome}: ${brl(produto.valor)}`),
    ]
      .filter(Boolean)
      .join('\n'),
    sugestoes: [
      'Como o crédito parcelado afeta meu prazo de recebimento?',
      'Quanto consigo antecipar sem apertar dezembro?',
    ],
    fontes: [{ tipo: 'vendas', label: 'Vendas' }],
    acoes: [{ label: 'Ver vendas', rota: '/app/vendas' }],
  }
}

function pendencias(): AssistantResponse {
  const lista = db.pendencias()
  return {
    resposta: lista.length
      ? [
          `Você tem **${lista.length} pendências**. As que pedem atenção primeiro:`,
          ...lista.slice(0, 3).map((item) => `- **${item.titulo}**: ${item.descricao}`),
        ].join('\n')
      : 'Você não tem pendências abertas.',
    sugestoes: ['Como resolvo as contas atrasadas?', 'Tenho propostas de crédito para aceitar?'],
    fontes: [{ tipo: 'pendencias', label: 'Pendências' }],
    acoes: [{ label: 'Ver pendências', rota: '/app/pendencias' }],
  }
}

function credito(): AssistantResponse {
  const ofertas = [...db.ofertas()].sort((a, b) => a.taxa_mensal_a_partir - b.taxa_mensal_a_partir)
  if (!ofertas.length) {
    return {
      resposta: 'No momento a ErpIa não tem ofertas de crédito pré-aprovadas para a sua empresa.',
      sugestoes: ['O que devo resolver primeiro esta semana?'],
      fontes: [{ tipo: 'credito', label: 'Ofertas de crédito' }],
      acoes: [],
    }
  }
  const melhor = ofertas[0]
  return {
    resposta: [
      'Seus limites pré-aprovados hoje:',
      ...ofertas.map(
        (oferta) =>
          `- ${PRODUTO_LABEL[oferta.produto]}: **${brl(oferta.limite)}**, a partir de ${pct(oferta.taxa_mensal_a_partir, 2)} ao mês, em até ${oferta.prazo_max_meses} meses`,
      ),
      '',
      `O mais barato é **${PRODUTO_LABEL[melhor.produto].toLowerCase()}**.`,
    ].join('\n'),
    sugestoes: [
      'Quanto pago no total em 12 parcelas de capital de giro?',
      'Antecipação ou capital de giro: qual faz mais sentido agora?',
    ],
    fontes: [
      { tipo: 'credito', label: 'Ofertas de crédito' },
      { tipo: 'analise', label: 'Análise do negócio' },
    ],
    acoes: [
      {
        label: `Simular ${PRODUTO_LABEL[melhor.produto].toLowerCase()}`,
        rota: simulatorHref(melhor.produto),
      },
    ],
  }
}

const RESPOSTAS: Record<Topico, () => AssistantResponse> = {
  caixa,
  recebiveis,
  estoque,
  pagamentos,
  vendas,
  pendencias,
  credito,
}

/** Resposta do mock para a conversa (a última mensagem é a pergunta). */
export function responder(request: AssistantRequest): AssistantResponse {
  const pergunta = request.messages[request.messages.length - 1]?.content ?? ''
  return RESPOSTAS[topico(pergunta, request.rota)]()
}

function invalido(detail: string) {
  return HttpResponse.json({ detail }, { status: 422 })
}

const MARCADORES: [string, number, Record<string, string>][] = [
  ['[503]', 503, { error: 'ASSISTENTE_INDISPONIVEL' }],
  ['[429]', 429, { error: 'LIMITE_ASSISTENTE' }],
  ['[409]', 409, { error: 'ONBOARDING_PENDENTE' }],
  ['[500]', 500, { error: 'ERRO_INTERNO' }],
]

export function assistantHandlers(base: string): HttpHandler[] {
  return [
    http.post(`${base}/me/assistant/messages`, async ({ request }) => {
      if (import.meta.env.MODE !== 'test') await delay(800)
      if (!db.onboardingAprovado()) {
        return HttpResponse.json(
          { error: 'ONBOARDING_PENDENTE', status: db.me().onboarding_status },
          { status: 409 },
        )
      }
      let body: Partial<AssistantRequest>
      try {
        body = (await request.json()) as Partial<AssistantRequest>
      } catch {
        return invalido('Corpo inválido.')
      }
      const messages = Array.isArray(body?.messages) ? body.messages : []
      if (!messages.length || messages.length > MAX_MESSAGES) {
        return invalido(`Envie de 1 a ${MAX_MESSAGES} mensagens.`)
      }
      const valida = messages.every(
        (m) =>
          (m?.role === 'user' || m?.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.length > 0 &&
          m.content.length <= MAX_CHARS,
      )
      if (!valida || messages[messages.length - 1].role !== 'user') {
        return invalido(`Cada mensagem tem até ${MAX_CHARS} caracteres; a última é do usuário.`)
      }
      const pergunta = messages[messages.length - 1].content
      const marcador = MARCADORES.find(([marca]) => pergunta.includes(marca))
      if (marcador) return HttpResponse.json(marcador[2], { status: marcador[1] })
      return HttpResponse.json(
        responder({ messages, rota: typeof body.rota === 'string' ? body.rota : undefined }),
      )
    }),
  ]
}
