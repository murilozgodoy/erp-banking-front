import { describe, expect, it } from 'vitest'

import type { Payable } from '../../types'
import {
  destinatario,
  emptyForm,
  formatLinhaDigitavel,
  formFromPayable,
  payFailure,
  scheduledFor,
  toRequest,
  validate,
} from './model'

const conta: Payable = {
  id: 9,
  fornecedor: 'Moinho Paulista',
  categoria: 'FORNECEDOR',
  vencimento: '2026-11-10',
  valor: 1200.5,
  status: 'ABERTO',
  codigo_barras: '1'.repeat(47),
  pago_em: null,
}

describe('modelo de pagamento', () => {
  it('formata a linha digitável em blocos, também parcial', () => {
    expect(formatLinhaDigitavel('12345')).toBe('12345')
    expect(formatLinhaDigitavel('123456')).toBe('12345.6')
    expect(formatLinhaDigitavel('1'.repeat(60)).replace(/\D/g, '')).toHaveLength(47)
  })

  it('preenche a partir da conta e agenda só datas futuras', () => {
    const form = formFromPayable(conta, '2026-11-03')
    expect(form).toMatchObject({ tipo: 'BOLETO', valor: 1200.5, data: '2026-11-10' })
    expect(formFromPayable({ ...conta, codigo_barras: null }, '2026-11-20')).toMatchObject({
      tipo: 'PIX',
      data: '',
    })
    expect(scheduledFor({ ...form, quando: 'agendar', data: '2026-11-03' }, '2026-11-03')).toBe(
      undefined,
    )
    const request = toRequest({ ...form, quando: 'agendar' }, '2026-11-03', 9)
    expect(request).toMatchObject({ payable_id: 9, agendado_para: '2026-11-10', tipo: 'BOLETO' })
    expect(request.codigo_barras).toHaveLength(47)
  })

  it('valida TED e monta o destinatário', () => {
    const ted = {
      ...emptyForm('TED'),
      nome: 'Ana',
      valor: 5,
      banco: '34',
      agencia: '12',
      conta: 'x',
    }
    expect(Object.keys(validate(ted, '2026-11-03')).sort()).toEqual(['agencia', 'banco', 'conta'])
    expect(validate({ ...ted, quando: 'agendar' }, '2026-11-03').data).toBe(
      'Escolha a data do pagamento.',
    )
    expect(destinatario({ ...ted, banco: '341', agencia: '1234', conta: '1-0' })).toBe(
      'Ana · banco 341 · ag. 1234 · cc 1-0',
    )
    expect(toRequest({ ...emptyForm(), nome: 'x', chavePix: 'k' }, '2026-11-03').descricao).toBe(
      'Pagamento PIX',
    )
  })

  it('erro desconhecido cai na mensagem genérica', () => {
    expect(payFailure(new Error('falhou'))).toEqual({ kind: 'outro', message: 'falhou' })
  })
})
