import prisma from '../utils/prisma.js';
import {
  buildMensagemAlertaPrazo,
  calcularAlertaPrazo,
  startOfDay,
} from '../utils/prazo-alerta.js';

export async function processarAlertasPrazoPedidos() {
  const pedidos = await prisma.pedido.findMany({
    where: {
      status: 'APROVADO',
      kanbanColunaId: { not: null },
    },
    include: {
      cliente: { select: { nome: true } },
      kanbanColuna: { select: { nome: true } },
    },
  });

  let created = 0;

  for (const pedido of pedidos) {
    const colunaNome = pedido.kanbanColuna?.nome;
    if (!calcularAlertaPrazo(pedido.prazoEntrega, colunaNome)) {
      continue;
    }

    const alreadyNotifiedToday = await prisma.notificacao.findFirst({
      where: {
        pedidoId: pedido.id,
        tipo: 'PEDIDO_PRAZO_ALERTA',
        createdAt: { gte: startOfDay(new Date()) },
      },
    });

    if (alreadyNotifiedToday) {
      continue;
    }

    await prisma.notificacao.create({
      data: {
        userId: pedido.userId,
        pedidoId: pedido.id,
        tipo: 'PEDIDO_PRAZO_ALERTA',
        titulo: 'Alerta de prazo de entrega',
        mensagem: buildMensagemAlertaPrazo(
          pedido.numero,
          pedido.cliente.nome,
          pedido.prazoEntrega
        ),
      },
    });

    created += 1;
  }

  return created;
}
