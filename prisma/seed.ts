import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Permissions ──
  const permissions = [
    { name: 'user:read', description: 'Read user data' },
    { name: 'user:write', description: 'Create and update users' },
    { name: 'user:delete', description: 'Delete users' },
    { name: 'role:read', description: 'Read roles' },
    { name: 'role:write', description: 'Create and update roles' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  console.log(`✅ ${permissions.length} permissions created`);

  // ── Roles ──
  const allPermissions = await prisma.permission.findMany();

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Full access administrator',
      permissions: {
        create: allPermissions.map((p) => ({
          permission: { connect: { id: p.id } },
        })),
      },
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Regular user',
      permissions: {
        create: [
          {
            permission: {
              connect: { name: 'user:read' },
            },
          },
        ],
      },
    },
  });

  console.log(`✅ Roles created: admin, user`);

  // ── Admin User ──
  const adminPassword = await argon2.hash('Admin@123');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@template.com' },
    update: {},
    create: {
      email: 'admin@template.com',
      password: adminPassword,
      name: 'Admin',
      isActive: true,
      isVerified: true,
      roles: {
        create: {
          role: { connect: { id: adminRole.id } },
        },
      },
    },
  });

  console.log(`✅ Admin user created: ${adminUser.email}`);
  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
