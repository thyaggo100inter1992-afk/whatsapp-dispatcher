const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;
const TIMEZONE_SUFFIX_REGEX = /(Z|[+-]\d{2}:?\d{2})$/i;
const BRAZIL_WALL_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

interface NormalizeResult {
  date: Date;
  hadExplicitTimezone: boolean;
}

/**
 * Interpreta data/hora do frontend como horário de Brasília (America/Sao_Paulo, UTC-3)
 * e devolve o instante equivalente em UTC.
 * Strings sem timezone (ex.: 2026-08-24T15:00:00) = 15:00 em Brasília.
 */
export function normalizeBrazilScheduleToUtc(rawValue: string): NormalizeResult {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) {
    throw new Error('Horário agendado inválido');
  }

  const hadExplicitTimezone = TIMEZONE_SUFFIX_REGEX.test(trimmed);
  if (hadExplicitTimezone) {
    const parsedDate = new Date(trimmed);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error('Horário agendado inválido');
    }
    return { date: parsedDate, hadExplicitTimezone: true };
  }

  const wall = trimmed.match(BRAZIL_WALL_REGEX);
  if (wall) {
    const year = Number(wall[1]);
    const month = Number(wall[2]);
    const day = Number(wall[3]);
    const hour = Number(wall[4]);
    const minute = Number(wall[5]);
    const second = Number(wall[6] || 0);
    // Brasília fixo UTC-3: UTC = horário local + 3h
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) + BRAZIL_OFFSET_MS;
    return { date: new Date(utcMs), hadExplicitTimezone: false };
  }

  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('Horário agendado inválido');
  }
  return {
    date: new Date(parsedDate.getTime() + BRAZIL_OFFSET_MS),
    hadExplicitTimezone: false,
  };
}

/** Instantâneo “agora” espelhado como relógio de Brasília (para comparar HH:mm locais). */
export function getBrazilNow(): Date {
  return new Date(Date.now() - BRAZIL_OFFSET_MS);
}

/** Minutos desde 00:00 no fuso America/Sao_Paulo. */
export function getBrazilMinutesNow(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

export function parseTimeToMinutes(time: string, fallback = '08:00'): number {
  const raw = String(time || fallback).trim() || fallback;
  const [h, m] = raw.split(':').map((n) => Number(n));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Janela de trabalho da campanha em horário de Brasília. */
export function isWithinBrazilWorkHours(startTime: string, endTime: string): boolean {
  const current = getBrazilMinutesNow();
  const start = parseTimeToMinutes(startTime, '08:00');
  const end = parseTimeToMinutes(endTime, '20:00');
  if (end <= start) {
    // Janela que cruza meia-noite (ex.: 22:00–06:00)
    return current >= start || current < end;
  }
  return current >= start && current < end;
}
