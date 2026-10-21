import type { RouteObject } from 'react-router'
import { describe, expect, it } from 'vitest'

import { router } from './index'

function paths(routes: RouteObject[]): string[] {
  return routes.flatMap((route) => [
    ...(route.index ? ['(index)'] : route.path ? [route.path] : []),
    ...paths(route.children ?? []),
  ])
}

describe('router', () => {
  it('registra as páginas da aplicação', () => {
    expect(paths(router.routes)).toEqual(
      expect.arrayContaining([
        'login',
        '(index)',
        'perfil',
        '*',
        'clientes',
        'clientes/novo',
        'clientes/:id',
        'contas',
        'contas/:id',
      ]),
    )
  })
})
