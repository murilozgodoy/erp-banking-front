import type { Papel, Permissao } from '../types'

/** As 8 permissões da empresa (seção 11), na ordem em que aparecem na UI. */
export const PERMISSOES: Permissao[] = [
  'ver_financeiro',
  'pagar',
  'aprovar_pagamentos',
  'pedir_credito',
  'contratar_credito',
  'gerenciar_estoque',
  'gerenciar_equipe',
  'usar_assistente',
]

/** Nome curto (chips, toggles) e o verbo para "Peça a um administrador a permissão de …". */
export const PERMISSAO_INFO: Record<Permissao, { label: string; acao: string; descricao: string }> =
  {
    ver_financeiro: {
      label: 'Ver financeiro',
      acao: 'ver o financeiro',
      descricao: 'Saldo, extrato, vendas, recebíveis e contas.',
    },
    pagar: { label: 'Pagar', acao: 'pagar', descricao: 'PIX, boletos e TED, dentro do limite.' },
    aprovar_pagamentos: {
      label: 'Aprovar pagamentos',
      acao: 'aprovar pagamentos',
      descricao: 'Libera pagamentos acima do limite de outras pessoas.',
    },
    pedir_credito: {
      label: 'Pedir crédito',
      acao: 'pedir crédito',
      descricao: 'Simula e envia propostas para alguém contratar.',
    },
    contratar_credito: {
      label: 'Contratar crédito',
      acao: 'contratar crédito',
      descricao: 'Confirma a contratação e o dinheiro cai na conta.',
    },
    gerenciar_estoque: {
      label: 'Gerenciar estoque',
      acao: 'gerenciar o estoque',
      descricao: 'Ajusta itens, mínimos e quantidades.',
    },
    gerenciar_equipe: {
      label: 'Gerenciar equipe',
      acao: 'gerenciar a equipe',
      descricao: 'Convida, edita e suspende pessoas.',
    },
    usar_assistente: {
      label: 'Assistente ErpIa',
      acao: 'usar o assistente',
      descricao: 'Pergunta à IA sobre os números da empresa.',
    },
  }

/** Presets por papel (o DONO pode ajustar cada permissão à mão, exceto no próprio DONO). */
export const PAPEIS: Record<Papel, { label: string; descricao: string; permissoes: Permissao[] }> =
  {
    DONO: {
      label: 'Dono',
      descricao: 'Acesso total. Não pode ser editado nem suspenso.',
      permissoes: PERMISSOES,
    },
    ADMIN: {
      label: 'Administrador',
      descricao: 'Acesso total, inclusive à equipe.',
      permissoes: PERMISSOES,
    },
    FINANCEIRO: {
      label: 'Financeiro',
      descricao: 'Paga, aprova pagamentos e pede crédito.',
      permissoes: [
        'ver_financeiro',
        'pagar',
        'aprovar_pagamentos',
        'pedir_credito',
        'usar_assistente',
      ],
    },
    OPERADOR: {
      label: 'Operador',
      descricao: 'Paga até um limite e cuida do estoque.',
      permissoes: ['ver_financeiro', 'pagar', 'gerenciar_estoque', 'usar_assistente'],
    },
    LEITURA: {
      label: 'Leitura',
      descricao: 'Só consulta os números.',
      permissoes: ['ver_financeiro'],
    },
  }

export function semPermissaoTexto(permissao: Permissao): string {
  return `Peça a um administrador a permissão de ${PERMISSAO_INFO[permissao].acao}.`
}
