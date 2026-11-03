/** Templates de onboarding por segmento, como aparecem no cadastro do portal. */

export type SegmentId =
  | 'varejo'
  | 'alimentacao'
  | 'servicos'
  | 'saude'
  | 'tecnologia'
  | 'industria'
  | 'agro'
  | 'construcao'

export interface Segment {
  id: SegmentId
  nome: string
  /** Empresa de exemplo usada na prévia. */
  exemplo: string
  perguntas: { pergunta: string; resposta: string }[]
  indicadores: string[]
  credito: { produto: string; motivo: string }
}

export const SEGMENTS: Segment[] = [
  {
    id: 'varejo',
    nome: 'Varejo',
    exemplo: 'Loja de calçados com duas unidades',
    perguntas: [
      { pergunta: 'Quantas lojas físicas você tem?', resposta: '2 lojas' },
      { pergunta: 'Vende pela internet?', resposta: 'Loja própria e um marketplace' },
      { pergunta: 'Quanto das vendas é no cartão parcelado?', resposta: 'Cerca de 40%' },
    ],
    indicadores: [
      'Vendas por canal',
      'Giro de estoque por categoria',
      'Prazo médio de recebimento',
    ],
    credito: {
      produto: 'Antecipação de recebíveis',
      motivo:
        'Vendas parceladas alongam o recebimento. Antecipar libera o caixa sem esperar a última parcela.',
    },
  },
  {
    id: 'alimentacao',
    nome: 'Alimentação',
    exemplo: 'Padaria com café e entrega por aplicativo',
    perguntas: [
      { pergunta: 'Restaurante, bar, padaria ou delivery?', resposta: 'Padaria com café' },
      { pergunta: 'Trabalha com aplicativos de entrega?', resposta: 'Sim, dois aplicativos' },
      { pergunta: 'Quanto do custo é insumo perecível?', resposta: 'Cerca de 35%' },
    ],
    indicadores: ['CMV e margem por produto', 'Ticket médio por turno', 'Perdas de insumo'],
    credito: {
      produto: 'Capital de giro',
      motivo:
        'O fornecedor é pago toda semana e a venda entra todo dia. O capital de giro cobre esse intervalo.',
    },
  },
  {
    id: 'servicos',
    nome: 'Serviços',
    exemplo: 'Escritório de contabilidade com 48 contratos',
    perguntas: [
      { pergunta: 'Cobra por projeto, hora ou mensalidade?', resposta: 'Mensalidade' },
      { pergunta: 'Quantos clientes ativos?', resposta: '48 contratos' },
      { pergunta: 'Em quantos dias seus clientes costumam pagar?', resposta: '28 dias' },
    ],
    indicadores: ['Receita recorrente', 'Inadimplência por cliente', 'Prazo médio de recebimento'],
    credito: {
      produto: 'Capital de giro',
      motivo:
        'A folha vence antes de os clientes pagarem. O capital de giro cobre a diferença sem atrasar ninguém.',
    },
  },
  {
    id: 'saude',
    nome: 'Saúde',
    exemplo: 'Clínica com quatro especialidades',
    perguntas: [
      { pergunta: 'Clínica, laboratório ou consultório?', resposta: 'Clínica, 4 especialidades' },
      { pergunta: 'Atende convênios?', resposta: 'Sim, 60% do faturamento' },
      { pergunta: 'Em quanto tempo os convênios repassam?', resposta: '45 dias' },
    ],
    indicadores: ['Repasses a receber por convênio', 'Glosas do mês', 'Ocupação da agenda'],
    credito: {
      produto: 'Antecipação de recebíveis',
      motivo:
        'Repasses de convênio levam de 30 a 60 dias. Antecipar evita bancar a operação nesse período.',
    },
  },
  {
    id: 'tecnologia',
    nome: 'Tecnologia',
    exemplo: 'Software de gestão vendido por assinatura',
    perguntas: [
      { pergunta: 'Assinatura, projeto ou licença?', resposta: 'Assinatura mensal' },
      { pergunta: 'Quantos clientes pagantes?', resposta: '320 clientes' },
      { pergunta: 'Cancelamento mensal aproximado', resposta: '2,1%' },
    ],
    indicadores: ['Receita recorrente e cancelamento', 'Custo de aquisição', 'Meses de caixa'],
    credito: {
      produto: 'Alavancagem',
      motivo:
        'Receita recorrente e previsível sustenta crédito para contratar antes de o caixa acumular.',
    },
  },
  {
    id: 'industria',
    nome: 'Indústria',
    exemplo: 'Fábrica de embalagens plásticas',
    perguntas: [
      { pergunta: 'O que você fabrica?', resposta: 'Embalagens plásticas' },
      { pergunta: 'Compra matéria-prima à vista ou a prazo?', resposta: 'A prazo, 30 dias' },
      { pergunta: 'Tempo médio de produção de um pedido', resposta: '12 dias' },
    ],
    indicadores: ['Ciclo de caixa', 'Matéria-prima em dias de produção', 'Margem por linha'],
    credito: {
      produto: 'Financiamento de estoque',
      motivo:
        'Resina comprada em volume custa menos por quilo. O financiamento distribui o desembolso.',
    },
  },
  {
    id: 'agro',
    nome: 'Agro',
    exemplo: 'Produtor de soja e milho em 420 hectares',
    perguntas: [
      { pergunta: 'Qual a atividade principal?', resposta: 'Grãos: soja e milho' },
      { pergunta: 'Área cultivada', resposta: '420 hectares' },
      { pergunta: 'Vende parte da safra antecipadamente?', resposta: 'Sim, cerca de 30%' },
    ],
    indicadores: ['Caixa no calendário da safra', 'Custo por hectare', 'Produção já vendida'],
    credito: {
      produto: 'Capital de giro',
      motivo:
        'Insumo se paga no plantio e a receita chega na colheita. O prazo acompanha o ciclo da safra.',
    },
  },
  {
    id: 'construcao',
    nome: 'Construção',
    exemplo: 'Construtora com três obras residenciais',
    perguntas: [
      { pergunta: 'Obras residenciais, comerciais ou reformas?', resposta: 'Residenciais' },
      { pergunta: 'Quantas obras em andamento?', resposta: '3 obras' },
      { pergunta: 'Recebe por medição?', resposta: 'Sim, mensal' },
    ],
    indicadores: [
      'Previsto x realizado por obra',
      'Medições a receber',
      'Compras com fornecedores',
    ],
    credito: {
      produto: 'Financiamento de estoque',
      motivo:
        'Comprar aço e cimento em lote antes do reajuste protege a margem da obra. A compra vira parcelas.',
    },
  },
]

/** Etapas do cadastro com o tempo típico de cada uma (somam cerca de 3 minutos). */
export const ONBOARDING_STEPS = [
  { etapa: 'Dados da empresa', detalhe: 'CNPJ, nome e contato', tempo: '30 s' },
  { etapa: 'Segmento', detalhe: 'Escolha o template', tempo: '10 s' },
  {
    etapa: 'Perguntas do segmento',
    detalhe: 'Só o que importa para o seu tipo de negócio',
    tempo: '1 min',
  },
  { etapa: 'Observações', detalhe: 'Conte o que os números não mostram', tempo: '1 min' },
  { etapa: 'Revisão', detalhe: 'Confira e envie. O rascunho fica salvo', tempo: '20 s' },
]
