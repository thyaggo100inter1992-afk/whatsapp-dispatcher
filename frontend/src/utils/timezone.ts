export const BRASILIA_TZ = 'America/Sao_Paulo';

export function brasiliaTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BRASILIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function formatBrasiliaDateTime(dateString?: string | null, withSeconds = false): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    timeZone: BRASILIA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  });
}
