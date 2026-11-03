import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { usePortalApi } from '../../api'
import type { InviteRequest, TeamMemberPatch } from '../../types'

export const teamKey = ['portal', 'team'] as const

/** Equipe da empresa (`GET /me/team`, DONO primeiro). */
export function useTeam(enabled = true) {
  const api = usePortalApi()
  return useQuery({ queryKey: teamKey, queryFn: api.onboarding.team, enabled, staleTime: 15_000 })
}

/** Convidar, editar e remover; todas atualizam a lista ao terminar. */
export function useTeamMutations() {
  const api = usePortalApi()
  const queryClient = useQueryClient()
  const onSettled = () => queryClient.invalidateQueries({ queryKey: teamKey })
  return {
    invite: useMutation({
      mutationFn: (invite: InviteRequest) => api.onboarding.invite(invite),
      onSettled,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: number; patch: TeamMemberPatch }) =>
        api.onboarding.updateMember(id, patch),
      onSettled,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api.onboarding.removeMember(id),
      onSettled,
    }),
  }
}
