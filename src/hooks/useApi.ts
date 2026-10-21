import { useAuth0 } from '@auth0/auth0-react'
import { useMemo } from 'react'

import { createApi, type Api } from '@/services/api'

/** Services das APIs autenticados com o access token do usuário logado. */
export function useApi(): Api {
  const { getAccessTokenSilently } = useAuth0()
  return useMemo(
    () =>
      createApi(async () => {
        const token = await getAccessTokenSilently()
        if (!token) throw new Error('Access token indisponível. Entre novamente.')
        return token
      }),
    [getAccessTokenSilently],
  )
}
