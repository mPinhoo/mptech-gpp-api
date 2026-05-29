import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillTable(table: string, userId: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET "userId" = $1 WHERE "userId" IS NULL`,
    userId
  );
}

async function main() {
  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!firstUser) {
    console.log('Nenhum usuário encontrado. Nada a migrar.');
    return;
  }

  const userId = firstUser.id;
  console.log(`Atribuindo dados existentes ao usuário: ${firstUser.email}`);

  await backfillTable('Cliente', userId);
  await backfillTable('Produto', userId);
  await backfillTable('MateriaPrima', userId);
  await backfillTable('Pedido', userId);
  await backfillTable('Despesa', userId);
  await backfillTable('KanbanColuna', userId);

  const config = await prisma.configPrecificacao.findFirst();
  if (config && !config.userId) {
    await prisma.configPrecificacao.update({
      where: { id: config.id },
      data: { userId },
    });
  }

  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  for (const user of users) {
    const configExists = await prisma.configPrecificacao.findUnique({ where: { userId: user.id } });
    if (!configExists) {
      await prisma.configPrecificacao.create({ data: { userId: user.id } });
    }

    const colunasCount = await prisma.kanbanColuna.count({ where: { userId: user.id } });
    if (colunasCount === 0) {
      await prisma.kanbanColuna.createMany({
        data: [
          { userId: user.id, nome: 'Aguardando Produção', ordem: 0, sistema: true },
          { userId: user.id, nome: 'Em Produção', ordem: 1, sistema: true },
          { userId: user.id, nome: 'Finalizado', ordem: 2, sistema: true },
        ],
      });
    }
  }

  console.log('Backfill concluído.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
