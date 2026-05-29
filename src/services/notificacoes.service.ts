import prisma from '../utils/prisma.js';
import { NotFoundError } from '../utils/errors.js';

export class NotificacoesService {
  async findUnread(userId: string) {
    const notificacoes = await prisma.notificacao.findMany({
      where: { userId, lida: false },
      orderBy: { createdAt: 'desc' },
      include: {
        pedido: { select: { id: true, numero: true } },
        lembrete: { select: { id: true, dataReferencia: true } },
      },
    });

    return notificacoes.map((item) => ({
      id: item.id,
      tipo: item.tipo,
      titulo: item.titulo,
      mensagem: item.mensagem,
      lida: item.lida,
      createdAt: item.createdAt,
      pedido: item.pedido,
      lembrete: item.lembrete,
    }));
  }

  async countUnread(userId: string) {
    return prisma.notificacao.count({
      where: { userId, lida: false },
    });
  }

  async markAsRead(userId: string, id: string) {
    const existing = await prisma.notificacao.findFirst({
      where: { id, userId, lida: false },
    });

    if (!existing) {
      throw new NotFoundError('Notificação');
    }

    await prisma.notificacao.update({
      where: { id },
      data: { lida: true },
    });
  }

  async createPedidoAprovado(userId: string, pedidoId: string, numero: string, clienteNome: string) {
    await prisma.notificacao.create({
      data: {
        userId,
        pedidoId,
        tipo: 'PEDIDO_APROVADO',
        titulo: 'Pedido aceito pelo cliente',
        mensagem: `${clienteNome} aceitou o pedido ${numero}.`,
      },
    });
  }
}

export const notificacoesService = new NotificacoesService();
