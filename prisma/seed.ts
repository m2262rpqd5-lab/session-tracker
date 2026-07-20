import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.packageTemplate.createMany({
    data: [
      // 1:1 Personal Training (SAR)
      { name: "1:1 – 10 Sessions", sessionCount: 10, price: 7000, currency: "SAR" },
      { name: "1:1 – 20 Sessions", sessionCount: 20, price: 13300, currency: "SAR" },
      { name: "1:1 – 30 Sessions", sessionCount: 30, price: 18900, currency: "SAR" },
      { name: "1:1 – 50 Sessions", sessionCount: 50, price: 28000, currency: "SAR" },
      // 2:1 Personal Training (SAR)
      { name: "2:1 – 10 Sessions", sessionCount: 10, price: 9600, currency: "SAR" },
      { name: "2:1 – 20 Sessions", sessionCount: 20, price: 18240, currency: "SAR" },
      { name: "2:1 – 30 Sessions", sessionCount: 30, price: 25920, currency: "SAR" },
      { name: "2:1 – 50 Sessions", sessionCount: 50, price: 38400, currency: "SAR" },
    ],
  });
  console.log("Seeded package templates.");
}

main().finally(() => prisma.$disconnect());
