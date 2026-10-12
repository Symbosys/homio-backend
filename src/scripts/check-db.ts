import { prisma } from "../lib/prisma.js";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      userType: true,
      firstName: true,
      status: true,
    },
    take: 10,
  });
  console.log("USERS:", JSON.stringify(users, null, 2));

  const labours = await prisma.labour.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      trade: true,
      status: true,
      userId: true,
      isAvailable: true,
    },
    take: 5,
  });
  console.log("LABOURS:", JSON.stringify(labours, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
