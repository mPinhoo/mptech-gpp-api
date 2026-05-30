import { AppError } from './errors.js';
import { combineDateTimeBR, extractDateBR } from './datetime-br.js';

export type DashboardPeriod = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  dataDe: string;
  dataAte: string;
};

function startOfDay(date: Date): Date {
  return combineDateTimeBR(extractDateBR(date), '00:00');
}

function endOfDay(date: Date): Date {
  return combineDateTimeBR(extractDateBR(date), '23:59');
}

function toDateInput(date: Date): string {
  return extractDateBR(date);
}

function parseDateInput(value: string): Date {
  return combineDateTimeBR(value, '00:00');
}

function endOfDayInput(value: string): Date {
  return combineDateTimeBR(value, '23:59');
}

export function getDefaultDashboardPeriod(reference = new Date()): DashboardPeriod {
  const todayKey = extractDateBR(reference);
  const [year, month] = todayKey.split('-').map(Number);
  const startKey = `${year}-${String(month).padStart(2, '0')}-01`;
  const start = parseDateInput(startKey);
  const end = endOfDayInput(todayKey);
  const previousStart = parseDateInput(
    `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}-01`
  );
  const previousEnd = endOfDayInput(
    extractDateBR(new Date(year, month - 1, 0))
  );

  return {
    start,
    end,
    previousStart,
    previousEnd,
    dataDe: startKey,
    dataAte: todayKey,
  };
}

export function resolveDashboardPeriod(
  dataDe?: string,
  dataAte?: string,
  reference = new Date()
): DashboardPeriod {
  if (!dataDe && !dataAte) {
    return getDefaultDashboardPeriod(reference);
  }

  if (!dataDe || !dataAte) {
    throw new AppError('Informe a data inicial e a data final do período', 400);
  }

  const start = parseDateInput(dataDe);
  const end = endOfDayInput(dataAte);

  if (start > end) {
    throw new AppError('A data inicial deve ser anterior à data final', 400);
  }

  const durationMs = end.getTime() - start.getTime();
  const previousEnd = endOfDayInput(
    extractDateBR(new Date(start.getTime() - 24 * 60 * 60 * 1000))
  );
  const previousStart = startOfDay(new Date(previousEnd.getTime() - durationMs));

  return {
    start,
    end,
    previousStart,
    previousEnd,
    dataDe,
    dataAte,
  };
}

export function periodDayCount(period: DashboardPeriod): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((startOfDay(period.end).getTime() - startOfDay(period.start).getTime()) / msPerDay) + 1;
}
