/**
 * Permissões da API "ERP Banking API" no Auth0 (RBAC). O front só as usa para adaptar a
 * interface (esconder ações e páginas); quem garante o acesso são as APIs, que validam o
 * JWT e respondem 403 sem a permissão.
 */
export const PERMISSIONS = {
  'read:customers': 'Consultar clientes',
  'write:customers': 'Cadastrar clientes e anamnese',
  'read:scores': 'Consultar scores',
  'write:scores': 'Calcular score',
  'read:accounts': 'Consultar contas e extratos',
  'write:accounts': 'Abrir contas e registrar transações',
  'read:credits': 'Consultar pedidos de crédito',
  'write:credits': 'Solicitar crédito',
} as const

export type Permission = keyof typeof PERMISSIONS

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[]

/** Lê o payload de um JWT sem validá-lo (a validação da assinatura é feita pelas APIs). */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1]
  if (!payload) throw new Error('Access token em formato inválido.')
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
}

/** Permissões do ERP presentes no token: claim `permissions` (RBAC) e `scope`. */
export function permissionsFromToken(token: string): Permission[] {
  const payload = decodeJwtPayload(token)
  const granted = new Set<string>()
  if (Array.isArray(payload.permissions)) {
    payload.permissions.forEach((permission) => granted.add(String(permission)))
  }
  if (typeof payload.scope === 'string') {
    payload.scope.split(/\s+/).forEach((scope) => granted.add(scope))
  }
  return ALL_PERMISSIONS.filter((permission) => granted.has(permission))
}
