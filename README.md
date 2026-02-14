# template-node-nestjs

Template NestJS production-ready com Fastify, Prisma, JWT, RBAC e boas práticas.

## Stack

- **Runtime**: NestJS + Fastify
- **Banco**: PostgreSQL + Prisma ORM
- **Auth**: JWT (access + refresh) + argon2
- **Validação**: Zod (env, body, query, params)
- **Permissões**: RBAC (roles + permissions) + owner-or-permission
- **Docs**: Swagger
- **Deploy**: Docker multi-stage + docker-compose

## Quick Start

### 1. Clonar e instalar

```bash
git clone <repo-url> my-api
cd my-api
npm install
```

### 2. Configurar ambiente

```bash
cp .env.example .env
# Editar .env com suas variáveis
```

### 3. Subir banco (Docker)

```bash
docker-compose up -d db
```

### 4. Rodar migrations e seed

```bash
npx prisma migrate dev
npm run prisma:seed
```

### 5. Iniciar em dev

```bash
npm run start:dev
```

A API estará em `http://localhost:3000`.
Swagger em `http://localhost:3000/docs`.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run start:dev` | Dev com hot-reload |
| `npm run start:prod` | Produção |
| `npm run build` | Build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes e2e |
| `npm run test:cov` | Coverage |
| `npm run prisma:migrate` | Criar migration |
| `npm run prisma:deploy` | Aplicar migrations |
| `npm run prisma:seed` | Seed do banco |
| `npm run prisma:studio` | Prisma Studio |

## Variáveis de Ambiente

```env
# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://template:template@localhost:5432/template

# JWT
JWT_ACCESS_SECRET=your-access-secret-here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:4200

# Crypto (opcional — para campos sensíveis)
CRYPTO_KEY=your-32-byte-hex-key
```

## Estrutura do Projeto

```
src/
├── common/
│   ├── constants/       # error codes, enums
│   ├── decorators/      # @CurrentUser, @Roles, @Permissions
│   ├── filters/         # GlobalExceptionFilter
│   ├── guards/          # JwtAuth, UserStatus, Roles, Permissions, OwnerOrPermission
│   ├── interceptors/    # Response interceptor (opcional)
│   ├── pipes/           # ZodBodyPipe, ZodQueryPipe, ZodParamsPipe
│   └── utils/           # pagination, crypto
├── config/              # env validation, config objects (app, db, jwt, cors, crypto)
├── modules/
│   ├── auth/            # register, login, refresh, logout
│   ├── health/          # /health, /health/db
│   └── user/            # CRUD, roles, permissions
├── prisma/              # PrismaModule, PrismaService
├── app.module.ts
└── main.ts
prisma/
├── schema.prisma
├── seed.ts
└── migrations/
```

## Auth Flow

1. **Register** `POST /auth/register` → cria user + retorna tokens
2. **Login** `POST /auth/login` → valida credenciais + retorna tokens
3. **Refresh** `POST /auth/refresh` → rotação de refresh token
4. **Logout** `POST /auth/logout` → revoga refresh token

Access token: **15min** · Refresh token: **7 dias** (com rotação)

## Paginação

**Cursor** (padrão para APIs públicas):
```
GET /users?cursor=abc123&take=20
→ { data: [...], meta: { nextCursor, hasNext } }
```

**Offset** (admin/backoffice):
```
GET /admin/users?page=1&limit=20
→ { data: [...], meta: { page, limit, total, totalPages } }
```

## Deploy com Docker

```bash
# Build e subir tudo
docker-compose up -d

# Apenas build da imagem
docker build -t template-nestjs .
```

O container roda `prisma migrate deploy` automaticamente antes de iniciar.

## Seed padrão

O seed cria:

- **Permissions**: `user:read`, `user:write`, `user:delete`, `role:read`, `role:write`
- **Roles**: `admin` (todas as permissions), `user` (user:read)
- **Admin**: `admin@template.com` / `Admin@123`

## Como construir este template

Use o workflow do Windsurf:

```
/template-node-nestjs
```

Ou siga o guia passo a passo em `.windsurf/workflows/template-node-nestjs.md`.
