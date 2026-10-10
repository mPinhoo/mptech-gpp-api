import prisma from '../utils/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { emitNotificationEvent, publishNotificacao } from './notification-events.js';

const RECENT_LIMIT = 50;

export class NotificacoesService {
  /** Most recent notifications the user has not removed, read or unread. */
  async findRecent(userId: string) {
    const notificacoes = await prisma.notificacao.findMany({
      where: { userId, arquivadaEm: null },
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
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
      where: { userId, lida: false, arquivadaEm: null },
    });
  }

  async markAsRead(userId: string, id: string) {
    const result = await prisma.notificacao.updateMany({
      where: { id, userId, arquivadaEm: null },
      data: { lida: true },
    });
    if (!result.count) throw new NotFoundError('Notificação');
    emitNotificationEvent(userId, { type: 'sync' });
  }

  /** Single statement scoped to the authenticated user; returns how many changed. */
  async markAllAsRead(userId: string) {
    const result = await prisma.notificacao.updateMany({
      where: { userId, lida: false, arquivadaEm: null },
      data: { lida: true },
    });
    emitNotificationEvent(userId, { type: 'sync' });
    return result.count;
  }

  // Removing archives instead of deleting: the reminder and deadline jobs look up
  // existing notifications to avoid creating the same alert again.
  async archive(userId: string, id: string) {
    const result = await prisma.notificacao.updateMany({
      where: { id, userId, arquivadaEm: null },
      data: { arquivadaEm: new Date(), lida: true },
    });
    if (!result.count) throw new NotFoundError('Notificação');
    emitNotificationEvent(userId, { type: 'sync' });
  }

  async archiveAll(userId: string) {
    const result = await prisma.notificacao.updateMany({
      where: { userId, arquivadaEm: null },
      data: { arquivadaEm: new Date(), lida: true },
    });
    emitNotificationEvent(userId, { type: 'sync' });
    return result.count;
  }

  async createPedidoAprovado(userId: string, pedidoId: string, numero: string, clienteNome: string) {
    const notificacao = await prisma.notificacao.create({
      data: {
        userId,
        pedidoId,
        tipo: 'PEDIDO_APROVADO',
        titulo: 'Pedido aceito pelo cliente',
        mensagem: `${clienteNome} aceitou o pedido ${numero}.`,
      },
    });
    publishNotificacao(notificacao);
  }
}

export const notificacoesService = new NotificacoesService();
