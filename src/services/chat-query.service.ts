import prisma from '../utils/prisma.js';
import { userCan } from './permissions.service.js';
import type { MenuKey } from '../constants/menus.js';
import { startOfDayBR, endOfDayBR } from '../utils/datetime-br.js';

const MARGEM_ESTOQUE_BAIXO = 31;

export interface ChatUserContext {
  userId: string;
  email: string;
}

type PeriodoPreset = 'hoje' | 'semana' | 'mes' | 'ultimos_30_dias' | 'personalizado';

interface PeriodoRange {
  start: Date;
  end: Date;
  label: string;
}

function calcularStatusEstoque(quantidade: number, quantidadeMinima: number): string {
  if (quantidade < quantidadeMinima) return 'Crítico';
  if (quantidade <= quantidadeMinima + MARGEM_ESTOQUE_BAIXO) return 'Baixo';
  return 'Normal';
}

function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function resolvePeriodo(
  periodo: PeriodoPreset,
  dataDe?: string,
  dataAte?: string
): PeriodoRange {
  const hoje = new Date();

  switch (periodo) {
    case 'hoje':
      return {
        start: startOfDayBR(hoje),
        end: endOfDayBR(hoje),
        label: 'hoje',
      };
    case 'semana': {
      const start = startOfDayBR(hoje);
      start.setDate(start.getDate() - 6);
      return {
        start,
        end: endOfDayBR(hoje),
        label: 'nos últimos 7 dias',
      };
    }
    case 'mes': {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(hoje);
      const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
      const month = parts.find((p) => p.type === 'month')?.value ?? '01';
      const start = new Date(`${year}-${month}-01T00:00:00-03:00`);
      return {
        start,
        end: endOfDayBR(hoje),
        label: 'neste mês',
      };
    }
    case 'ultimos_30_dias': {
      const start = startOfDayBR(hoje);
      start.setDate(start.getDate() - 29);
      return {
        start,
        end: endOfDayBR(hoje),
        label: 'nos últimos 30 dias',
      };
    }
    case 'personalizado': {
      const start = dataDe
        ? new Date(`${dataDe}T00:00:00-03:00`)
        : startOfDayBR(hoje);
      const end = dataAte
        ? new Date(`${dataAte}T23:59:00-03:00`)
        : endOfDayBR(hoje);
      return {
        start,
        end,
        label: `de ${formatDateBR(start)} a ${formatDateBR(end)}`,
      };
    }
    default:
      return resolvePeriodo('mes');
  }
}

async function checkPermission(
  ctx: ChatUserContext,
  menu: MenuKey
): Promise<{ allowed: boolean; message?: string }> {
  const allowed = await userCan(ctx.userId, ctx.email, menu, 'leitura');
  if (!allowed) {
    return {
      allowed: false,
      message: `Você não tem permissão para consultar ${menu}. Peça acesso ao administrador.`,
    };
  }
  return { allowed: true };
}

export class ChatQueryService {
  async getEstoqueBaixo(ctx: ChatUserContext) {
    const perm = await checkPermission(ctx, 'estoque');
    if (!perm.allowed) return { error: perm.message };

    const itens = await prisma.materiaPrima.findMany({
      where: { userId: ctx.userId },
      orderBy: { quantidade: 'asc' },
    });

    type EstoqueItem = {
      nome: string;
      quantidade: number;
      minimo: number;
      unidade: string;
      status: string;
    };

    const baixos = itens
      .map(
        (item: {
          nome: string;
          quantidade: number;
          quantidadeMinima: number;
          unidade: string;
        }): EstoqueItem => ({
          nome: item.nome,
          quantidade: item.quantidade,
          minimo: item.quantidadeMinima,
          unidade: item.unidade,
          status: calcularStatusEstoque(item.quantidade, item.quantidadeMinima),
        })
      )
      .filter((item: EstoqueItem) => item.status === 'Baixo' || item.status === 'Crítico');

    return {
      total: baixos.length,
      criticos: baixos.filter((i: EstoqueItem) => i.status === 'Crítico').length,
      itens: baixos,
    };
  }

  async getPedidosPeriodo(
    ctx: ChatUserContext,
    periodo: PeriodoPreset = 'mes',
    dataDe?: string,
    dataAte?: string,
    status?: string
  ) {
    const perm = await checkPermission(ctx, 'pedidos');
    if (!perm.allowed) return { error: perm.message };

    const range = resolvePeriodo(periodo, dataDe, dataAte);
    const where: Record<string, unknown> = {
      userId: ctx.userId,
      dataPedido: { gte: range.start, lte: range.end },
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    const [total, pedidos, valorTotal] = await Promise.all([
      prisma.pedido.count({ where }),
      prisma.pedido.findMany({
        where,
        take: 15,
        orderBy: { dataPedido: 'desc' },
        include: { cliente: { select: { nome: true } } },
      }),
      prisma.pedido.aggregate({
        where,
        _sum: { valorTotal: true },
      }),
    ]);

    const statusMap: Record<string, string> = {
      PENDENTE: 'Pendente',
      APROVADO: 'Aprovado',
      CONCLUIDO: 'Concluído',
      CANCELADO: 'Cancelado',
    };

    return {
      periodo: range.label,
      total,
      valorTotal: Number(valorTotal._sum.valorTotal || 0),
      pedidos: pedidos.map((p: (typeof pedidos)[number]) => ({
        numero: p.numero,
        cliente: p.cliente.nome,
        data: formatDateBR(p.dataPedido),
        valor: formatCurrency(Number(p.valorTotal)),
        status: statusMap[p.status] || p.status,
      })),
    };
  }

  async getClientesRecorrentes(
    ctx: ChatUserContext,
    limite = 10,
    periodoMeses = 12
  ) {
    const perm = await checkPermission(ctx, 'clientes');
    if (!perm.allowed) return { error: perm.message };

    const hoje = new Date();
    const start = startOfDayBR(hoje);
    start.setMonth(start.getMonth() - periodoMeses);

    const grupos = await prisma.pedido.groupBy({
      by: ['clienteId'],
      where: {
        userId: ctx.userId,
        dataPedido: { gte: start, lte: endOfDayBR(hoje) },
        status: { not: 'CANCELADO' },
      },
      _count: { id: true },
      _sum: { valorTotal: true },
      orderBy: { _count: { id: 'desc' } },
      take: limite,
    });

    if (grupos.length === 0) {
      return { periodoMeses, clientes: [] };
    }

    const clienteIds = grupos.map((g: (typeof grupos)[number]) => g.clienteId);
    const clientes = await prisma.cliente.findMany({
      where: { id: { in: clienteIds }, userId: ctx.userId },
      select: { id: true, nome: true, telefone: true },
    });

    type ClienteResumo = { id: string; nome: string; telefone: string | null };
    const clienteMap = new Map<string, ClienteResumo>(
      clientes.map((c: ClienteResumo) => [c.id, c])
    );

    return {
      periodoMeses,
      clientes: grupos.map((g: (typeof grupos)[number]) => {
        const cliente = clienteMap.get(g.clienteId);
        return {
          nome: cliente?.nome ?? 'Cliente removido',
          telefone: cliente?.telefone,
          totalPedidos: g._count.id,
          valorTotal: Number(g._sum.valorTotal || 0),
        };
      }),
    };
  }

  async getClientesInativos(
    ctx: ChatUserContext,
    diasSemPedir = 30,
    limite = 20
  ) {
    const perm = await checkPermission(ctx, 'clientes');
    if (!perm.allowed) return { error: perm.message };

    const threshold = startOfDayBR(new Date());
    threshold.setDate(threshold.getDate() - diasSemPedir);

    const inativos = await prisma.$queryRaw<
      Array<{
        id: string;
        nome: string;
        telefone: string | null;
        ultimo_pedido: Date;
        total_pedidos: bigint;
      }>
    >`
      SELECT c.id, c.nome, c.telefone,
             MAX(p."dataPedido") AS ultimo_pedido,
             COUNT(p.id) AS total_pedidos
      FROM "Cliente" c
      INNER JOIN "Pedido" p ON p."clienteId" = c.id
      WHERE c."userId" = ${ctx.userId}
        AND c.ativo = true
        AND p.status != 'CANCELADO'
      GROUP BY c.id, c.nome, c.telefone
      HAVING MAX(p."dataPedido") < ${threshold}
      ORDER BY MAX(p."dataPedido") ASC
      LIMIT ${limite}
    `;

    const semPedido = await prisma.cliente.findMany({
      where: {
        userId: ctx.userId,
        ativo: true,
        pedidos: { none: {} },
      },
      take: Math.max(0, limite - inativos.length),
      select: { id: true, nome: true, telefone: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      diasSemPedir,
      clientesSemPedidoRecente: inativos.map((c: (typeof inativos)[number]) => ({
        nome: c.nome,
        telefone: c.telefone,
        ultimoPedido: formatDateBR(c.ultimo_pedido),
        totalPedidosHistorico: Number(c.total_pedidos),
        diasSemPedir: Math.floor(
          (Date.now() - c.ultimo_pedido.getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      clientesNuncaPediram: semPedido.map((c: (typeof semPedido)[number]) => ({
        nome: c.nome,
        telefone: c.telefone,
      })),
    };
  }

  async getResumoFinanceiro(
    ctx: ChatUserContext,
    periodo: PeriodoPreset = 'mes',
    dataDe?: string,
    dataAte?: string
  ) {
    const perm = await checkPermission(ctx, 'home');
    if (!perm.allowed) return { error: perm.message };

    const range = resolvePeriodo(periodo, dataDe, dataAte);

    const [totalPedidos, faturamento, despesas] = await Promise.all([
      prisma.pedido.count({
        where: {
          userId: ctx.userId,
          dataPedido: { gte: range.start, lte: range.end },
        },
      }),
      prisma.pedido.aggregate({
        where: {
          userId: ctx.userId,
          status: { in: ['APROVADO', 'CONCLUIDO'] },
          dataPedido: { gte: range.start, lte: range.end },
        },
        _sum: { valorTotal: true },
      }),
      prisma.despesa.aggregate({
        where: {
          userId: ctx.userId,
          createdAt: { gte: range.start, lte: range.end },
        },
        _sum: { valor: true },
      }),
    ]);

    const fat = Number(faturamento._sum.valorTotal || 0);
    const desp = Number(despesas._sum.valor || 0);

    return {
      periodo: range.label,
      totalPedidos,
      faturamento: fat,
      despesas: desp,
      saldo: fat - desp,
    };
  }
}

export const chatQueryService = new ChatQueryService();
