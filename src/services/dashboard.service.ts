import prisma from '../utils/prisma.js';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export class DashboardService {
  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [pedidosMes, pedidosMesAnterior, faturamentoResult, faturamentoAnteriorResult] =
      await Promise.all([
        prisma.pedido.count({
          where: { createdAt: { gte: startOfMonth } },
        }),
        prisma.pedido.count({
          where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        }),
        prisma.pedido.aggregate({
          where: {
            status: 'CONCLUIDO',
            createdAt: { gte: startOfMonth },
          },
          _sum: { valorTotal: true },
        }),
        prisma.pedido.aggregate({
          where: {
            status: 'CONCLUIDO',
            createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          },
          _sum: { valorTotal: true },
        }),
      ]);

    const faturamento = Number(faturamentoResult._sum.valorTotal || 0);
    const faturamentoAnterior = Number(faturamentoAnteriorResult._sum.valorTotal || 0);

    const pedidosTrend =
      pedidosMesAnterior > 0
        ? ((pedidosMes - pedidosMesAnterior) / pedidosMesAnterior) * 100
        : 0;

    const faturamentoTrend =
      faturamentoAnterior > 0
        ? ((faturamento - faturamentoAnterior) / faturamentoAnterior) * 100
        : 0;

    return {
      totalPedidos: pedidosMes,
      faturamento,
      trends: {
        pedidos: Math.round(pedidosTrend * 10) / 10,
        faturamento: Math.round(faturamentoTrend * 10) / 10,
      },
    };
  }

  async getChart() {
    const now = new Date();
    const months: { mes: string; faturamento: number }[] = [];

    for (let i = 4; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const result = await prisma.pedido.aggregate({
        where: {
          status: 'CONCLUIDO',
          createdAt: { gte: date, lte: endDate },
        },
        _sum: { valorTotal: true },
      });

      months.push({
        mes: MESES[date.getMonth()],
        faturamento: Number(result._sum.valorTotal || 0),
      });
    }

    return months;
  }
}

export const dashboardService = new DashboardService();
