import { describe, expect, it } from 'vitest'

import { EMPRESA_AURORA, RESPOSTAS_AURORA } from '../../mocks/db'
import { TEMPLATES, templateDe } from '../../mocks/templates'
import type { CampoTemplate, OnboardingDraft } from '../../types'
import {
  boundsOf,
  decimalText,
  emptyEmpresa,
  errorsFromServer,
  firstIncompleteStep,
  formatAnswer,
  formatPhone,
  fromDraft,
  isRequired,
  isVisible,
  labelOfKey,
  orderedErrors,
  parseDecimal,
  parseInteger,
  stepOfKey,
  templateOf,
  toPayload,
  validateAll,
  validateCampo,
  validateEmpresa,
  validateRespostas,
  type WizardState,
} from './model'

const alimentacao = templateDe('alimentacao')
const campo = (overrides: Partial<CampoTemplate>): CampoTemplate => ({
  id: 'x',
  label: 'X',
  tipo: 'number',
  ...overrides,
})

const completo = (): WizardState => ({
  empresa: { ...EMPRESA_AURORA },
  segmento: 'alimentacao',
  respostas: { ...RESPOSTAS_AURORA },
  observacoes: '',
})

describe('onboarding: modelo do wizard', () => {
  it('lê o rascunho, tirando máscaras e nulos', () => {
    const draft: OnboardingDraft = {
      empresa: {
        ...EMPRESA_AURORA,
        cnpj: '45.913.268/0001-00',
        email: null,
        telefone: '(19) 98765-4321',
      },
      segmento: 'varejo',
      respostas: { faturamento_mensal: 1 },
      observacoes: 'oi',
      onboarding_status: 'RASCUNHO',
      updated_at: null,
    }
    const state = fromDraft(draft)
    expect(state.empresa.cnpj).toBe('45913268000100')
    expect(state.empresa.email).toBe('')
    expect(state.empresa.telefone).toBe('19987654321')
    expect(state.segmento).toBe('varejo')
    expect(fromDraft(null)).toEqual({
      empresa: emptyEmpresa(),
      segmento: null,
      respostas: {},
      observacoes: '',
    })
  })

  it('valida a empresa como o servidor: obrigatórios, CNPJ com DV, e-mail, telefone, UF e ano', () => {
    expect(Object.keys(validateEmpresa(emptyEmpresa()))).toEqual([
      'empresa.razao_social',
      'empresa.cnpj',
      'empresa.email',
      'empresa.telefone',
      'empresa.cidade',
      'empresa.estado',
    ])
    expect(validateEmpresa(EMPRESA_AURORA)).toEqual({})
    const ruim = validateEmpresa(
      {
        ...EMPRESA_AURORA,
        cnpj: '11222333000100',
        email: 'financeiro',
        telefone: '1999',
        estado: 'XX',
        fundacao_ano: 1800,
        funcionarios: -1,
      },
      new Date(2026, 10, 3),
    )
    expect(ruim).toEqual({
      'empresa.cnpj': 'CNPJ inválido: confira os 14 dígitos.',
      'empresa.email': 'Informe um e-mail no formato nome@empresa.com.br.',
      'empresa.telefone': 'Informe o telefone com DDD (10 ou 11 dígitos).',
      'empresa.estado': 'Escolha a UF.',
      'empresa.fundacao_ano': 'Informe um ano entre 1900 e 2026.',
      'empresa.funcionarios': 'Informe zero ou mais.',
    })
  })

  it('valida cada tipo de campo com os limites do template', () => {
    expect(validateCampo(campo({}), null, true)).toBe('Campo obrigatório.')
    expect(validateCampo(campo({}), null, false)).toBeNull()
    expect(validateCampo(campo({ tipo: 'integer' }), 2.5, false)).toBe('Informe um número inteiro.')
    expect(validateCampo(campo({ tipo: 'percent' }), 120, false)).toBe(
      'Informe um valor entre 0 e 100.',
    )
    expect(validateCampo(campo({ min: 1 }), 0, false)).toBe('O valor mínimo é 1.')
    expect(validateCampo(campo({ max: 5 }), 6, false)).toBe('O valor máximo é 5.')
    expect(validateCampo(campo({}), 'abc', false)).toBe('Informe um número.')
    expect(validateCampo(campo({ tipo: 'boolean' }), 'sim', false)).toBe('Responda sim ou não.')
    expect(validateCampo(campo({ tipo: 'text' }), 3, false)).toBe('Texto inválido.')
    expect(validateCampo(campo({ tipo: 'select', opcoes: ['A'] }), 'B', false)).toBe(
      'Escolha uma das opções.',
    )
    expect(validateCampo(campo({ tipo: 'multiselect', opcoes: ['A'] }), ['A', 'B'], false)).toBe(
      'Escolha entre as opções da lista.',
    )
    expect(validateCampo(campo({ tipo: 'multiselect', opcoes: ['A'] }), ['A'], true)).toBeNull()
    expect(boundsOf(campo({ tipo: 'percent', max: 50 }))).toEqual({ min: 0, max: 50 })
  })

  it('valor do estoque só aparece e só é obrigatório com estoque', () => {
    const valorEstoque = alimentacao.secoes[1].campos.find((c) => c.id === 'valor_estoque')!
    expect(isVisible(valorEstoque, { possui_estoque: false })).toBe(false)
    expect(isVisible(valorEstoque, { possui_estoque: true })).toBe(true)
    expect(isRequired(valorEstoque, { possui_estoque: true })).toBe(true)
    expect(isRequired(valorEstoque, {})).toBe(false)
    const comEstoque = { ...RESPOSTAS_AURORA, valor_estoque: null }
    expect(validateRespostas(alimentacao, comEstoque)).toEqual({
      valor_estoque: 'Campo obrigatório.',
    })
    expect(validateRespostas(alimentacao, { ...comEstoque, possui_estoque: false })).toEqual({})
  })

  it('retoma no primeiro passo pendente', () => {
    const state = completo()
    expect(firstIncompleteStep(state, alimentacao)).toBe(3)
    expect(firstIncompleteStep({ ...state, respostas: {} }, alimentacao)).toBe(2)
    expect(firstIncompleteStep({ ...state, segmento: null }, null)).toBe(1)
    expect(firstIncompleteStep({ ...state, empresa: emptyEmpresa() }, alimentacao)).toBe(0)
    expect(Object.keys(validateAll({ ...state, segmento: null }, null))).toEqual(['segmento'])
  })

  it('mapeia as chaves do 422 para passo, rótulo e ordem', () => {
    expect(stepOfKey('empresa.cnpj', alimentacao)).toBe(0)
    expect(stepOfKey('segmento', alimentacao)).toBe(1)
    expect(stepOfKey('ticket_medio', alimentacao)).toBe(2)
    expect(stepOfKey('desconhecido', alimentacao)).toBe(3)
    expect(labelOfKey('empresa.cnpj', alimentacao)).toBe('CNPJ')
    expect(labelOfKey('segmento', alimentacao)).toBe('Segmento')
    expect(labelOfKey('observacoes', alimentacao)).toBe('Observações')
    expect(labelOfKey('ticket_medio', alimentacao)).toBe('Ticket médio por venda')
    expect(labelOfKey('desconhecido', alimentacao)).toBe('desconhecido')
    const errors = errorsFromServer([
      { campo: 'ticket_medio', erro: 'a' },
      { campo: 'desconhecido', erro: 'b' },
      { campo: 'empresa.cnpj', erro: 'c' },
      { campo: 'empresa.cnpj', erro: 'repetido' },
    ])
    expect(errors['empresa.cnpj']).toBe('c')
    expect(orderedErrors(errors, alimentacao)).toEqual([
      'empresa.cnpj',
      'ticket_medio',
      'desconhecido',
    ])
    expect(errorsFromServer(undefined)).toEqual({})
  })

  it('monta o payload: rascunho inteiro; envio só com o template e sem campos escondidos', () => {
    const state: WizardState = {
      ...completo(),
      empresa: { ...EMPRESA_AURORA, email: '  ', telefone: '' },
      respostas: { ...RESPOSTAS_AURORA, possui_estoque: false, outro_segmento: 1 },
    }
    const rascunho = toPayload(state, false)
    expect(rascunho.enviar).toBe(false)
    expect(rascunho.empresa.email).toBeNull()
    expect(rascunho.empresa.telefone).toBeNull()
    expect(rascunho.respostas).toHaveProperty('outro_segmento')
    const envio = toPayload(state, true, alimentacao)
    expect(envio.enviar).toBe(true)
    expect(envio.respostas).not.toHaveProperty('outro_segmento')
    expect(envio.respostas).not.toHaveProperty('valor_estoque')
    expect(envio.respostas.faturamento_mensal).toBe(RESPOSTAS_AURORA.faturamento_mensal)
  })

  it('máscaras e leitura de números em pt-BR', () => {
    expect(formatPhone('')).toBe('')
    expect(formatPhone('1')).toBe('(1')
    expect(formatPhone('1998')).toBe('(19) 98')
    expect(formatPhone('1932345678')).toBe('(19) 3234-5678')
    expect(formatPhone('19987654321')).toBe('(19) 98765-4321')
    expect(parseDecimal('12,5')).toBe(12.5)
    expect(parseDecimal('1.234,5')).toBe(1234.5)
    expect(parseDecimal('12.5')).toBe(12.5)
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal(',')).toBeNull()
    expect(parseInteger('1a2')).toBe(12)
    expect(parseInteger('')).toBeNull()
    expect(decimalText(12.5)).toBe('12,5')
    expect(decimalText(null)).toBe('')
  })

  it('formata as respostas para a revisão', () => {
    const tipo = (t: CampoTemplate['tipo']) => campo({ tipo: t })
    expect(formatAnswer(tipo('currency'), 1500)).toMatch(/^R\$\s1\.500,00$/)
    expect(formatAnswer(tipo('percent'), 31)).toBe('31%')
    expect(formatAnswer(tipo('percent'), 12.5)).toBe('12,5%')
    expect(formatAnswer(tipo('integer'), 1200)).toBe('1.200')
    expect(formatAnswer(tipo('number'), 2.5)).toBe('2,5')
    expect(formatAnswer(tipo('boolean'), false)).toBe('Não')
    expect(formatAnswer(tipo('boolean'), true)).toBe('Sim')
    expect(formatAnswer(tipo('multiselect'), ['A', 'B'])).toBe('A, B')
    expect(formatAnswer(tipo('text'), 'livre')).toBe('livre')
    expect(formatAnswer(tipo('select'), null)).toBe('Não informado')
    expect(formatAnswer(tipo('currency'), 'x')).toBe('x')
    expect(templateOf(TEMPLATES, null)).toBeNull()
  })
})
