import prisma from '../utils/prisma.js';
import {
  type DashboardPeriod,
  periodDayCount,
  resolveDashboardPeriod,
} from '../utils/dashboard-period.js';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Pedidos que saíram de pendente (aprovados ou concluídos) entram no faturamento. */
const FATURAMENTO_STATUSES = ['APROVADO', 'CONCLUIDO'] as const;

type PeriodRange = Pick<DashboardPeriod, 'start' | 'end'>;

function createdAtRange(range: PeriodRange) {
  return { gte: range.start, lte: range.end };
}

function dataPedidoRange(range: PeriodRange) {
  return { gte: range.start, lte: range.end };
}

function calcTrend(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export class DashboardService {
  async getStats(userId: string, dataDe?: string, dataAte?: string) {
    const period = resolveDashboardPeriod(dataDe, dataAte);
    const previous = { start: period.previousStart, end: period.previousEnd };
    const current = { start: period.start, end: period.end };

    const [
      pedidosPeriodo,
      pedidosAnterior,
      faturamentoResult,
      faturamentoAnteriorResult,
      despesasResult,
      despesasAnteriorResult,
    ] = await Promise.all([
      prisma.pedido.count({
        where: { userId, dataPedido: dataPedidoRange(current) },
      }),
      prisma.pedido.count({
        where: { userId, dataPedido: dataPedidoRange(previous) },
      }),
      prisma.pedido.aggregate({
        where: {
          userId,
          status: { in: [...FATURAMENTO_STATUSES] },
          dataPedido: dataPedidoRange(current),
        },
        _sum: { valorTotal: true },
      }),
      prisma.pedido.aggregate({
        where: {
          userId,
          status: { in: [...FATURAMENTO_STATUSES] },
          dataPedido: dataPedidoRange(previous),
        },
        _sum: { valorTotal: true },
      }),
      prisma.despesa.aggregate({
        where: { userId, createdAt: createdAtRange(current) },
        _sum: { valor: true },
      }),
      prisma.despesa.aggregate({
        where: { userId, createdAt: createdAtRange(previous) },
        _sum: { valor: true },
      }),
    ]);

    const faturamento = Number(faturamentoResult._sum.valorTotal || 0);
    const faturamentoAnterior = Number(faturamentoAnteriorResult._sum.valorTotal || 0);
    const despesas = Number(despesasResult._sum.valor || 0);
    const despesasAnterior = Number(despesasAnteriorResult._sum.valor || 0);
    const saldoMes = faturamento - despesas;
    const saldoAnterior = faturamentoAnterior - despesasAnterior;

    return {
      totalPedidos: pedidosPeriodo,
      faturamento,
      despesas,
      saldoMes,
      trends: {
        pedidos: calcTrend(pedidosPeriodo, pedidosAnterior),
        faturamento: calcTrend(faturamento, faturamentoAnterior),
        despesas: calcTrend(despesas, despesasAnterior),
        saldo: calcTrend(saldoMes, saldoAnterior),
      },
      periodo: {
        dataDe: period.dataDe,
        dataAte: period.dataAte,
      },
    };
  }

  async getChart(userId: string, dataDe?: string, dataAte?: string) {
    const period = resolveDashboardPeriod(dataDe, dataAte);
    const days = periodDayCount(period);

    if (days <= 45) {
      return this.getWeeklyChart(userId, period);
    }

    return this.getMonthlyChart(userId, period);
  }

  private async getMonthlyChart(userId: string, period: DashboardPeriod) {
    const months: { mes: string; faturamento: number; despesas: number }[] = [];
    let cursor = new Date(period.start.getFullYear(), period.start.getMonth(), 1);

    while (cursor <= period.end) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      const range = {
        start: monthStart < period.start ? period.start : monthStart,
        end: monthEnd > period.end ? period.end : monthEnd,
      };

      const [fatResult, despResult] = await Promise.all([
        prisma.pedido.aggregate({
          where: {
            userId,
            status: { in: [...FATURAMENTO_STATUSES] },
            createdAt: createdAtRange(range),
          },
          _sum: { valorTotal: true },
        }),
        prisma.despesa.aggregate({
          where: { userId, createdAt: createdAtRange(range) },
          _sum: { valor: true },
        }),
      ]);

      months.push({
        mes: `${MESES[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(-2)}`,
        faturamento: Number(fatResult._sum.valorTotal || 0),
        despesas: Number(despResult._sum.valor || 0),
      });

      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return months;
  }

  private async getWeeklyChart(userId: string, period: DashboardPeriod) {
    const weeks: { mes: string; faturamento: number; despesas: number }[] = [];
    let cursor = new Date(period.start);

    while (cursor <= period.end) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > period.end) {
        weekEnd.setTime(period.end.getTime());
      }

      const range = { start: weekStart, end: weekEnd };

      const [fatResult, despResult] = await Promise.all([
        prisma.pedido.aggregate({
          where: {
            userId,
            status: { in: [...FATURAMENTO_STATUSES] },
            createdAt: createdAtRange(range),
          },
          _sum: { valorTotal: true },
        }),
        prisma.despesa.aggregate({
          where: { userId, createdAt: createdAtRange(range) },
          _sum: { valor: true },
        }),
      ]);

      const labelStart = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const labelEnd = weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      weeks.push({
        mes: `${labelStart} - ${labelEnd}`,
        faturamento: Number(fatResult._sum.valorTotal || 0),
        despesas: Number(despResult._sum.valor || 0),
      });

      cursor = new Date(weekEnd);
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }

    return weeks;
  }
}

export const dashboardService = new DashboardService();
