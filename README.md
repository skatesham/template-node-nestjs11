# Template Node NestJS

API REST production-ready com NestJS 11, Fastify, Prisma, JWT, RBAC e boas práticas.

## Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| **Framework** | NestJS 11 + Fastify 5 |
| **Banco de dados** | PostgreSQL 16 + Prisma ORM 6 |
| **Autenticação** | JWT (access + refresh com rotação) + argon2 |
| **Autorização** | RBAC (roles + permissions) + owner-or-permission guard |
| **Validação** | Zod 4 (env, body, query, params) |
| **Documentação** | Swagger (OpenAPI) |
| **Segurança** | Helmet, Rate Limit, CORS |
| **Logging** | Pino (structured JSON) |
| **Deploy** | Docker multi-stage + docker-compose |
| **Testes** | Jest + Supertest + testes integrados com banco real |

---

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
```

Edite o `.env` com seus valores (veja [Variáveis de Ambiente](#variáveis-de-ambiente)).

### 3. Subir com Docker (recomendado)

```bash
docker compose up -d
```

Isso sobe o PostgreSQL, aplica migrations, roda o seed e inicia a API automaticamente.

- **API**: http://localhost:3000
- **Swagger**: http://localhost:3000/docs

### 3b. Sem Docker (desenvolvimento local)

```bash
# Subir apenas o banco
docker compose up -d db

# Aplicar migrations e seed
npx prisma migrate dev
npm run prisma:seed

# Iniciar em modo dev (hot-reload)
npm run start:dev
```

### 4. Credenciais padrão

Após o seed, um usuário admin é criado:

| Campo | Valor |
|-------|-------|
| **Email** | `admin@template.com` |
| **Senha** | `Admin@123` |
| **Role** | `admin` (todas as permissions) |

---

## Variáveis de Ambiente

```env
# ── App ──
NODE_ENV=development
PORT=3000

# ── Database ──
DATABASE_URL=postgresql://template:template@localhost:5432/template

# ── JWT ──
JWT_ACCESS_SECRET=change-me-access-secret-min-32-chars!!
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change-me-refresh-secret-min-32-chars!!
JWT_REFRESH_EXPIRES_IN=7d

# ── CORS ──
CORS_ORIGINS=http://localhost:3000,http://localhost:4200

# ── Crypto (opcional — AES-256-GCM) ──
# CRYPTO_KEY=your-64-char-hex-key-here
# CRYPTO_IV_LENGTH=16
```

Todas as variáveis são validadas com Zod na inicialização. A app não sobe se alguma obrigatória estiver faltando.

---

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run start:dev` | Inicia em modo dev com hot-reload |
| `npm run start:prod` | Inicia em modo produção (`node dist/src/main`) |
| `npm run build` | Compila o projeto |
| `npm run lint` | Roda ESLint com auto-fix |
| `npm run format` | Formata com Prettier |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes e2e |
| `npm run test:cov` | Testes com coverage |
| `npm run prisma:migrate` | Cria nova migration |
| `npm run prisma:deploy` | Aplica migrations pendentes |
| `npm run prisma:seed` | Roda seed (roles, permissions, admin) |
| `npm run prisma:studio` | Abre Prisma Studio (GUI do banco) |
| `npm run prisma:generate` | Regenera o Prisma Client |

---

## Estrutura do Projeto

```
src/
├── common/
│   ├── constants/       # ErrorCode enum
│   ├── decorators/      # @CurrentUser, @Roles, @Permissions
│   ├── filters/         # GlobalExceptionFilter (Prisma, Zod, HTTP)
│   ├── guards/          # JwtAuth, UserStatus, Roles, Permissions, OwnerOrPermission
│   ├── pipes/           # ZodBodyPipe, ZodQueryPipe, ZodParamsPipe
│   └── utils/           # pagination (cursor + offset), crypto (AES-256-GCM)
├── config/              # Validação de env e config objects (app, db, jwt, cors, crypto)
├── modules/
│   ├── auth/            # Register, Login, Refresh, Logout
│   ├── health/          # GET /health, GET /health/db
│   └── user/            # CRUD de usuários com RBAC
├── prisma/              # PrismaModule, PrismaService (global)
├── app.module.ts
└── main.ts
prisma/
├── schema.prisma        # Modelos: User, Role, Permission, UserRole, RolePermission, RefreshToken
├── seed.ts              # Seed: permissions, roles, admin user
└── migrations/
test/
├── integration/         # Testes integrados com banco real (33 testes)
└── health.e2e-spec.ts   # Teste e2e do health check
```

---

## API — Endpoints

### Health Check

| Rota | Método | Auth | Descrição |
|------|--------|------|-----------|
| `/health` | GET | Nenhuma | Status da aplicação |
| `/health/db` | GET | Nenhuma | Status da conexão com o banco |

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"...","uptime":123.45}

curl http://localhost:3000/health/db
# {"status":"ok","database":"connected","timestamp":"..."}
```

---

### Autenticação

| Rota | Método | Auth | Descrição |
|------|--------|------|-----------|
| `/auth/register` | POST | Nenhuma | Registrar novo usuário |
| `/auth/login` | POST | Nenhuma | Login com email/senha |
| `/auth/refresh` | POST | Nenhuma | Renovar tokens (rotação) |
| `/auth/logout` | POST | Bearer Token | Revogar refresh token |

#### POST /auth/register

Cria um novo usuário com a role `user` e retorna os tokens JWT.

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "joao@example.com",
    "password": "MinhaSenh@123",
    "name": "João Silva"
  }'
```

**Resposta (201):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4e5f6...",
  "expiresIn": "15m"
}
```

**Erros:**
- `400` — Validação falhou (email inválido, senha < 8 caracteres)
- `409` — Email já registrado

#### POST /auth/login

Autentica com email e senha. Retorna par de tokens.

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@template.com",
    "password": "Admin@123"
  }'
```

**Resposta (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4e5f6...",
  "expiresIn": "15m"
}
```

**Erros:**
- `401` — Credenciais inválidas, conta inativa ou bloqueada

#### POST /auth/refresh

Renova o access token usando o refresh token. Implementa **rotação de tokens**: o refresh token antigo é revogado e um novo é gerado.

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{
    "refreshToken": "a1b2c3d4e5f6..."
  }'
```

**Resposta (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...(novo)",
  "refreshToken": "x9y8z7w6v5u4...(novo)",
  "expiresIn": "15m"
}
```

**Erros:**
- `401` — Refresh token inválido, expirado ou já revogado

#### POST /auth/logout

Revoga o refresh token. Requer autenticação.

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <accessToken>' \
  -d '{
    "refreshToken": "a1b2c3d4e5f6..."
  }'
```

**Resposta (200):** corpo vazio

**Erros:**
- `401` — Não autenticado

---

### Usuários

Todas as rotas de `/users` requerem autenticação (Bearer Token).

| Rota | Método | Auth | Permissão | Descrição |
|------|--------|------|-----------|-----------|
| `/users` | GET | Bearer | Role `admin` | Listar todos (cursor pagination) |
| `/users/me` | GET | Bearer | Qualquer user | Perfil do usuário logado |
| `/users/:id` | GET | Bearer | Owner ou `user:read` | Buscar por ID |
| `/users/:id` | PATCH | Bearer | Owner ou `user:write` | Atualizar usuário |
| `/users/:id` | DELETE | Bearer | Role `admin` | Soft delete (bloquear) |

#### GET /users (admin)

Lista todos os usuários com paginação por cursor. Apenas admins.

```bash
curl http://localhost:3000/users \
  -H 'Authorization: Bearer <adminAccessToken>'
```

**Resposta (200):**
```json
{
  "data": [
    {
      "id": "cuid...",
      "email": "admin@template.com",
      "name": "Admin",
      "isActive": true,
      "isVerified": true,
      "blockedAt": null,
      "lastLoginAt": "2026-02-14T03:00:00.000Z",
      "createdAt": "2026-02-14T02:00:00.000Z",
      "updatedAt": "2026-02-14T03:00:00.000Z",
      "roles": [
        {
          "userId": "cuid...",
          "roleId": "cuid...",
          "role": {
            "id": "cuid...",
            "name": "admin",
            "description": "Full access administrator",
            "permissions": [
              { "permission": { "name": "user:read" } },
              { "permission": { "name": "user:write" } },
              { "permission": { "name": "user:delete" } },
              { "permission": { "name": "role:read" } },
              { "permission": { "name": "role:write" } }
            ]
          }
        }
      ]
    }
  ],
  "meta": {
    "nextCursor": "cuid...",
    "hasNext": false
  }
}
```

**Paginação por cursor:**
```bash
# Primeira página (5 itens)
curl 'http://localhost:3000/users?take=5' \
  -H 'Authorization: Bearer <adminAccessToken>'

# Próxima página
curl 'http://localhost:3000/users?take=5&cursor=<nextCursor>' \
  -H 'Authorization: Bearer <adminAccessToken>'
```

**Erros:**
- `401` — Não autenticado
- `403` — Não é admin (`INSUFFICIENT_ROLES`)

#### GET /users/me

Retorna o perfil do usuário logado. Qualquer usuário autenticado.

```bash
curl http://localhost:3000/users/me \
  -H 'Authorization: Bearer <accessToken>'
```

**Resposta (200):** objeto do usuário com roles e permissions (mesmo formato do `/users`).

**Erros:**
- `401` — Não autenticado

#### GET /users/:id

Busca um usuário por ID. Permitido se:
- O usuário é o **dono** do recurso (mesmo ID), ou
- O usuário tem a permission `user:read`

```bash
curl http://localhost:3000/users/cuid123abc \
  -H 'Authorization: Bearer <accessToken>'
```

**Resposta (200):** objeto do usuário.

**Erros:**
- `401` — Não autenticado
- `403` — Sem permissão (`INSUFFICIENT_PERMISSIONS`)
- `404` — Usuário não encontrado

#### PATCH /users/:id

Atualiza dados do usuário. Permitido se:
- O usuário é o **dono** do recurso, ou
- O usuário tem a permission `user:write`

```bash
curl -X PATCH http://localhost:3000/users/cuid123abc \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <accessToken>' \
  -d '{
    "name": "Novo Nome",
    "email": "novo@email.com"
  }'
```

Todos os campos são opcionais. Envie apenas o que deseja alterar.

**Resposta (200):** objeto do usuário atualizado.

**Erros:**
- `400` — Validação falhou (email inválido)
- `401` — Não autenticado
- `403` — Sem permissão
- `404` — Usuário não encontrado

#### DELETE /users/:id

Soft delete: marca o usuário como `isActive: false` e `blockedAt: <agora>`. Apenas admins.

```bash
curl -X DELETE http://localhost:3000/users/cuid123abc \
  -H 'Authorization: Bearer <adminAccessToken>'
```

**Resposta (200):** objeto do usuário com `isActive: false` e `blockedAt` preenchido.

O usuário bloqueado **não consegue mais acessar** rotas protegidas (retorna `403 ACCOUNT_BLOCKED`).

**Erros:**
- `401` — Não autenticado
- `403` — Não é admin
- `404` — Usuário não encontrado

---

## Autenticação e Autorização

### Fluxo de tokens

```
Register/Login → { accessToken (15min), refreshToken (7d) }
                         │                      │
                    Usar no header          Usar para renovar
                  Authorization: Bearer     POST /auth/refresh
                         │                      │
                   Acessa rotas            Gera novo par de tokens
                   protegidas              (token antigo é revogado)
```

### Guards (camadas de proteção)

As rotas protegidas passam por até 4 guards em sequência:

1. **JwtAuthGuard** — Valida o access token JWT
2. **UserStatusGuard** — Verifica se o usuário está ativo e não bloqueado
3. **RolesGuard** — Verifica se o usuário tem a role necessária (ex: `admin`)
4. **OwnerOrPermissionGuard** — Verifica se o usuário é dono do recurso OU tem a permission necessária

### Roles e Permissions (seed padrão)

| Role | Permissions |
|------|------------|
| `admin` | `user:read`, `user:write`, `user:delete`, `role:read`, `role:write` |
| `user` | `user:read` |

Novos usuários registrados recebem automaticamente a role `user`.

---

## Formato de Erros

Todas as respostas de erro seguem o mesmo formato:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Body validation failed",
  "details": [
    { "field": "email", "message": "Invalid email" }
  ],
  "requestId": "uuid-da-request"
}
```

### Códigos de erro

| Código | HTTP | Descrição |
|--------|------|-----------|
| `VALIDATION_ERROR` | 400 | Validação Zod falhou |
| `BAD_REQUEST` | 400 | Request inválida |
| `INVALID_CREDENTIALS` | 401 | Email/senha incorretos |
| `TOKEN_INVALID` | 401 | JWT inválido ou expirado |
| `REFRESH_TOKEN_REVOKED` | 401 | Refresh token revogado |
| `FORBIDDEN` | 403 | Acesso negado |
| `ACCOUNT_INACTIVE` | 403 | Conta inativa |
| `ACCOUNT_BLOCKED` | 403 | Conta bloqueada |
| `INSUFFICIENT_ROLES` | 403 | Role insuficiente |
| `INSUFFICIENT_PERMISSIONS` | 403 | Permission insuficiente |
| `NOT_FOUND` | 404 | Recurso não encontrado |
| `CONFLICT` | 409 | Recurso já existe |
| `INTERNAL_ERROR` | 500 | Erro interno |

---

## Paginação

### Cursor (padrão)

Usado em `GET /users`. Ideal para feeds e listas infinitas.

```bash
# Primeira página
GET /users?take=20

# Próxima página
GET /users?take=20&cursor=<nextCursor>
```

**Resposta:**
```json
{
  "data": [...],
  "meta": {
    "nextCursor": "cuid...",
    "hasNext": true
  }
}
```

- `take` — Itens por página (1-100, padrão: 20)
- `cursor` — ID do último item da página anterior
- `hasNext` — Se há mais itens
- `nextCursor` — Cursor para a próxima página (`null` se não há mais)

---

## Deploy com Docker

### Subir tudo (recomendado)

```bash
docker compose up -d
```

O container da app executa automaticamente:
1. `prisma migrate deploy` — Aplica migrations pendentes
2. `prisma db seed` — Roda o seed (idempotente com upsert)
3. `node dist/src/main` — Inicia a aplicação

### Apenas o banco

```bash
docker compose up -d db
```

### Build manual da imagem

```bash
docker build -t template-nestjs .
```

### docker-compose.yml

O compose define dois serviços:
- **db** — PostgreSQL 16 Alpine (porta 5432)
- **app** — API NestJS (porta 3000, depende do db healthy)

---

## Testes

### Testes unitários

```bash
npm test
```

### Testes e2e (health check)

```bash
npm run test:e2e
```

### Testes integrados (banco real)

Os testes integrados conectam ao PostgreSQL real e testam todas as rotas com autenticação, autorização e banco de dados.

**Setup (uma vez):**

```bash
# Subir o banco
docker compose up -d db

# Criar banco de teste
docker compose exec db psql -U template -c "CREATE DATABASE template_test"

# Aplicar migrations e seed
DATABASE_URL="postgresql://template:template@localhost:5432/template_test" npx prisma migrate deploy
DATABASE_URL="postgresql://template:template@localhost:5432/template_test" npx prisma db seed
```

**Rodar:**

```bash
DATABASE_URL="postgresql://template:template@localhost:5432/template_test" \
  npx jest --config ./test/jest-e2e.config.js --testPathPatterns integration --verbose --forceExit
```

**Cobertura (33 testes):**

| Grupo | Testes | O que testa |
|-------|--------|-------------|
| POST /auth/register | 4 | Registro, email duplicado, validação |
| POST /auth/login | 4 | Login, credenciais inválidas |
| POST /auth/refresh | 2 | Rotação de tokens, token inválido |
| GET /users/me | 3 | Perfil, sem auth, token inválido |
| GET /users | 4 | Lista admin, paginação, non-admin rejeitado |
| GET /users/:id | 4 | Owner, admin, permission, 404 |
| PATCH /users/:id | 5 | Owner update, admin update, validação, 404 |
| DELETE /users/:id | 3 | Non-admin rejeitado, soft delete, 404 |
| POST /auth/logout | 3 | Logout, refresh rejeitado, sem auth |
| UserStatusGuard | 1 | Usuário bloqueado rejeitado |

---

## Banco de Dados

### Modelos (Prisma)

```
User ──< UserRole >── Role ──< RolePermission >── Permission
  │
  └──< RefreshToken
```

| Modelo | Descrição |
|--------|-----------|
| **User** | Usuário com email, senha (argon2), status, timestamps |
| **Role** | Papel (admin, user) |
| **Permission** | Permissão granular (user:read, user:write, etc.) |
| **UserRole** | Relação N:N entre User e Role |
| **RolePermission** | Relação N:N entre Role e Permission |
| **RefreshToken** | Tokens de refresh com expiração e revogação |

### Seed padrão

O seed cria:

- **5 permissions**: `user:read`, `user:write`, `user:delete`, `role:read`, `role:write`
- **2 roles**: `admin` (todas as permissions), `user` (apenas `user:read`)
- **1 admin**: `admin@template.com` / `Admin@123`

O seed usa `upsert`, então é seguro rodar múltiplas vezes.

---

## Segurança

- **Helmet** — Headers de segurança HTTP
- **Rate Limit** — 100 requests/minuto por IP
- **CORS** — Origens configuráveis via env
- **argon2** — Hash de senhas (resistente a GPU)
- **JWT com rotação** — Refresh tokens são revogados após uso
- **Soft delete** — Usuários bloqueados não são removidos do banco
- **Validação Zod** — Todas as entradas são validadas
- **Pino logger** — Logs estruturados com redação de dados sensíveis

---

## Swagger

Acesse http://localhost:3000/docs para a documentação interativa da API.

Para autenticar no Swagger:
1. Faça login via `POST /auth/login`
2. Copie o `accessToken` da resposta
3. Clique em **Authorize** no topo da página
4. Cole o token no campo `Bearer <token>`
5. Agora todas as rotas protegidas funcionam

## Creditos

> Sham Vinicius Fiorin

