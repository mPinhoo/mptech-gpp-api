import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';

const DEFAULT_KANBAN_COLUNAS = [
  { nome: 'Aguardando Produção', ordem: 0, sistema: true },
  { nome: 'Em Produção', ordem: 1, sistema: true },
  { nome: 'Finalizado', ordem: 2, sistema: true },
];

export async function initializeNewUser(userId: string, db: Prisma.TransactionClient = prisma) {
  await db.configPrecificacao.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const colunasCount = await db.kanbanColuna.count({ where: { userId } });
  if (colunasCount === 0) {
    await db.kanbanColuna.createMany({
      data: DEFAULT_KANBAN_COLUNAS.map((coluna) => ({ ...coluna, userId })),
    });
  }
}

export async function ensureUserDefaults(userId: string) {
  await initializeNewUser(userId);
}
