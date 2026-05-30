import { AppError } from './errors.js';

export type DashboardPeriod = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  dataDe: string;
  dataAte: string;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date {
  return startOfDay(new Date(`${value}T12:00:00`));
}

export function getDefaultDashboardPeriod(reference = new Date()): DashboardPeriod {
  const start = startOfDay(new Date(reference.getFullYear(), reference.getMonth() - 1, 1));
  const end = endOfDay(new Date(reference.getFullYear(), reference.getMonth(), 0));
  const previousStart = startOfDay(new Date(start.getFullYear(), start.getMonth() - 1, 1));
  const previousEnd = endOfDay(new Date(start.getFullYear(), start.getMonth(), 0));

  return {
    start,
    end,
    previousStart,
    previousEnd,
    dataDe: toDateInput(start),
    dataAte: toDateInput(end),
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
  const end = endOfDay(parseDateInput(dataAte));

  if (start > end) {
    throw new AppError('A data inicial deve ser anterior à data final', 400);
  }

  const durationMs = end.getTime() - start.getTime();
  const previousEnd = endOfDay(new Date(start.getTime() - 24 * 60 * 60 * 1000));
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
