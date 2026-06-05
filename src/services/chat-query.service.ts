import prisma from '../utils/prisma.js';
import { userCan } from './permissions.service.js';
import type { MenuKey } from '../constants/menus.js';
import {
  type PeriodoInput,
  periodoToDateFilter,
  resolveChatPeriodo,
} from '../utils/chat-period.js';

const MARGEM_ESTOQUE_BAIXO = 31;

export interface ChatUserContext {
  userId: string;
  email: string;
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

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

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
  async getEstoque(
    ctx: ChatUserContext,
    filtro: 'baixo_ou_critico' | 'baixo' | 'critico' | 'normal' | 'todos' = 'baixo_ou_critico'
  ) {
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

    const mapeados = itens.map(
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
    );

    const filtrados = mapeados.filter((item: EstoqueItem) => {
      switch (filtro) {
        case 'baixo':
          return item.status === 'Baixo';
        case 'critico':
          return item.status === 'Crítico';
        case 'normal':
          return item.status === 'Normal';
        case 'todos':
          return true;
        default:
          return item.status === 'Baixo' || item.status === 'Crítico';
      }
    });

    return {
      filtro,
      total: filtrados.length,
      criticos: filtrados.filter((i: EstoqueItem) => i.status === 'Crítico').length,
      baixos: filtrados.filter((i: EstoqueItem) => i.status === 'Baixo').length,
      itens: filtrados,
      nota: 'Estoque no Zentra refere-se a matérias-primas/insumos usados na produção.',
    };
  }

  async getPedidos(
    ctx: ChatUserContext,
    periodoInput: PeriodoInput = {},
    status?: string,
    incluirResumoStatus = true
  ) {
    const perm = await checkPermission(ctx, 'pedidos');
    if (!perm.allowed) return { error: perm.message };

    const range = resolveChatPeriodo(periodoInput);
    const dataFilter = periodoToDateFilter(range);

    const where: Record<string, unknown> = {
      userId: ctx.userId,
      dataPedido: dataFilter,
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    const [total, pedidos, valorTotal, resumoStatus] = await Promise.all([
      prisma.pedido.count({ where }),
      prisma.pedido.findMany({
        where,
        take: 15,
        orderBy: { dataPedido: 'desc' },
        include: { cliente: { select: { nome: true } } },
      }),
      prisma.pedido.aggregate({ where, _sum: { valorTotal: true } }),
      incluirResumoStatus && !status
        ? prisma.pedido.groupBy({
            by: ['status'],
            where: { userId: ctx.userId, dataPedido: dataFilter },
            _count: { id: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      periodo: range.label,
      total,
      valorTotal: Number(valorTotal._sum.valorTotal || 0),
      statusFiltro: status ? STATUS_LABEL[status.toUpperCase()] || status : null,
      porStatus: Array.isArray(resumoStatus)
        ? resumoStatus.map((g: { status: string; _count: { id: number } }) => ({
            status: STATUS_LABEL[g.status] || g.status,
            quantidade: g._count.id,
          }))
        : [],
      pedidos: pedidos.map((p: (typeof pedidos)[number]) => ({
        numero: p.numero,
        cliente: p.cliente.nome,
        data: formatDateBR(p.dataPedido),
        valor: formatCurrency(Number(p.valorTotal)),
        status: STATUS_LABEL[p.status] || p.status,
      })),
    };
  }

  async getClientes(
    ctx: ChatUserContext,
    tipo: 'total' | 'recorrentes' | 'inativos' = 'total',
    opcoes: { limite?: number; periodoMeses?: number; diasSemPedir?: number } = {}
  ) {
    const perm = await checkPermission(ctx, 'clientes');
    if (!perm.allowed) return { error: perm.message };

    const limite = opcoes.limite ?? 10;
    const periodoMeses = opcoes.periodoMeses ?? 12;
    const diasSemPedir = opcoes.diasSemPedir ?? 30;

    if (tipo === 'total') {
      const [ativos, inativos, comPedido, semPedido] = await Promise.all([
        prisma.cliente.count({ where: { userId: ctx.userId, ativo: true } }),
        prisma.cliente.count({ where: { userId: ctx.userId, ativo: false } }),
        prisma.cliente.count({
          where: { userId: ctx.userId, ativo: true, pedidos: { some: {} } },
        }),
        prisma.cliente.count({
          where: { userId: ctx.userId, ativo: true, pedidos: { none: {} } },
        }),
      ]);

      return {
        tipo: 'total',
        ativos,
        inativos,
        comPedido,
        semPedido,
        totalGeral: ativos + inativos,
      };
    }

    if (tipo === 'recorrentes') {
      const hoje = new Date();
      const start = resolveChatPeriodo({
        periodo: 'ultimos_n_dias',
        dias: periodoMeses * 30,
      }).start!;

      const grupos = await prisma.pedido.groupBy({
        by: ['clienteId'],
        where: {
          userId: ctx.userId,
          dataPedido: { gte: start, lte: resolveChatPeriodo({ periodo: 'hoje' }).end },
          status: { not: 'CANCELADO' },
        },
        _count: { id: true },
        _sum: { valorTotal: true },
        orderBy: { _count: { id: 'desc' } },
        take: limite,
      });

      if (grupos.length === 0) {
        return { tipo: 'recorrentes', periodoMeses, clientes: [] };
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
        tipo: 'recorrentes',
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

    const threshold = resolveChatPeriodo({
      periodo: 'ultimos_n_dias',
      dias: diasSemPedir,
    }).start!;

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
      where: { userId: ctx.userId, ativo: true, pedidos: { none: {} } },
      take: Math.max(0, limite - inativos.length),
      select: { id: true, nome: true, telefone: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      tipo: 'inativos',
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

  async getProdutos(
    ctx: ChatUserContext,
    tipo: 'total' | 'mais_vendidos' | 'menos_vendidos' = 'total',
    periodoInput: PeriodoInput = {},
    limite = 10
  ) {
    const perm = await checkPermission(ctx, 'produtos');
    if (!perm.allowed) return { error: perm.message };

    if (tipo === 'total') {
      const [ativos, inativos, foraDeCiclo] = await Promise.all([
        prisma.produto.count({ where: { userId: ctx.userId, status: 'ATIVO' } }),
        prisma.produto.count({ where: { userId: ctx.userId, status: 'INATIVO' } }),
        prisma.produto.count({ where: { userId: ctx.userId, status: 'FORA_DE_CICLO' } }),
      ]);
      return { tipo: 'total', ativos, inativos, foraDeCiclo, total: ativos + inativos + foraDeCiclo };
    }

    const range = resolveChatPeriodo(periodoInput);
    const dataFilter = periodoToDateFilter(range);

    const grupos = await prisma.itemPedido.groupBy({
      by: ['produtoId'],
      where: {
        pedido: {
          userId: ctx.userId,
          dataPedido: dataFilter,
          status: { not: 'CANCELADO' },
        },
      },
      _sum: { quantidade: true },
      orderBy: { _sum: { quantidade: tipo === 'menos_vendidos' ? 'asc' : 'desc' } },
      take: limite,
    });

    if (grupos.length === 0) {
      return { tipo, periodo: range.label, produtos: [] };
    }

    const produtoIds = grupos.map((g: (typeof grupos)[number]) => g.produtoId);
    const produtos = await prisma.produto.findMany({
      where: { id: { in: produtoIds }, userId: ctx.userId },
      select: { id: true, nome: true, categoria: true },
    });
    type ProdutoResumo = { id: string; nome: string; categoria: string };
    const produtoMap = new Map<string, ProdutoResumo>(
      produtos.map((p: ProdutoResumo) => [p.id, p])
    );

    return {
      tipo,
      periodo: range.label,
      produtos: grupos.map((g: (typeof grupos)[number]) => {
        const produto = produtoMap.get(g.produtoId);
        return {
          nome: produto?.nome ?? 'Produto removido',
          categoria: produto?.categoria,
          quantidadeVendida: g._sum.quantidade ?? 0,
        };
      }),
      nota: 'Baseado na quantidade vendida em pedidos (exceto cancelados).',
    };
  }

  async getMateriaisMovimentacao(
    ctx: ChatUserContext,
    tipo: 'entradas' | 'consumo' = 'entradas',
    periodoInput: PeriodoInput = {},
    limite = 10,
    ordenar: 'mais' | 'menos' = 'mais'
  ) {
    const perm = await checkPermission(ctx, 'estoque');
    if (!perm.allowed) return { error: perm.message };

    const range = resolveChatPeriodo(periodoInput);

    if (tipo === 'entradas') {
      const despesas = await prisma.despesa.findMany({
        where: {
          userId: ctx.userId,
          materiaPrimaId: { not: null },
          createdAt: periodoToDateFilter(range),
          descricao: { startsWith: 'Entrada estoque:' },
        },
        include: { materiaPrima: { select: { nome: true, unidade: true } } },
      });

      const mapa = new Map<string, { nome: string; unidade: string; entradas: number; quantidade: number }>();

      for (const d of despesas) {
        const id = d.materiaPrimaId!;
        const match = d.descricao.match(/\(x(\d+)\)/);
        const qtd = match ? parseInt(match[1], 10) : 1;
        const atual = mapa.get(id) ?? {
          nome: d.materiaPrima?.nome ?? 'Material',
          unidade: d.materiaPrima?.unidade ?? 'un',
          entradas: 0,
          quantidade: 0,
        };
        atual.entradas += 1;
        atual.quantidade += qtd;
        mapa.set(id, atual);
      }

      const lista = [...mapa.values()].sort((a, b) =>
        ordenar === 'menos' ? a.quantidade - b.quantidade : b.quantidade - a.quantidade
      );

      return {
        tipo: 'entradas',
        periodo: range.label,
        materiais: lista.slice(0, limite),
        nota: 'Entradas registradas no estoque no período.',
      };
    }

    const pedidos = await prisma.pedido.findMany({
      where: {
        userId: ctx.userId,
        dataPedido: periodoToDateFilter(range),
        status: { in: ['APROVADO', 'CONCLUIDO'] },
      },
      include: {
        itens: {
          include: {
            produto: {
              include: {
                materiais: { include: { materiaPrima: { select: { id: true, nome: true, unidade: true } } } },
              },
            },
          },
        },
      },
    });

    const consumo = new Map<string, { nome: string; unidade: string; quantidade: number }>();

    for (const pedido of pedidos) {
      for (const item of pedido.itens) {
        for (const mat of item.produto.materiais) {
          const qtd = Number(mat.quantidade) * item.quantidade;
          const id = mat.materiaPrima.id;
          const atual = consumo.get(id) ?? {
            nome: mat.materiaPrima.nome,
            unidade: mat.materiaPrima.unidade,
            quantidade: 0,
          };
          atual.quantidade += qtd;
          consumo.set(id, atual);
        }
      }
    }

    const lista = [...consumo.values()].sort((a, b) =>
      ordenar === 'menos' ? a.quantidade - b.quantidade : b.quantidade - a.quantidade
    );

    return {
      tipo: 'consumo',
      periodo: range.label,
      materiais: lista.slice(0, limite),
      nota: 'Consumo estimado com base em pedidos aprovados/concluídos e materiais dos produtos.',
    };
  }

  async getFaturamento(
    ctx: ChatUserContext,
    periodoInput: PeriodoInput = {},
    incluirDespesas = false
  ) {
    const perm = await checkPermission(ctx, 'home');
    if (!perm.allowed) return { error: perm.message };

    const range = resolveChatPeriodo(periodoInput);
    const dataPedidoFilter = periodoToDateFilter(range);
    const faturamentoWhere = {
      userId: ctx.userId,
      status: { in: ['APROVADO', 'CONCLUIDO'] as const },
      dataPedido: dataPedidoFilter,
    };

    const [totalPedidos, faturamentoAgg, porStatus, despesasAgg] = await Promise.all([
      prisma.pedido.count({
        where: { userId: ctx.userId, dataPedido: dataPedidoFilter },
      }),
      prisma.pedido.aggregate({
        where: faturamentoWhere,
        _sum: { valorTotal: true },
        _count: { id: true },
      }),
      prisma.pedido.groupBy({
        by: ['status'],
        where: faturamentoWhere,
        _sum: { valorTotal: true },
        _count: { id: true },
      }),
      incluirDespesas
        ? prisma.despesa.aggregate({
            where: { userId: ctx.userId, createdAt: periodoToDateFilter(range) },
            _sum: { valor: true },
          })
        : Promise.resolve({ _sum: { valor: null } }),
    ]);

    const fat = Number(faturamentoAgg._sum.valorTotal || 0);
    const pedidosFaturados = faturamentoAgg._count.id;
    const ticketMedio = pedidosFaturados > 0 ? fat / pedidosFaturados : 0;
    const desp = Number(despesasAgg._sum.valor || 0);

    const detalheStatus = porStatus.map(
      (g: { status: string; _sum: { valorTotal: unknown }; _count: { id: number } }) => ({
        status: STATUS_LABEL[g.status] || g.status,
        quantidade: g._count.id,
        valor: Number(g._sum.valorTotal || 0),
      })
    );

    const result: Record<string, unknown> = {
      periodo: range.label,
      dataDe: range.start ? formatDateBR(range.start) : null,
      dataAte: formatDateBR(range.end),
      faturamento: fat,
      pedidosFaturados,
      ticketMedio,
      totalPedidosNoPeriodo: totalPedidos,
      detalhePorStatus: detalheStatus,
      regra:
        'Faturamento = soma do valor de pedidos Aprovados e Concluídos, pela data do pedido.',
    };

    if (incluirDespesas) {
      result.despesas = desp;
      result.saldo = fat - desp;
    }

    return result;
  }

  async getResumoFinanceiro(ctx: ChatUserContext, periodoInput: PeriodoInput = {}) {
    return this.getFaturamento(ctx, periodoInput, true);
  }

  // Aliases para compatibilidade
  async getEstoqueBaixo(ctx: ChatUserContext) {
    return this.getEstoque(ctx, 'baixo_ou_critico');
  }

  async getPedidosPeriodo(
    ctx: ChatUserContext,
    periodo = 'mes',
    dataDe?: string,
    dataAte?: string,
    status?: string
  ) {
    return this.getPedidos(
      ctx,
      { periodo: periodo as PeriodoInput['periodo'], data_de: dataDe, data_ate: dataAte },
      status
    );
  }

  async getClientesRecorrentes(ctx: ChatUserContext, limite = 10, periodoMeses = 12) {
    return this.getClientes(ctx, 'recorrentes', { limite, periodoMeses });
  }

  async getClientesInativos(ctx: ChatUserContext, diasSemPedir = 30, limite = 20) {
    return this.getClientes(ctx, 'inativos', { diasSemPedir, limite });
  }
}

export const chatQueryService = new ChatQueryService();
