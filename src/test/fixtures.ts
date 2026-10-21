import type {
  Account,
  CreditRequest,
  Customer,
  ScoreEvaluation,
  ScoreStrategy,
  Transaction,
} from '@/types/api'

export function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    nome: 'João da Silva',
    cpf: '12345678900',
    email: 'joao@example.com',
    telefone: '11999998888',
    created_at: '2026-10-20T12:00:00',
    address: {
      id: 1,
      rua: 'Rua das Flores',
      numero: '123',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01234567',
    },
    financial_profile: { id: 1, renda_mensal: 8000, patrimonio: 50000, ocupacao: 'CLT' },
    anamnesis: null,
    ...overrides,
  }
}

export function evaluation(overrides: Partial<ScoreEvaluation> = {}): ScoreEvaluation {
  return {
    id: 10,
    customer_id: 1,
    score: 812.5,
    faixa_risco: 'BAIXO',
    strategy_usada: 'weighted',
    created_at: '2026-10-21T10:00:00',
    factors: [{ nome: 'renda', peso: 0.4, valor: 400 }],
    decision: { decisao: 'APROVADO', motivo: 'Score suficiente para aprovação automática' },
    ...overrides,
  }
}

export const strategies: ScoreStrategy[] = [
  { name: 'simple', description: 'Regras simples', default: false },
  { name: 'weighted', description: 'Ponderada', default: true },
]

export function account(overrides: Partial<Account> = {}): Account {
  return { id: 5, customerId: 1, saldo: 1500, status: 'ACTIVE', ...overrides }
}

export function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 100,
    accountId: 5,
    tipo: 'CREDIT',
    valor: 500,
    saldoAtual: 1500,
    timestamp: '2026-10-21T13:00:00Z',
    ...overrides,
  }
}

export function credit(overrides: Partial<CreditRequest> = {}): CreditRequest {
  return {
    id: 7,
    customerId: 1,
    valorSolicitado: 10000,
    prazoMeses: 24,
    scoreSnapshot: 812.5,
    status: 'APROVADO',
    motivo: 'Aprovação automática — risco baixo',
    valorAprovado: 10000,
    taxaJuros: 0.0299,
    criadoEm: '2026-10-21T14:00:00Z',
    ...overrides,
  }
}
