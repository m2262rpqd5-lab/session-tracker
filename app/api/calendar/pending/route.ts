import { prisma } from "@/lib/db";

export async function GET() {
  const events = await prisma.pendingCalendarEvent.findMany({
    where: { status: "PENDING" },
    include: { suggestedClient: true },
    orderBy: { eventDate: "desc" },
  });
  return Response.json(events);
}
