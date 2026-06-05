import { endOfDayBR, startOfDayBR } from './datetime-br.js';

export type PeriodoPreset =
  | 'hoje'
  | 'semana'
  | 'mes'
  | 'mes_passado'
  | 'ano'
  | 'ultimos_n_dias'
  | 'ultimos_30_dias'
  | 'ate_hoje'
  | 'personalizado';

export interface PeriodoInput {
  periodo?: PeriodoPreset;
  dias?: number;
  data_de?: string;
  data_ate?: string;
}

export interface PeriodoRange {
  start: Date | null;
  end: Date;
  label: string;
}

function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function startOfMonthBR(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  return new Date(`${year}-${month}-01T00:00:00-03:00`);
}

function endOfMonthBR(date: Date): Date {
  const start = startOfMonthBR(date);
  const next = new Date(start);
  next.setMonth(next.getMonth() + 1);
  next.setMilliseconds(-1);
  return next;
}

export function resolveChatPeriodo(input: PeriodoInput = {}): PeriodoRange {
  const hoje = new Date();
  const fim = endOfDayBR(hoje);
  const periodo = input.periodo ?? 'mes';

  switch (periodo) {
    case 'hoje':
      return { start: startOfDayBR(hoje), end: fim, label: 'hoje' };

    case 'semana': {
      const start = startOfDayBR(hoje);
      start.setDate(start.getDate() - 6);
      return { start, end: fim, label: 'na última semana (7 dias)' };
    }

    case 'mes':
      return {
        start: startOfMonthBR(hoje),
        end: fim,
        label: 'neste mês',
      };

    case 'mes_passado': {
      const inicioMesAtual = startOfMonthBR(hoje);
      const fimMesPassado = new Date(inicioMesAtual);
      fimMesPassado.setMilliseconds(-1);
      const inicioMesPassado = startOfMonthBR(fimMesPassado);
      return {
        start: inicioMesPassado,
        end: endOfDayBR(fimMesPassado),
        label: 'no mês passado',
      };
    }

    case 'ano': {
      const start = startOfDayBR(hoje);
      start.setFullYear(start.getFullYear() - 1);
      start.setDate(start.getDate() + 1);
      return { start, end: fim, label: 'no último ano (365 dias)' };
    }

    case 'ultimos_n_dias': {
      const dias = Math.max(1, Math.min(input.dias ?? 30, 365));
      const start = startOfDayBR(hoje);
      start.setDate(start.getDate() - (dias - 1));
      return { start, end: fim, label: `nos últimos ${dias} dias` };
    }

    case 'ultimos_30_dias':
      return resolveChatPeriodo({ periodo: 'ultimos_n_dias', dias: 30 });

    case 'ate_hoje':
      return { start: null, end: fim, label: 'até hoje (todo o histórico)' };

    case 'personalizado': {
      const start = input.data_de
        ? new Date(`${input.data_de}T00:00:00-03:00`)
        : startOfDayBR(hoje);
      const end = input.data_ate
        ? new Date(`${input.data_ate}T23:59:00-03:00`)
        : fim;
      return {
        start,
        end,
        label: `de ${formatDateBR(start)} a ${formatDateBR(end)}`,
      };
    }

    default:
      return resolveChatPeriodo({ periodo: 'mes' });
  }
}

export function periodoToDateFilter(range: PeriodoRange): { gte?: Date; lte: Date } {
  if (range.start === null) {
    return { lte: range.end };
  }
  return { gte: range.start, lte: range.end };
}
