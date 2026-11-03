import type { CampoTemplate, OnboardingTemplate, SecaoTemplate, Segmento } from '../types'

const PCT = { min: 0, max: 100 }
const DIAS = { min: 0, max: 365 }
const POSITIVO = { min: 0 }

// Campos comuns a todos os segmentos (seção 3 do PORTAL_CLIENTE.md).
const faturamento: CampoTemplate = {
  id: 'faturamento_mensal',
  label: 'Faturamento médio mensal',
  tipo: 'currency',
  obrigatorio: true,
  ...POSITIVO,
  ajuda: 'Média dos últimos 6 meses, antes de impostos.',
}
const sazonalidade: CampoTemplate = {
  id: 'sazonalidade',
  label: 'Sazonalidade das vendas',
  tipo: 'select',
  opcoes: ['Baixa', 'Média', 'Alta'],
  ajuda: 'Alta: as vendas mudam muito ao longo do ano (fim de ano, verão, safra).',
}
const prazoRecebimento: CampoTemplate = {
  id: 'prazo_medio_recebimento_dias',
  label: 'Prazo médio de recebimento (dias)',
  tipo: 'integer',
  obrigatorio: true,
  ...DIAS,
  ajuda: 'Em quantos dias, em média, o dinheiro da venda cai na conta.',
}
const prazoPagamento: CampoTemplate = {
  id: 'prazo_medio_pagamento_dias',
  label: 'Prazo médio de pagamento a fornecedores (dias)',
  tipo: 'integer',
  ...DIAS,
}
const possuiEstoque: CampoTemplate = {
  id: 'possui_estoque',
  label: 'Trabalha com estoque?',
  tipo: 'boolean',
  obrigatorio: true,
}
/** Obrigatório só quando `possui_estoque` = true (validado em `camposFaltando`). */
export const CAMPO_CONDICIONAL = { campo: 'valor_estoque', quando: 'possui_estoque' }
const valorEstoque: CampoTemplate = {
  id: 'valor_estoque',
  label: 'Valor do estoque (a preço de custo)',
  tipo: 'currency',
  ...POSITIVO,
  ajuda: 'Obrigatório se você trabalha com estoque.',
}
const margem: CampoTemplate = {
  id: 'margem_bruta_pct',
  label: 'Margem bruta',
  tipo: 'percent',
  obrigatorio: true,
  ...PCT,
  ajuda: 'Receita menos o custo direto do que foi vendido, em % da receita.',
}
const folha: CampoTemplate = {
  id: 'folha_mensal',
  label: 'Folha de pagamento mensal',
  tipo: 'currency',
  ...POSITIVO,
}
const dividas: CampoTemplate = {
  id: 'dividas_total',
  label: 'Total de dívidas (empréstimos e financiamentos)',
  tipo: 'currency',
  obrigatorio: true,
  ...POSITIVO,
}
const parcelas: CampoTemplate = {
  id: 'parcela_dividas_mensal',
  label: 'Quanto paga de parcelas por mês',
  tipo: 'currency',
  ...POSITIVO,
}
const pctCartao: CampoTemplate = {
  id: 'pct_cartao_credito',
  label: '% das vendas no cartão de crédito',
  tipo: 'percent',
  obrigatorio: true,
  ...PCT,
}

interface Especificos {
  vendas?: CampoTemplate[]
  operacao?: CampoTemplate[]
}

/** Monta as 3 seções padrão, encaixando os campos específicos do segmento. */
function secoes(extra: Especificos = {}): SecaoTemplate[] {
  return [
    {
      id: 'vendas',
      titulo: 'Como você vende',
      campos: [faturamento, ...(extra.vendas ?? []), sazonalidade],
    },
    {
      id: 'operacao',
      titulo: 'Operação',
      campos: [
        prazoRecebimento,
        prazoPagamento,
        possuiEstoque,
        valorEstoque,
        ...(extra.operacao ?? []),
      ],
    },
    {
      id: 'financeiro',
      titulo: 'Financeiro',
      campos: [margem, folha, dividas, parcelas],
    },
  ]
}

export const TEMPLATES: OnboardingTemplate[] = [
  {
    segmento: 'varejo',
    nome: 'Varejo e e-commerce',
    descricao: 'Lojas físicas e online',
    icone: 'store',
    secoes: secoes({
      vendas: [
        pctCartao,
        {
          id: 'parcelamento_medio',
          label: 'Parcelamento médio (vezes)',
          tipo: 'number',
          min: 1,
          max: 24,
        },
        {
          id: 'canais',
          label: 'Canais',
          tipo: 'multiselect',
          opcoes: ['Loja física', 'E-commerce próprio', 'Marketplace', 'Redes sociais'],
        },
      ],
    }),
  },
  {
    segmento: 'alimentacao',
    nome: 'Alimentação',
    descricao: 'Bares, restaurantes, padarias e food service',
    icone: 'utensils',
    secoes: secoes({
      vendas: [
        {
          id: 'ticket_medio',
          label: 'Ticket médio por venda',
          tipo: 'currency',
          obrigatorio: true,
          ...POSITIVO,
        },
        pctCartao,
        {
          id: 'pct_delivery',
          label: '% das vendas por delivery',
          tipo: 'percent',
          ...PCT,
          ajuda: 'iFood, apps e entregas próprias.',
        },
        {
          id: 'canais_delivery',
          label: 'Canais de venda',
          tipo: 'multiselect',
          opcoes: ['Balcão', 'iFood', 'WhatsApp', 'Encomendas', 'Site próprio'],
        },
      ],
    }),
  },
  {
    segmento: 'servicos',
    nome: 'Serviços',
    descricao: 'Agências, consultorias, escritórios e prestadores',
    icone: 'briefcase',
    secoes: secoes({
      vendas: [
        {
          id: 'pct_receita_recorrente',
          label: '% da receita em contratos recorrentes',
          tipo: 'percent',
          obrigatorio: true,
          ...PCT,
        },
        pctCartao,
        { id: 'clientes_ativos', label: 'Clientes ativos', tipo: 'integer', ...POSITIVO },
        {
          id: 'concentracao_maior_cliente_pct',
          label: '% da receita no maior cliente',
          tipo: 'percent',
          ...PCT,
          ajuda: 'Acima de 30% aumenta o risco.',
        },
      ],
    }),
  },
  {
    segmento: 'saude',
    nome: 'Saúde',
    descricao: 'Clínicas, consultórios e laboratórios',
    icone: 'stethoscope',
    secoes: secoes({
      vendas: [
        {
          id: 'pct_convenios',
          label: '% da receita via convênios',
          tipo: 'percent',
          obrigatorio: true,
          ...PCT,
          ajuda: 'Convênios costumam pagar em 30 a 90 dias.',
        },
        pctCartao,
        { id: 'atendimentos_mes', label: 'Atendimentos por mês', tipo: 'integer', ...POSITIVO },
        {
          id: 'especialidades',
          label: 'Especialidades',
          tipo: 'multiselect',
          opcoes: ['Clínica geral', 'Odontologia', 'Estética', 'Fisioterapia', 'Exames', 'Outras'],
        },
      ],
    }),
  },
  {
    segmento: 'tecnologia',
    nome: 'Tecnologia',
    descricao: 'SaaS, software e serviços digitais',
    icone: 'cpu',
    secoes: secoes({
      vendas: [
        {
          id: 'mrr',
          label: 'Receita recorrente mensal (MRR)',
          tipo: 'currency',
          obrigatorio: true,
          ...POSITIVO,
        },
        { id: 'churn_mensal_pct', label: 'Churn mensal', tipo: 'percent', ...PCT },
        {
          id: 'cac',
          label: 'Custo de aquisição de cliente (CAC)',
          tipo: 'currency',
          ...POSITIVO,
          ajuda: 'Marketing e vendas do mês ÷ clientes novos.',
        },
        { id: 'clientes_pagantes', label: 'Clientes pagantes', tipo: 'integer', ...POSITIVO },
      ],
    }),
  },
  {
    segmento: 'industria',
    nome: 'Indústria',
    descricao: 'Fabricação, transformação e confecção',
    icone: 'factory',
    secoes: secoes({
      vendas: [
        {
          id: 'pct_vendas_prazo',
          label: '% das vendas a prazo (boleto/duplicata)',
          tipo: 'percent',
          obrigatorio: true,
          ...PCT,
        },
        { id: 'clientes_ativos', label: 'Clientes ativos', tipo: 'integer', ...POSITIVO },
      ],
      operacao: [
        {
          id: 'capacidade_utilizada_pct',
          label: 'Capacidade produtiva utilizada',
          tipo: 'percent',
          ...PCT,
        },
      ],
    }),
  },
  {
    segmento: 'agro',
    nome: 'Agronegócio',
    descricao: 'Produtores rurais, cooperados e agroindústria',
    icone: 'wheat',
    secoes: secoes({
      vendas: [
        {
          id: 'safra_principal',
          label: 'Cultura principal',
          tipo: 'select',
          obrigatorio: true,
          opcoes: ['Soja', 'Milho', 'Café', 'Cana-de-açúcar', 'Laranja', 'Pecuária', 'Hortifrúti'],
        },
        { id: 'area_hectares', label: 'Área produtiva (hectares)', tipo: 'number', ...POSITIVO },
      ],
      operacao: [
        {
          id: 'mes_colheita',
          label: 'Mês principal de colheita (1 a 12)',
          tipo: 'integer',
          min: 1,
          max: 12,
        },
      ],
    }),
  },
  {
    segmento: 'construcao',
    nome: 'Construção',
    descricao: 'Construtoras, reformas e materiais de construção',
    icone: 'hard-hat',
    secoes: secoes({
      vendas: [
        {
          id: 'obras_andamento',
          label: 'Obras em andamento',
          tipo: 'integer',
          obrigatorio: true,
          ...POSITIVO,
        },
        {
          id: 'pct_obras_publicas',
          label: '% da receita com obras públicas',
          tipo: 'percent',
          ...PCT,
          ajuda: 'Contratos públicos costumam atrasar o pagamento.',
        },
        {
          id: 'medicao_media_dias',
          label: 'Intervalo médio entre medições (dias)',
          tipo: 'integer',
          ...DIAS,
        },
      ],
    }),
  },
  {
    segmento: 'outro',
    nome: 'Outro segmento',
    descricao: 'Não achou o seu? Conte sobre o negócio e um analista avalia',
    icone: 'shapes',
    secoes: secoes({ vendas: [pctCartao] }),
  },
]

/** Template de um segmento (sempre existe para os 9 segmentos). */
export function templateDe(segmento: Segmento): OnboardingTemplate {
  return TEMPLATES.find((template) => template.segmento === segmento) ?? TEMPLATES[8]
}

export function camposDe(segmento: Segmento): CampoTemplate[] {
  return templateDe(segmento).secoes.flatMap((secao) => secao.campos)
}
