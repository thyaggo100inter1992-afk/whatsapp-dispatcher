const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;
const TIMEZONE_SUFFIX_REGEX = /(Z|[+-]\d{2}:?\d{2})$/i;

interface NormalizeResult {
  date: Date;
  hadExplicitTimezone: boolean;
}

/**
 * Normaliza um horário vindo do frontend (geralmente em horário de Brasília sem timezone)
 * para UTC, garantindo que o worker processe no horário correto.
 */
export function normalizeBrazilScheduleToUtc(rawValue: string): NormalizeResult {
  const trimmed = rawValue.trim();
  const parsedDate = new Date(trimmed);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('Horário agendado inválido');
  }

  const hadExplicitTimezone = TIMEZONE_SUFFIX_REGEX.test(trimmed);
  const normalizedDate = hadExplicitTimezone
    ? parsedDate
    : new Date(parsedDate.getTime() + BRAZIL_OFFSET_MS);

  return {
    date: normalizedDate,
    hadExplicitTimezone,
  };
}

/**
 * Retorna a data/hora atual considerando o fuso de Brasília (UTC-3).
 */
export function getBrazilNow(): Date {
  return new Date(Date.now() - BRAZIL_OFFSET_MS);
}

