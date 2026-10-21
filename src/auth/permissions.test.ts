import { describe, expect, it } from 'vitest'

import { fakeJwt } from '@/test/auth0'

import { decodeJwtPayload, permissionsFromToken } from './permissions'

describe('decodeJwtPayload', () => {
  it('decodifica base64url com UTF-8', () => {
    const json = JSON.stringify({ name: 'João Ação', n: 1 })
    const payload = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')

    expect(decodeJwtPayload(`h.${payload}.s`)).toEqual({ name: 'João Ação', n: 1 })
  })

  it('rejeita token sem payload', () => {
    expect(() => decodeJwtPayload('opaco')).toThrow('Access token em formato inválido.')
  })
})

describe('permissionsFromToken', () => {
  it('junta permissions e scope, mantendo só as permissões do ERP', () => {
    const token = fakeJwt({
      permissions: ['read:customers', 'read:scores', 'delete:everything'],
      scope: 'openid profile write:credits',
    })

    expect(permissionsFromToken(token)).toEqual(['read:customers', 'read:scores', 'write:credits'])
  })

  it('token sem permissões', () => {
    expect(permissionsFromToken(fakeJwt({ sub: 'x' }))).toEqual([])
  })
})
