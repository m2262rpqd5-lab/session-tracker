import { prisma } from "@/lib/db";

export async function GET() {
  const logs = await prisma.calendarSyncLog.findMany({
    orderBy: { syncedAt: "desc" },
    take: 8,
  });
  return Response.json(logs);
}
