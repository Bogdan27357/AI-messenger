import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@messenger.local' },
    update: {},
    create: {
      email: 'admin@messenger.local',
      name: 'Администратор',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });

  console.log('Admin user created:', admin.email);

  // Create demo users
  const demoPassword = await bcrypt.hash('password', 12);
  const demoUsers = [
    { email: 'ivan@messenger.local', name: 'Иван Петров' },
    { email: 'maria@messenger.local', name: 'Мария Сидорова' },
    { email: 'alex@messenger.local', name: 'Алексей Козлов' },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        passwordHash: demoPassword,
        role: 'USER',
      },
    });
    console.log('Demo user created:', u.email);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
