# MPTech GPP API

Backend REST API para o sistema MPTech GPP (Gestão de Pedidos e Produtos).

## Stack

- Node.js 22+ (LTS)
- TypeScript
- Express.js 5
- Prisma ORM
- PostgreSQL
- JWT para autenticação
- Zod para validação
- Jest para testes

## Pré-requisitos

- Node.js >= 22.x
- PostgreSQL rodando localmente ou via Docker
- npm

## Setup

1. Clone o repositório e instale as dependências:

```bash
git clone https://github.com/mPinhoo/mptech-gpp-api.git
cd mptech-gpp-api
npm install
```

2. Configure as variáveis de ambiente:

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais do PostgreSQL:

```
DATABASE_URL="postgresql://user:password@localhost:5432/mptech_gpp?schema=public"
JWT_SECRET="sua-chave-secreta-aqui"
PORT=3001
```

3. Execute as migrations do banco:

```bash
npm run migrate
```

4. Gere o Prisma Client:

```bash
npm run generate
```

5. (Opcional) Popule o banco com dados de exemplo:

```bash
npm run seed
```

Dados do seed:
- Admin: `admin@mptech.com` / `senha123`
- 5 produtos, 3 clientes, 5 pedidos com itens, estoque

## Executando

### Desenvolvimento

```bash
npm run dev
```

A API estará disponível em `http://localhost:3001`.

### Produção

```bash
npm run build
npm start
```

## Testes

```bash
npm test               # Executa todos os testes
npm run test:watch     # Modo watch
npm run test:coverage  # Com cobertura
```

## Endpoints

### Autenticação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login (retorna token) |
| POST | `/api/auth/register` | Cadastro de usuário |
| GET | `/api/auth/me` | Dados do usuário logado |

### Dashboard

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/dashboard/stats` | Estatísticas do mês |
| GET | `/api/dashboard/chart` | Dados do gráfico (últimos 5 meses) |

### Produtos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/produtos` | Listar (filtros: `?ativo=true&search=xxx`) |
| GET | `/api/produtos/:id` | Detalhe |
| POST | `/api/produtos` | Criar |
| PUT | `/api/produtos/:id` | Atualizar |
| DELETE | `/api/produtos/:id` | Soft delete |

### Estoque

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/estoque` | Listar com status calculado |
| GET | `/api/estoque/:id` | Detalhe |
| POST | `/api/estoque/entrada` | Entrada de estoque |
| POST | `/api/estoque/saida` | Saída de estoque |
| PUT | `/api/estoque/:id` | Atualizar mínimo/unidade |

### Pedidos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/pedidos` | Listar (filtros: `?status=xxx&search=xxx`) |
| GET | `/api/pedidos/:id` | Detalhe com itens |
| POST | `/api/pedidos` | Criar pedido completo |
| PUT | `/api/pedidos/:id` | Atualizar (apenas pendentes) |
| PUT | `/api/pedidos/:id/status` | Alterar status |
| POST | `/api/pedidos/:id/enviar` | Marcar como enviado |
| DELETE | `/api/pedidos/:id` | Cancelar pedido |

### Clientes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/clientes` | Listar (filtro: `?search=xxx`) |
| GET | `/api/clientes/:id` | Detalhe com pedidos |
| POST | `/api/clientes` | Criar |
| PUT | `/api/clientes/:id` | Atualizar |
| DELETE | `/api/clientes/:id` | Soft delete |

## Autenticação

Todas as rotas (exceto login e register) requerem token JWT no header:

```
Authorization: Bearer <token>
```

## Formato de Resposta

```json
// Sucesso
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 50 } }

// Erro
{ "success": false, "error": { "message": "...", "code": "..." } }
```

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento com hot-reload |
| `npm run build` | Compila TypeScript |
| `npm start` | Executa versão compilada |
| `npm run migrate` | Executa migrations do Prisma |
| `npm run generate` | Gera o Prisma Client |
| `npm run seed` | Popula banco com dados de exemplo |
| `npm test` | Executa testes |
| `npm run test:watch` | Testes em modo watch |
| `npm run test:coverage` | Testes com relatório de cobertura |
