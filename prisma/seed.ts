import { PrismaClient, StatusPedido } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Decimal } from '@prisma/client/runtime/library';

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

  const produtos = await Promise.all([
    prisma.produto.create({
      data: { nome: 'Camiseta Básica', categoria: 'Vestuário', preco: new Decimal(49.9) },
    }),
    prisma.produto.create({
      data: { nome: 'Calça Jeans Slim', categoria: 'Vestuário', preco: new Decimal(159.9) },
    }),
    prisma.produto.create({
      data: { nome: 'Tênis Runner Pro', categoria: 'Calçados', preco: new Decimal(299.9) },
    }),
    prisma.produto.create({
      data: { nome: 'Boné Logo Classic', categoria: 'Acessórios', preco: new Decimal(79.9) },
    }),
    prisma.produto.create({
      data: { nome: 'Mochila Urban', categoria: 'Acessórios', preco: new Decimal(189.9) },
    }),
  ]);
  console.log(`${produtos.length} produtos criados`);

  await Promise.all([
    prisma.estoque.create({
      data: { produtoId: produtos[0].id, quantidade: 150, quantidadeMinima: 20, unidade: 'un' },
    }),
    prisma.estoque.create({
      data: { produtoId: produtos[1].id, quantidade: 80, quantidadeMinima: 15, unidade: 'un' },
    }),
    prisma.estoque.create({
      data: { produtoId: produtos[2].id, quantidade: 5, quantidadeMinima: 10, unidade: 'par' },
    }),
    prisma.estoque.create({
      data: { produtoId: produtos[3].id, quantidade: 0, quantidadeMinima: 10, unidade: 'un' },
    }),
    prisma.estoque.create({
      data: { produtoId: produtos[4].id, quantidade: 45, quantidadeMinima: 10, unidade: 'un' },
    }),
  ]);
  console.log('Estoque criado para todos os produtos');

  const clientes = await Promise.all([
    prisma.cliente.create({
      data: {
        nome: 'João Silva',
        email: 'joao@email.com',
        telefone: '(11) 99999-1111',
        documento: '123.456.789-00',
        endereco: 'Rua das Flores, 123 - São Paulo/SP',
      },
    }),
    prisma.cliente.create({
      data: {
        nome: 'Maria Souza',
        email: 'maria@email.com',
        telefone: '(11) 99999-2222',
        documento: '987.654.321-00',
        endereco: 'Av. Paulista, 1000 - São Paulo/SP',
      },
    }),
    prisma.cliente.create({
      data: {
        nome: 'Carlos Lima',
        email: 'carlos@email.com',
        telefone: '(21) 99999-3333',
        documento: '456.789.123-00',
        endereco: 'Rua Copacabana, 500 - Rio de Janeiro/RJ',
      },
    }),
  ]);
  console.log(`${clientes.length} clientes criados`);

  const pedido1 = await prisma.pedido.create({
    data: {
      numero: '#001',
      clienteId: clientes[0].id,
      dataPedido: new Date('2026-05-26'),
      prazoEntrega: new Date('2026-06-02'),
      status: StatusPedido.CONCLUIDO,
      valorTotal: new Decimal(1250.0),
      enviadoCliente: true,
      itens: {
        create: [
          {
            produtoId: produtos[0].id,
            quantidade: 10,
            precoUnitario: new Decimal(49.9),
            subtotal: new Decimal(499.0),
          },
          {
            produtoId: produtos[2].id,
            quantidade: 2,
            precoUnitario: new Decimal(299.9),
            subtotal: new Decimal(599.8),
          },
        ],
      },
    },
  });

  const pedido2 = await prisma.pedido.create({
    data: {
      numero: '#002',
      clienteId: clientes[1].id,
      dataPedido: new Date('2026-05-25'),
      prazoEntrega: new Date('2026-06-01'),
      status: StatusPedido.PENDENTE,
      valorTotal: new Decimal(890.0),
      itens: {
        create: [
          {
            produtoId: produtos[1].id,
            quantidade: 5,
            precoUnitario: new Decimal(159.9),
            subtotal: new Decimal(799.5),
          },
        ],
      },
    },
  });

  const pedido3 = await prisma.pedido.create({
    data: {
      numero: '#003',
      clienteId: clientes[2].id,
      dataPedido: new Date('2026-05-25'),
      prazoEntrega: new Date('2026-06-05'),
      status: StatusPedido.CONCLUIDO,
      valorTotal: new Decimal(2340.0),
      enviadoCliente: true,
      itens: {
        create: [
          {
            produtoId: produtos[2].id,
            quantidade: 5,
            precoUnitario: new Decimal(299.9),
            subtotal: new Decimal(1499.5),
          },
          {
            produtoId: produtos[4].id,
            quantidade: 4,
            precoUnitario: new Decimal(189.9),
            subtotal: new Decimal(759.6),
          },
        ],
      },
    },
  });

  const pedido4 = await prisma.pedido.create({
    data: {
      numero: '#004',
      clienteId: clientes[0].id,
      dataPedido: new Date('2026-05-24'),
      prazoEntrega: new Date('2026-05-30'),
      status: StatusPedido.CANCELADO,
      valorTotal: new Decimal(560.0),
      itens: {
        create: [
          {
            produtoId: produtos[3].id,
            quantidade: 7,
            precoUnitario: new Decimal(79.9),
            subtotal: new Decimal(559.3),
          },
        ],
      },
    },
  });

  const pedido5 = await prisma.pedido.create({
    data: {
      numero: '#005',
      clienteId: clientes[1].id,
      dataPedido: new Date('2026-05-24'),
      prazoEntrega: new Date('2026-06-03'),
      status: StatusPedido.PENDENTE,
      valorTotal: new Decimal(1780.0),
      itens: {
        create: [
          {
            produtoId: produtos[4].id,
            quantidade: 5,
            precoUnitario: new Decimal(189.9),
            subtotal: new Decimal(949.5),
          },
          {
            produtoId: produtos[1].id,
            quantidade: 5,
            precoUnitario: new Decimal(159.9),
            subtotal: new Decimal(799.5),
          },
        ],
      },
    },
  });

  console.log(`5 pedidos criados: ${pedido1.numero}, ${pedido2.numero}, ${pedido3.numero}, ${pedido4.numero}, ${pedido5.numero}`);
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
