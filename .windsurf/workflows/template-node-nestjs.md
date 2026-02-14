---
description: Como construir o template-node-nestjs passo a passo — NestJS + Fastify + Prisma + JWT + RBAC
---

# 🏗️ template-node-nestjs — Workflow de Construção

> Siga cada fase na ordem. Marque `[x]` conforme completar cada item.
> Ao pedir para o Windsurf implementar, referencie a fase e o item.

---

## Fase 0 — Scaffold do Projeto

- [ ] Criar projeto NestJS via CLI: `nest new template-node-nestjs --package-manager npm`
- [ ] Remover Express e instalar **Fastify adapter**: `@nestjs/platform-fastify`
- [ ] Configurar `tsconfig.json` com `strict: true`, `esModuleInterop: true`
- [ ] Criar estrutura de pastas:
  ```
  src/
  ├── common/          # pipes, filters, guards, decorators, interceptors, utils
  ├── config/          # validação env, objetos de config
  ├── modules/
  │   ├── auth/
  │   ├── user/
  │   └── health/
  ├── prisma/          # PrismaModule e PrismaService
  ├── app.module.ts
  └── main.ts
  prisma/
  ├── schema.prisma
  ├── seed.ts
  └── migrations/
  test/
  ├── jest-e2e.config.js
  └── app.e2e-spec.ts
  ```
- [ ] Criar `.env.example`, `.env`, `.gitignore` (incluir `.env`, `dist/`, `node_modules/`)
- [ ] Criar `.prettierrc` e `.eslintrc.js`

---

## Fase 1 — Runtime / HTTP (Fastify Hardening)

### Dependências
```bash
npm i @nestjs/platform-fastify @fastify/helmet @fastify/cors @fastify/compress @fastify/rate-limit pino pino-pretty
```

### Implementação

- [ ] **`main.ts`** — Criar app com `FastifyAdapter`
  - `trustProxy: true`
  - Gerar `requestId` por requisição (usar `crypto.randomUUID()`)
  - Registrar plugins: `helmet`, `cors`, `compress`, `rate-limit`
  - Rate-limit global: `max: 100, timeWindow: '1 minute'`
  - Logger: pino com `redact` para campos sensíveis (`password`, `token`, `authorization`)
  - Swagger bootstrap (fase posterior)
  - `app.listen(port, '0.0.0.0')`

### Regras
- **Nunca** usar Express — apenas Fastify
- `requestId` deve estar disponível em todo request lifecycle (decorar no request)
- Logger deve logar: `method`, `url`, `statusCode`, `responseTime`, `requestId`

---

## Fase 2 — Config / ENV

### Dependências
```bash
npm i @nestjs/config zod
```

### Implementação

- [ ] **`src/config/env.validation.ts`** — Schema Zod para todas as variáveis de ambiente
  ```
  NODE_ENV, PORT, DATABASE_URL,
  JWT_ACCESS_SECRET, JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN,
  CORS_ORIGINS,
  CRYPTO_KEY (opcional), CRYPTO_IV_LENGTH (opcional)
  ```
  - Falhar no boot se inválido (throw antes do app iniciar)

- [ ] **`src/config/app.config.ts`** — `registerAs('app', () => ({...}))`
- [ ] **`src/config/db.config.ts`** — `registerAs('db', () => ({...}))`
- [ ] **`src/config/jwt.config.ts`** — `registerAs('jwt', () => ({...}))`
- [ ] **`src/config/cors.config.ts`** — `registerAs('cors', () => ({...}))`
- [ ] **`src/config/crypto.config.ts`** — `registerAs('crypto', () => ({...}))`
- [ ] **`src/config/index.ts`** — re-export de todos os configs

- [ ] **`.env.example`** completo com todos os campos documentados
- [ ] **`AppModule`** — `ConfigModule.forRoot({ isGlobal: true, validate, load: [...configs] })`

### Regras
- **Zod** é o único validador de env (não usar Joi, class-validator para env)
- Cada domínio tem seu próprio arquivo de config
- Secrets nunca com valor default

---

## Fase 3 — Validação / Contratos (Zod Pipes)

### Implementação

- [ ] **`src/common/pipes/zod-body.pipe.ts`** — `ZodBodyPipe`
  - Recebe um `ZodSchema`, valida `body`
  - Retorna dados parseados (com coerção)
  - Lança `BadRequestException` com detalhes do Zod

- [ ] **`src/common/pipes/zod-query.pipe.ts`** — `ZodQueryPipe`
  - Mesmo padrão, para `query` params
  - Suporta `z.coerce.number()`, `z.coerce.boolean()`

- [ ] **`src/common/pipes/zod-params.pipe.ts`** — `ZodParamsPipe`
  - Mesmo padrão, para route `params`

- [ ] **`src/common/pipes/index.ts`** — re-export

### Uso esperado
```typescript
@Post()
create(@Body(new ZodBodyPipe(CreateUserSchema)) data: CreateUserDto) {}

@Get()
list(@Query(new ZodQueryPipe(ListQuerySchema)) query: ListQueryDto) {}
```

### Regras
- Schemas Zod ficam junto ao módulo que os usa (ex: `modules/user/schemas/`)
- Pipes são genéricos e reutilizáveis
- Erros de validação devem seguir o shape do exception filter global

---

## Fase 4 — Banco / ORM (Prisma)

### Dependências
```bash
npm i @prisma/client
npm i -D prisma
npx prisma init
```

### Implementação

- [ ] **`prisma/schema.prisma`** — Schema completo:
  ```prisma
  model User {
    id          String    @id @default(cuid())
    email       String    @unique
    password    String
    name        String?
    isActive    Boolean   @default(true)
    isVerified  Boolean   @default(false)
    blockedAt   DateTime?
    lastLoginAt DateTime?
    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt
    roles       UserRole[]
    refreshTokens RefreshToken[]
  }

  model Role {
    id          String   @id @default(cuid())
    name        String   @unique
    description String?
    permissions RolePermission[]
    users       UserRole[]
    createdAt   DateTime @default(now())
  }

  model Permission {
    id          String   @id @default(cuid())
    name        String   @unique  // ex: "user:read", "user:write"
    description String?
    roles       RolePermission[]
    createdAt   DateTime @default(now())
  }

  model UserRole {
    userId String
    roleId String
    user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
    role   Role @relation(fields: [roleId], references: [id], onDelete: Cascade)
    @@id([userId, roleId])
  }

  model RolePermission {
    roleId       String
    permissionId String
    role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
    permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
    @@id([roleId, permissionId])
  }

  model RefreshToken {
    id        String   @id @default(cuid())
    token     String   @unique
    userId    String
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    expiresAt DateTime
    revokedAt DateTime?
    createdAt DateTime @default(now())
  }
  ```

- [ ] **`src/prisma/prisma.service.ts`** — Extends `PrismaClient`, implements `OnModuleInit`
- [ ] **`src/prisma/prisma.module.ts`** — Global module
- [ ] **`prisma/seed.ts`** — Seed inicial:
  - Permissions: `user:read`, `user:write`, `user:delete`, `role:read`, `role:write`
  - Roles: `admin` (todas), `user` (user:read)
  - Admin user: `admin@template.com` / senha hasheada com argon2
- [ ] Rodar: `npx prisma migrate dev --name init`

### Regras
- PrismaService é **global** (importado uma vez)
- Sempre usar `cuid()` para IDs
- Soft delete via `blockedAt` (não deletar registros)

---

## Fase 5 — Auth / Segurança

### Dependências
```bash
npm i @nestjs/jwt @nestjs/passport passport passport-jwt argon2
npm i -D @types/passport-jwt
```

### Implementação

- [ ] **`src/modules/auth/auth.module.ts`**
- [ ] **`src/modules/auth/auth.service.ts`**
  - `register(data)` — hash com argon2, criar user, retornar tokens
  - `login(email, password)` — validar, verificar `isActive`/`blockedAt`, atualizar `lastLoginAt`, retornar tokens
  - `refresh(refreshToken)` — validar token, rotação (revogar antigo, criar novo)
  - `logout(refreshToken)` — revogar token
  - `generateTokenPair(userId)` — access + refresh
  - Mensagens anti-enumeração: "Invalid credentials" (nunca "user not found" ou "wrong password")

- [ ] **`src/modules/auth/auth.controller.ts`**
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/logout` (autenticado)

- [ ] **`src/modules/auth/strategies/jwt.strategy.ts`** — Passport JWT strategy
- [ ] **`src/modules/auth/schemas/`** — Zod schemas para login, register, refresh

- [ ] **`src/common/guards/jwt-auth.guard.ts`** — Guard padrão JWT
- [ ] **`src/common/guards/user-status.guard.ts`** — Verifica `isActive`, `blockedAt`, `isVerified`

- [ ] **Rate-limit reforçado** em rotas `/auth/*`: `max: 5, timeWindow: '1 minute'`

### Criptografia opcional (AES-256-GCM)

- [ ] **`src/common/utils/crypto.util.ts`**
  - `encrypt(plaintext)` → `iv:authTag:ciphertext` (base64)
  - `decrypt(encrypted)` → plaintext
  - Key via `CRYPTO_KEY` env
  - Usar apenas quando explicitamente necessário (campos sensíveis)

### Regras
- **Nunca** armazenar senha em plaintext
- Refresh token com **rotação**: ao usar, revogar o antigo e emitir novo
- Access token: curta duração (15min). Refresh token: longa duração (7d)
- `UserStatusGuard` roda **depois** do `JwtAuthGuard`

---

## Fase 6 — Usuário / Permissões (RBAC)

### Implementação

- [ ] **`src/modules/user/user.module.ts`**
- [ ] **`src/modules/user/user.service.ts`**
  - CRUD de usuários
  - Atribuir/remover roles
  - Listar com paginação

- [ ] **`src/modules/user/user.controller.ts`**
  - `GET /users` (paginado, admin)
  - `GET /users/me` (próprio perfil)
  - `GET /users/:id` (admin ou owner)
  - `PATCH /users/:id` (admin ou owner)
  - `DELETE /users/:id` (admin — soft delete via `blockedAt`)

- [ ] **`src/common/decorators/current-user.decorator.ts`** — `@CurrentUser()`
  - Extrai user do request (populado pelo JWT strategy)

- [ ] **`src/common/decorators/roles.decorator.ts`** — `@Roles('admin', 'user')`
- [ ] **`src/common/decorators/permissions.decorator.ts`** — `@Permissions('user:read')`

- [ ] **`src/common/guards/roles.guard.ts`** — Verifica roles do user
- [ ] **`src/common/guards/permissions.guard.ts`** — Verifica permissions do user

- [ ] **`src/common/guards/owner-or-permission.guard.ts`** — ABAC leve
  - Se o user é dono do recurso → permite
  - Se o user tem a permission necessária → permite
  - Caso contrário → 403

### Regras
- Guards empilham: `JwtAuthGuard` → `UserStatusGuard` → `RolesGuard`/`PermissionsGuard`
- `@CurrentUser()` retorna o user completo com roles e permissions
- Owner check usa `params.id === currentUser.id`

---

## Fase 7 — Paginação / Query

### Implementação

- [ ] **`src/common/utils/pagination.util.ts`**
  - **Cursor pagination** (padrão):
    ```typescript
    interface CursorPaginationParams { cursor?: string; take?: number; }
    interface CursorPaginationMeta { nextCursor: string | null; hasNext: boolean; }
    ```
  - **Offset pagination** (admin/backoffice):
    ```typescript
    interface OffsetPaginationParams { page?: number; limit?: number; }
    interface OffsetPaginationMeta { page: number; limit: number; total: number; totalPages: number; }
    ```

- [ ] **`src/common/schemas/pagination.schema.ts`** — Zod schemas para query params de paginação

- [ ] Helpers para construir queries Prisma:
  - `buildCursorQuery(params)` → `{ take, skip, cursor }`
  - `buildOffsetQuery(params)` → `{ take, skip }`

### Regras
- **Cursor pagination** é o padrão para APIs públicas
- **Offset pagination** apenas para admin/backoffice (com `count`)
- `count` é **opcional** em cursor pagination (custo alto em tabelas grandes)
- `take` default: 20, max: 100

---

## Fase 8 — Erros / Respostas

### Implementação

- [ ] **`src/common/filters/global-exception.filter.ts`**
  - Shape único de erro:
    ```json
    {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed",
      "details": [...],
      "requestId": "abc-123"
    }
    ```
  - Tratamento específico para erros Prisma:
    - `P2002` (unique constraint) → 409 Conflict
    - `P2025` (not found) → 404 Not Found
    - `P2003` (foreign key) → 400 Bad Request
  - Tratamento para `ZodError` → 400 com detalhes
  - Tratamento para `UnauthorizedException` → 401
  - Tratamento para `ForbiddenException` → 403
  - Fallback: 500 Internal Server Error (sem expor detalhes internos)

- [ ] **`src/common/interceptors/response.interceptor.ts`** (opcional)
  - Envelope padrão: `{ data, meta }`
  - Apenas se quiser padronizar todas as respostas

- [ ] **`src/common/constants/error-codes.ts`** — Enum de códigos de erro

### Regras
- **Sempre** incluir `requestId` no erro
- **Nunca** expor stack trace em produção
- Erros Prisma devem ser traduzidos para HTTP status codes adequados

---

## Fase 9 — Docs (Swagger)

### Implementação

- [ ] **`main.ts`** — Configurar Swagger:
  ```typescript
  const config = new DocumentBuilder()
    .setTitle('Template NestJS API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, document);
  ```

- [ ] Adicionar `@ApiTags()` em cada controller
- [ ] Adicionar `@ApiBearerAuth()` em rotas autenticadas
- [ ] Adicionar `@ApiOperation()`, `@ApiResponse()` nas rotas principais

### Regras
- Swagger disponível em `/docs`
- BearerAuth configurado globalmente
- Tags por feature: `Auth`, `Users`, `Health`

---

## Fase 10 — Observabilidade

### Implementação

- [ ] **Logger estruturado** (pino) já configurado na Fase 1
  - Redaction: `password`, `token`, `authorization`, `cookie`

- [ ] **Request logging** via Fastify hooks ou interceptor:
  - `method`, `url`, `statusCode`, `responseTime`, `requestId`

- [ ] **`src/modules/health/health.controller.ts`**
  - `GET /health` → `{ status: 'ok', timestamp, uptime }`
  - `GET /health/db` → testa conexão Prisma (`$queryRaw`)

- [ ] **`src/modules/health/health.module.ts`**

### Regras
- Healthcheck **não** requer autenticação
- Logger **nunca** loga dados sensíveis
- Em produção, usar `pino` (JSON). Em dev, usar `pino-pretty`

---

## Fase 11 — Qualidade / DX

### Implementação

- [ ] **`.eslintrc.js`** — ESLint com TypeScript + Prettier
- [ ] **`.prettierrc`** — `{ "singleQuote": true, "trailingComma": "all" }`
- [ ] **Testes unitários** (mínimo):
  - `auth.service.spec.ts`
  - `user.service.spec.ts`
  - `zod-body.pipe.spec.ts`
  - `global-exception.filter.spec.ts`
- [ ] **Teste e2e** (mínimo):
  - `auth.e2e-spec.ts` (register, login, refresh, logout)
- [ ] **`test/jest-e2e.config.js`**

### Regras
- Todo service deve ter pelo menos 1 teste unitário
- Auth flow deve ter teste e2e completo

---

## Fase 12 — Deploy (Docker)

### Implementação

- [ ] **`Dockerfile`** — Multi-stage:
  ```dockerfile
  # Stage 1: build
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npx prisma generate
  RUN npm run build

  # Stage 2: production
  FROM node:20-alpine
  WORKDIR /app
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/package*.json ./
  COPY --from=builder /app/prisma ./prisma
  CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
  ```

- [ ] **`docker-compose.yml`**:
  ```yaml
  services:
    db:
      image: postgres:16-alpine
      environment:
        POSTGRES_USER: template
        POSTGRES_PASSWORD: template
        POSTGRES_DB: template
      ports: ["5432:5432"]
      volumes: [pgdata:/var/lib/postgresql/data]

    app:
      build: .
      ports: ["3000:3000"]
      depends_on: [db]
      env_file: .env

  volumes:
    pgdata:
  ```

- [ ] **`.dockerignore`** — `node_modules`, `dist`, `.env`, `.git`

### Regras
- `prisma migrate deploy` roda **antes** do `node dist/main`
- Imagem final não contém devDependencies
- Usar `node:20-alpine` para imagem menor

---

## Fase 13 — CI (GitHub Actions)

- [ ] **`.github/workflows/ci.yml`**:
  - `lint` → `npm run lint`
  - `test` → `npm test`
  - `build` → `npm run build`
  - `prisma` → `npx prisma migrate diff` (check)
  - Rodar em: `push` (main) e `pull_request`

---

## ✅ Checklist Final

| Categoria | Item | Status |
|-----------|------|--------|
| **Runtime** | Fastify adapter | ✅ |
| **Runtime** | helmet, cors, compress, rate-limit | ✅ |
| **Runtime** | trustProxy + requestId | ✅ |
| **Config** | @nestjs/config global | ✅ |
| **Config** | Validação env com Zod | ✅ |
| **Config** | Objetos de config por domínio | ✅ |
| **Validação** | ZodBodyPipe, ZodQueryPipe, ZodParamsPipe | ✅ |
| **Banco** | Prisma schema + migrations | ✅ |
| **Banco** | Seed (admin/roles/perms) | ✅ |
| **Auth** | argon2 hash | ✅ |
| **Auth** | JWT access + refresh (rotação) | ✅ |
| **Auth** | JwtAuthGuard + UserStatusGuard | ✅ |
| **Auth** | Rate-limit reforçado em /auth | ✅ |
| **Auth** | Mensagens anti-enumeração | ✅ |
| **Auth** | AES-256-GCM (opcional) | ✅ |
| **RBAC** | Roles + Permissions | ✅ |
| **RBAC** | @CurrentUser, @Roles, @Permissions | ✅ |
| **RBAC** | Owner-or-permission guard | ✅ |
| **Paginação** | Cursor pagination (padrão) | ✅ |
| **Paginação** | Offset pagination (admin) | ✅ |
| **Erros** | Exception filter global | ✅ |
| **Erros** | Tratamento Prisma errors | ✅ |
| **Docs** | Swagger + BearerAuth | ✅ |
| **Observ.** | Logger pino + redaction | ✅ |
| **Observ.** | Request logging | ✅ |
| **Observ.** | Healthcheck /health | ✅ |
| **DX** | ESLint + Prettier | ✅ |
| **DX** | Testes unit + e2e (config) | ✅ |
| **Deploy** | Dockerfile multi-stage | ✅ |
| **Deploy** | docker-compose | ✅ |
| **CI** | GitHub Actions | ✅ |
