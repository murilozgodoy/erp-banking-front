/** Intervalo para recarregar dados que mudam por evento assíncrono (RabbitMQ). */
export const EVENT_REFRESH_MS = 3000

/** Quantas recargas, no máximo, enquanto a lista continua vazia (~30 s). */
export const EVENT_MAX_POLLS = 10

/**
 * `refetchInterval` do TanStack Query: enquanto a lista estiver vazia, recarrega a cada
 * {@link EVENT_REFRESH_MS} (o efeito de um evento ainda pode chegar), por até {@link EVENT_MAX_POLLS} vezes.
 * Ex.: a conta aberta automaticamente após `customer.created`.
 */
export function pollWhileEmpty(query: {
  state: { data?: readonly unknown[]; dataUpdateCount: number }
}): number | false {
  const { data, dataUpdateCount } = query.state
  return data !== undefined && data.length === 0 && dataUpdateCount < EVENT_MAX_POLLS
    ? EVENT_REFRESH_MS
    : false
}
