import { Marca } from '@/components/brand/Logo'

import { PERMISSAO_INFO } from '../../team/permissions'
import type { Permissao } from '../../types'

/** Nome curto da permissão, com o "ErpIa" desenhado pela `<Marca/>` (sem ler "Erpla"). */
export function PermissaoLabel({ permissao }: { permissao: Permissao }) {
  const [antes, depois] = PERMISSAO_INFO[permissao].label.split('ErpIa')
  if (depois === undefined) return <>{antes}</>
  return (
    <>
      {antes}
      <Marca />
      {depois}
    </>
  )
}
