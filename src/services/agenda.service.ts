import prisma from '../utils/prisma.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { CreateLembreteInput, UpdateLembreteInput } from '../schemas/agenda.schema.js';
import {
  combineDateTimeBR,
  extractDateBR,
  extractTimeBR,
} from '../utils/datetime-br.js';

const MAX_LEMBRETES_POR_DIA = 5;

function formatLembrete(item: {
  id: string;
  titulo: string;
  descricao: string | null;
  dataReferencia: string;
  agendadoPara: Date;
  notificado: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  const horario = extractTimeBR(item.agendadoPara);

  return {
    id: item.id,
    titulo: item.titulo,
    descricao: item.descricao,
    data: item.dataReferencia,
    horario,
    agendadoPara: item.agendadoPara,
    notificado: item.notificado,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export class AgendaService {
  async findByRange(userId: string, de: string, ate: string) {
    const start = combineDateTimeBR(de, '00:00');
    const end = combineDateTimeBR(ate, '23:59');

    const lembretes = await prisma.lembrete.findMany({
      where: {
        userId,
        agendadoPara: { gte: start, lte: end },
      },
      orderBy: [{ agendadoPara: 'asc' }],
    });

    return lembretes.map(formatLembrete);
  }

  async findByDay(userId: string, data: string) {
    const lembretes = await prisma.lembrete.findMany({
      where: { userId, dataReferencia: data },
      orderBy: { agendadoPara: 'asc' },
    });

    return lembretes.map(formatLembrete);
  }

  async create(userId: string, input: CreateLembreteInput) {
    const agendadoPara = combineDateTimeBR(input.data, input.horario);

    if (agendadoPara.getTime() <= Date.now()) {
      throw new AppError('O lembrete deve ser agendado para uma data e horário futuros', 400);
    }

    const count = await prisma.lembrete.count({
      where: { userId, dataReferencia: input.data },
    });

    if (count >= MAX_LEMBRETES_POR_DIA) {
      throw new AppError('Limite de 5 lembretes por dia atingido', 400, 'MAX_LEMBRETES_DIA');
    }

    const lembrete = await prisma.lembrete.create({
      data: {
        userId,
        titulo: input.titulo.trim(),
        descricao: input.descricao?.trim() || null,
        dataReferencia: input.data,
        agendadoPara,
      },
    });

    return formatLembrete(lembrete);
  }

  async update(userId: string, id: string, input: UpdateLembreteInput) {
    const existing = await prisma.lembrete.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundError('Lembrete');
    }

    if (existing.notificado) {
      throw new AppError('Não é possível editar um lembrete já notificado', 400);
    }

    const data = input.data ?? existing.dataReferencia;
    const horario = input.horario ?? extractTimeBR(existing.agendadoPara);

    const agendadoPara = combineDateTimeBR(data, horario);

    if (agendadoPara.getTime() <= Date.now()) {
      throw new AppError('O lembrete deve ser agendado para uma data e horário futuros', 400);
    }

    if (data !== existing.dataReferencia) {
      const count = await prisma.lembrete.count({
        where: { userId, dataReferencia: data, id: { not: id } },
      });

      if (count >= MAX_LEMBRETES_POR_DIA) {
        throw new AppError('Limite de 5 lembretes por dia atingido', 400, 'MAX_LEMBRETES_DIA');
      }
    }

    const lembrete = await prisma.lembrete.update({
      where: { id },
      data: {
        titulo: input.titulo?.trim() ?? existing.titulo,
        descricao:
          input.descricao !== undefined
            ? input.descricao.trim() || null
            : existing.descricao,
        dataReferencia: data,
        agendadoPara,
      },
    });

    return formatLembrete(lembrete);
  }

  async delete(userId: string, id: string) {
    const existing = await prisma.lembrete.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundError('Lembrete');
    }

    await prisma.lembrete.delete({ where: { id } });
  }

  async findPedidosByRange(userId: string, de: string, ate: string) {
    const start = combineDateTimeBR(de, '00:00');
    const end = combineDateTimeBR(ate, '23:59');

    const statusMap: Record<string, string> = {
      PENDENTE: 'Pendente',
      APROVADO: 'Aprovado',
      CONCLUIDO: 'Concluído',
      CANCELADO: 'Cancelado',
    };

    const pedidos = await prisma.pedido.findMany({
      where: {
        userId,
        status: { not: 'CANCELADO' },
        prazoEntrega: { gte: start, lte: end },
      },
      include: {
        cliente: { select: { nome: true } },
      },
      orderBy: [{ prazoEntrega: 'asc' }, { numero: 'asc' }],
    });

    return pedidos.map((pedido) => ({
      id: pedido.id,
      numero: pedido.numero,
      cliente: pedido.cliente.nome,
      prazoEntrega: extractDateBR(pedido.prazoEntrega),
      status: statusMap[pedido.status] || pedido.status,
      valor: Number(pedido.valorTotal).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    }));
  }
}

export const agendaService = new AgendaService();

export async function processarLembretesPendentes() {
  const now = new Date();

  const pendentes = await prisma.lembrete.findMany({
    where: {
      notificado: false,
      agendadoPara: { lte: now },
    },
    take: 50,
  });

  for (const lembrete of pendentes) {
    const horario = lembrete.agendadoPara.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });

    await prisma.$transaction([
      prisma.notificacao.create({
        data: {
          userId: lembrete.userId,
          lembreteId: lembrete.id,
          tipo: 'AGENDA_LEMBRETE',
          titulo: lembrete.titulo,
          mensagem:
            lembrete.descricao?.trim() ||
            `Lembrete agendado para ${horario}.`,
        },
      }),
      prisma.lembrete.update({
        where: { id: lembrete.id },
        data: { notificado: true },
      }),
    ]);
  }

  return pendentes.length;
}
