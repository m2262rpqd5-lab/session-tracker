import { PrismaClient } from "../app/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbUrl = `file:${path.join(process.cwd(), "prisma/dev.db")}`;
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.packageTemplate.createMany({
    data: [
      { name: "Intro Session", sessionCount: 1, price: 175, validityDays: 30 },
      { name: "5-Session Pack", sessionCount: 5, price: 750, validityDays: 90 },
      { name: "10-Session Pack", sessionCount: 10, price: 1500, validityDays: 180 },
      { name: "20-Session Pack", sessionCount: 20, price: 2800, validityDays: 365 },
    ],
  });
  console.log("Seeded package templates.");
}

main().finally(() => prisma.$disconnect());
