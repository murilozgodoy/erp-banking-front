import type { AssistantResponse } from '../types'

/** Respostas reais do Score (PR #13 da Sessão C), usadas como fixtures do mock e dos testes. */
export const RESPOSTA_RECEBIVEIS: AssistantResponse = {
  resposta:
    'Seu saldo projetado fica **negativo a partir de 19/11/2026** e chega a **-R$ 11.750,00** em 30/11.\n\n- Você tem **R$ 120.000,00** em recebíveis previstos nos próximos 90 dias.\n- Antecipar **R$ 42.000,00** cobre o vale com folga; a simulação saiu **pré-aprovada**.\n\nA contratação é feita por você na tela de Crédito.',
  sugestoes: [
    'Quanto custa antecipar R$ 42 mil?',
    'Quais recebíveis vencem primeiro?',
    'Capital de giro sai mais barato?',
    'E se eu antecipar só R$ 30 mil?',
  ],
  fontes: [
    { tipo: 'overview', label: 'Fluxo de caixa' },
    { tipo: 'recebiveis', label: 'Agenda de recebíveis' },
    { tipo: 'credito', label: 'Simulação de antecipação' },
  ],
  acoes: [
    {
      label: 'Simular antecipação',
      rota: '/app/credito?produto=ANTECIPACAO_RECEBIVEIS&valor=42000',
    },
    { label: 'Ver recebíveis', rota: '/app/recebiveis' },
  ],
}

export const RESPOSTA_ESTOQUE: AssistantResponse = {
  resposta: 'Você tem **R$ 35.000,00** parados em itens com giro acima de 90 dias.',
  sugestoes: [
    'Quais itens estão parados e quanto dinheiro eles prendem?',
    'Quais itens estão abaixo do mínimo?',
    'Qual é a cobertura média do meu estoque?',
  ],
  fontes: [{ tipo: 'estoque', label: 'Estoque' }],
  acoes: [{ label: 'Ver estoque', rota: '/app/estoque' }],
}

/** Recusa da IA: vem como 200 normal, sem fontes nem ações. */
export const RESPOSTA_RECUSA: AssistantResponse = {
  resposta:
    'Não consigo ajudar com esse pedido. Posso responder sobre os números da sua empresa (vendas, recebíveis, contas, estoque, pendências) e sobre os produtos de crédito da ErpIa.',
  sugestoes: [
    'Como está meu fluxo de caixa nos próximos 60 dias?',
    'Quais pendências devo resolver primeiro?',
    'Qual crédito faz sentido para a minha empresa agora?',
  ],
  fontes: [],
  acoes: [],
}
