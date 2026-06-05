export const APP_TIMEZONE = 'America/Sao_Paulo';
export const APP_TIMEZONE_OFFSET = '-03:00';

export function combineDateTimeBR(data: string, horario: string): Date {
  return new Date(`${data}T${horario}:00${APP_TIMEZONE_OFFSET}`);
}

export function extractTimeBR(date: Date): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';

  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

export function startOfDayBR(date: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return combineDateTimeBR(`${year}-${month}-${day}`, '00:00');
}

export function parseDateOnlyInput(value: string): Date {
  const datePart = value.includes('T') ? value.split('T')[0] : value;
  return new Date(`${datePart}T12:00:00.000Z`);
}

/** Extrai YYYY-MM-DD de campos somente-data (ex.: prazo de entrega). */
export function extractDateOnlyField(date: Date): string {
  const isUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;

  if (isUtcMidnight) {
    return date.toISOString().slice(0, 10);
  }

  return extractDateBR(date);
}

export function extractDateBR(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

export function endOfDayBR(date: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return combineDateTimeBR(`${year}-${month}-${day}`, '23:59');
}
