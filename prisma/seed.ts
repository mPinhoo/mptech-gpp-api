import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  await prisma.itemPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.estoque.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      nome: 'Administrador',
      email: 'admin@mptech.com',
      senha: await bcrypt.hash('senha123', 10),
      ativo: true,
    },
  });
  console.log(`Usuário criado: ${admin.email}`);

  console.log('Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
