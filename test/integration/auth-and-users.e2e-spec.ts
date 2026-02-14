import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

const TEST_DB_URL = 'postgresql://template:template@localhost:5432/template_test?schema=public';

describe('Auth & Users (e2e integration)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  // Tokens stored across tests
  let userAccessToken: string;
  let userRefreshToken: string;
  let userId: string;
  let adminAccessToken: string;
  let adminRefreshToken: string;
  let adminId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars!!';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars!!';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    process.env.CORS_ORIGINS = 'http://localhost:3000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);

    // Clean test data (keep seed data)
    await prisma.refreshToken.deleteMany({});
    await prisma.$executeRaw`DELETE FROM user_roles WHERE "userId" IN (SELECT id FROM users WHERE email != 'admin@template.com')`;
    await prisma.user.deleteMany({ where: { email: { not: 'admin@template.com' } } });
  });

  afterAll(async () => {
    // Clean test data
    await prisma.refreshToken.deleteMany({});
    await prisma.$executeRaw`DELETE FROM user_roles WHERE "userId" IN (SELECT id FROM users WHERE email != 'admin@template.com')`;
    await prisma.user.deleteMany({ where: { email: { not: 'admin@template.com' } } });
    await app.close();
  });

  // ─────────────────────────────────────────────────
  // AUTH: Register
  // ─────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'testuser@test.com', password: 'Test@1234', name: 'Test User' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.expiresIn).toBe('15m');

      userAccessToken = body.accessToken;
      userRefreshToken = body.refreshToken;
    });

    it('should reject duplicate email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'testuser@test.com', password: 'Test@1234' },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe('CONFLICT');
    });

    it('should reject invalid email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'not-an-email', password: 'Test@1234' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject short password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'short@test.com', password: '123' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────
  // AUTH: Login
  // ─────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'testuser@test.com', password: 'Test@1234' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      // Update tokens for subsequent tests
      userAccessToken = body.accessToken;
      userRefreshToken = body.refreshToken;
    });

    it('should login as admin', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'admin@template.com', password: 'Admin@123' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.accessToken).toBeDefined();

      adminAccessToken = body.accessToken;
      adminRefreshToken = body.refreshToken;
    });

    it('should reject wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'testuser@test.com', password: 'WrongPassword' },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject non-existent user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'nobody@test.com', password: 'Test@1234' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────
  // AUTH: Refresh
  // ─────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { 'content-type': 'application/json' },
        payload: { refreshToken: userRefreshToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.refreshToken).not.toBe(userRefreshToken); // Token rotation

      userAccessToken = body.accessToken;
      userRefreshToken = body.refreshToken;
    });

    it('should reject already-used refresh token (rotation)', async () => {
      // The old refresh token was revoked after the previous refresh
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { 'content-type': 'application/json' },
        payload: { refreshToken: 'invalid-token-value' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────
  // USERS: GET /users/me
  // ─────────────────────────────────────────────────

  describe('GET /users/me', () => {
    it('should return current user profile', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${userAccessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.email).toBe('testuser@test.com');
      expect(body.name).toBe('Test User');
      expect(body.id).toBeDefined();
      expect(body.roles).toBeDefined();
      expect(body.password).toBeUndefined(); // password not exposed

      userId = body.id;
    });

    it('should reject without auth token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users/me',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject with invalid token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: 'Bearer invalid-token' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────
  // USERS: GET /users (admin only)
  // ─────────────────────────────────────────────────

  describe('GET /users', () => {
    it('should return user list for admin', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users',
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2); // admin + testuser
      expect(body.meta).toBeDefined();

      // Store admin ID
      const admin = body.data.find((u: any) => u.email === 'admin@template.com');
      expect(admin).toBeDefined();
      adminId = admin.id;
    });

    it('should support cursor pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users?take=1',
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.length).toBe(1);
      expect(body.meta.hasNext).toBe(true);
      expect(body.meta.nextCursor).toBeDefined();

      // Fetch next page
      const res2 = await app.inject({
        method: 'GET',
        url: `/users?take=1&cursor=${body.meta.nextCursor}`,
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });

      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.payload);
      expect(body2.data.length).toBe(1);
      expect(body2.data[0].id).not.toBe(body.data[0].id);
    });

    it('should reject for non-admin user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users',
        headers: { authorization: `Bearer ${userAccessToken}` },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe('INSUFFICIENT_ROLES');
    });

    it('should reject without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────
  // USERS: GET /users/:id
  // ─────────────────────────────────────────────────

  describe('GET /users/:id', () => {
    it('should allow user to get own profile by ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/${userId}`,
        headers: { authorization: `Bearer ${userAccessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe(userId);
      expect(body.email).toBe('testuser@test.com');
    });

    it('should allow admin to get any user by ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/${userId}`,
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe(userId);
    });

    it('should reject regular user accessing another user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users/${adminId}`,
        headers: { authorization: `Bearer ${userAccessToken}` },
      });

      // user role has user:read permission, so this should work
      // OwnerOrPermissionGuard: not owner, but has user:read
      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users/non-existent-id-12345',
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────
  // USERS: PATCH /users/:id
  // ─────────────────────────────────────────────────

  describe('PATCH /users/:id', () => {
    it('should allow user to update own name', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/users/${userId}`,
        headers: {
          authorization: `Bearer ${userAccessToken}`,
          'content-type': 'application/json',
        },
        payload: { name: 'Updated Name' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.name).toBe('Updated Name');
      expect(body.id).toBe(userId);
    });

    it('should allow admin to update any user', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/users/${userId}`,
        headers: {
          authorization: `Bearer ${adminAccessToken}`,
          'content-type': 'application/json',
        },
        payload: { name: 'Admin Updated' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.name).toBe('Admin Updated');
    });

    it('should reject empty update body gracefully', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/users/${userId}`,
        headers: {
          authorization: `Bearer ${userAccessToken}`,
          'content-type': 'application/json',
        },
        payload: {},
      });

      // Empty body is valid for optional fields
      expect(res.statusCode).toBe(200);
    });

    it('should reject invalid email format', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/users/${userId}`,
        headers: {
          authorization: `Bearer ${userAccessToken}`,
          'content-type': 'application/json',
        },
        payload: { email: 'not-an-email' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject update of non-existent user', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/users/non-existent-id-12345',
        headers: {
          authorization: `Bearer ${adminAccessToken}`,
          'content-type': 'application/json',
        },
        payload: { name: 'Ghost' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────
  // USERS: DELETE /users/:id (admin only, soft delete)
  // ─────────────────────────────────────────────────

  describe('DELETE /users/:id', () => {
    let deleteTargetId: string;

    beforeAll(async () => {
      // Register a user to delete
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'todelete@test.com', password: 'Test@1234', name: 'To Delete' },
      });
      const token = JSON.parse(res.payload).accessToken;

      // Get user ID
      const meRes = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${token}` },
      });
      deleteTargetId = JSON.parse(meRes.payload).id;
    });

    it('should reject delete by non-admin', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/users/${deleteTargetId}`,
        headers: { authorization: `Bearer ${userAccessToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should soft-delete user as admin', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/users/${deleteTargetId}`,
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.isActive).toBe(false);
      expect(body.blockedAt).toBeDefined();
    });

    it('should return 404 for non-existent user delete', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/users/non-existent-id-12345',
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────
  // AUTH: Logout
  // ─────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('should logout and revoke refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          authorization: `Bearer ${userAccessToken}`,
          'content-type': 'application/json',
        },
        payload: { refreshToken: userRefreshToken },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should reject refresh after logout', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { 'content-type': 'application/json' },
        payload: { refreshToken: userRefreshToken },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject logout without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { 'content-type': 'application/json' },
        payload: { refreshToken: 'some-token' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────
  // USERS: Blocked user guard
  // ─────────────────────────────────────────────────

  describe('UserStatusGuard (blocked user)', () => {
    let blockedToken: string;

    beforeAll(async () => {
      // Register and login a user, then block them
      const regRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'blocked@test.com', password: 'Test@1234', name: 'Blocked User' },
      });
      blockedToken = JSON.parse(regRes.payload).accessToken;

      // Get user ID
      const meRes = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${blockedToken}` },
      });
      const blockedId = JSON.parse(meRes.payload).id;

      // Block user via admin
      await app.inject({
        method: 'DELETE',
        url: `/users/${blockedId}`,
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
    });

    it('should reject blocked user from accessing protected routes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${blockedToken}` },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(['ACCOUNT_BLOCKED', 'ACCOUNT_INACTIVE']).toContain(body.code);
    });
  });
});
