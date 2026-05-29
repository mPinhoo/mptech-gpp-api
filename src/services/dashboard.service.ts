import prisma from '../utils/prisma.js';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export class DashboardService {
  async getStats(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      pedidosMes,
      pedidosMesAnterior,
      faturamentoResult,
      faturamentoAnteriorResult,
      despesasResult,
      despesasAnteriorResult,
    ] = await Promise.all([
      prisma.pedido.count({
        where: { userId, createdAt: { gte: startOfMonth } },
      }),
      prisma.pedido.count({
        where: { userId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      prisma.pedido.aggregate({
        where: {
          userId,
          status: 'CONCLUIDO',
          createdAt: { gte: startOfMonth },
        },
        _sum: { valorTotal: true },
      }),
      prisma.pedido.aggregate({
        where: {
          userId,
          status: 'CONCLUIDO',
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { valorTotal: true },
      }),
      prisma.despesa.aggregate({
        where: { userId, createdAt: { gte: startOfMonth } },
        _sum: { valor: true },
      }),
      prisma.despesa.aggregate({
        where: { userId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { valor: true },
      }),
    ]);

    const faturamento = Number(faturamentoResult._sum.valorTotal || 0);
    const faturamentoAnterior = Number(faturamentoAnteriorResult._sum.valorTotal || 0);
    const despesas = Number(despesasResult._sum.valor || 0);
    const despesasAnterior = Number(despesasAnteriorResult._sum.valor || 0);
    const saldoMes = faturamento - despesas;

    const pedidosTrend =
      pedidosMesAnterior > 0
        ? ((pedidosMes - pedidosMesAnterior) / pedidosMesAnterior) * 100
        : 0;

    const faturamentoTrend =
      faturamentoAnterior > 0
        ? ((faturamento - faturamentoAnterior) / faturamentoAnterior) * 100
        : 0;

    const despesasTrend =
      despesasAnterior > 0
        ? ((despesas - despesasAnterior) / despesasAnterior) * 100
        : 0;

    return {
      totalPedidos: pedidosMes,
      faturamento,
      despesas,
      saldoMes,
      trends: {
        pedidos: Math.round(pedidosTrend * 10) / 10,
        faturamento: Math.round(faturamentoTrend * 10) / 10,
        despesas: Math.round(despesasTrend * 10) / 10,
      },
    };
  }

  async getChart(userId: string) {
    const now = new Date();
    const months: { mes: string; faturamento: number; despesas: number }[] = [];

    for (let i = 4; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const [fatResult, despResult] = await Promise.all([
        prisma.pedido.aggregate({
          where: {
            userId,
            status: 'CONCLUIDO',
            createdAt: { gte: date, lte: endDate },
          },
          _sum: { valorTotal: true },
        }),
        prisma.despesa.aggregate({
          where: { userId, createdAt: { gte: date, lte: endDate } },
          _sum: { valor: true },
        }),
      ]);

      months.push({
        mes: MESES[date.getMonth()],
        faturamento: Number(fatResult._sum.valorTotal || 0),
        despesas: Number(despResult._sum.valor || 0),
      });
    }

    return months;
  }
}

export const dashboardService = new DashboardService();
