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
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
