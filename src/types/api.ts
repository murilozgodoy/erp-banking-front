/*
 * Contratos das APIs. As APIs Python (Onboarding e Score) usam snake_case e a API Java
 * (Transactions) usa camelCase; os tipos espelham o JSON exatamente como trafega.
 */

// ----- Onboarding API -----

export interface Address {
  id: number
  rua: string
  numero: string
  cidade: string
  estado: string
  cep: string
}

export type AddressInput = Omit<Address, 'id'>

export interface FinancialProfile {
  id: number
  renda_mensal: number
  patrimonio: number
  ocupacao: string
}

export type FinancialProfileInput = Omit<FinancialProfile, 'id'>

export interface Anamnesis {
  id: number
  dividas_ativas: number
  comprometimento_renda: number
  updated_at: string
}

export type AnamnesisInput = Pick<Anamnesis, 'dividas_ativas' | 'comprometimento_renda'>

export interface Customer {
  id: number
  nome: string
  cpf: string
  email: string
  telefone: string
  created_at: string
  address: Address | null
  financial_profile: FinancialProfile | null
  anamnesis: Anamnesis | null
}

export interface CustomerInput {
  nome: string
  cpf: string
  email: string
  telefone: string
  address?: AddressInput
  financial_profile?: FinancialProfileInput
}

// ----- Credit Score API -----

export type FaixaRisco = 'BAIXO' | 'MEDIO' | 'ALTO' | 'MUITO_ALTO'

export type Decisao = 'APROVADO' | 'REVISAO' | 'NEGADO'

export interface ScoreFactor {
  nome: string
  peso: number
  valor: number
}

export interface ScoreEvaluation {
  id: number
  customer_id: number
  score: number
  faixa_risco: FaixaRisco
  strategy_usada: string
  created_at: string
  factors: ScoreFactor[]
  decision: { decisao: Decisao; motivo: string } | null
}

export interface ScoreStrategy {
  name: string
  description: string
  default: boolean
}

// ----- Transactions API -----

export type AccountStatus = 'ACTIVE' | 'BLOCKED' | 'CLOSED'

export interface Account {
  id: number
  customerId: number
  saldo: number
  status: AccountStatus
}

export interface AccountInput {
  customerId: number
  saldoInicial: number
}

export type TransactionType = 'CREDIT' | 'DEBIT'

export interface Transaction {
  id: number
  accountId: number
  tipo: TransactionType
  valor: number
  /** Saldo da conta logo após este lançamento. */
  saldoAtual: number
  timestamp: string
}

export interface TransactionInput {
  accountId: number
  tipo: TransactionType
  valor: number
}

export type CreditStatus = Decisao

export interface CreditRequest {
  id: number
  customerId: number
  valorSolicitado: number
  prazoMeses: number
  scoreSnapshot: number | null
  status: CreditStatus
  motivo: string | null
  valorAprovado: number
  taxaJuros: number
  criadoEm: string
}

export interface CreditRequestInput {
  customerId: number
  valor: number
  prazoMeses: number
}
