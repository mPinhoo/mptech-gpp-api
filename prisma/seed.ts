import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const MENU_KEYS = [
  'home',
  'agenda',
  'pedidos',
  'area_trabalho',
  'produtos',
  'clientes',
  'estoque',
  'precificacao',
  'administrativo_usuarios',
  'administrativo_permissoes',
] as const;

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  const grupoAdmin = await prisma.grupoPermissao.upsert({
    where: { nome: 'Administrador' },
    update: {},
    create: {
      nome: 'Administrador',
      descricao: 'Acesso completo a todos os menus',
      sistema: true,
      permissoes: {
        create: MENU_KEYS.map((menu) => ({
          menu,
          leitura: true,
          criar: true,
          editar: true,
        })),
      },
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@mptech.com' },
    update: { grupoPermissaoId: grupoAdmin.id },
    create: {
      nome: 'Administrador',
      email: 'admin@mptech.com',
      senha: await bcrypt.hash('senha123', 10),
      ativo: true,
      grupoPermissaoId: grupoAdmin.id,
    },
  });

  console.log(`Grupo criado: ${grupoAdmin.nome}`);
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
