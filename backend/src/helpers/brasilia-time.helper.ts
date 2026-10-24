export const BRASILIA_TZ = 'America/Sao_Paulo';

export function brasiliaTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BRASILIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Início do dia civil em Brasília, como timestamptz. */
export function sqlBrasiliaDayStart(param: string): string {
  return `(${param}::date::timestamp AT TIME ZONE '${BRASILIA_TZ}')`;
}

/** Início do dia seguinte em Brasília (limite exclusivo). */
export function sqlBrasiliaDayEndExclusive(param: string): string {
  return `((${param}::date + INTERVAL '1 day')::timestamp AT TIME ZONE '${BRASILIA_TZ}')`;
}
