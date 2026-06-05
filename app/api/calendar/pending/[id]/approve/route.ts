import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { computeRemaining } from "@/lib/package-utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const overrideClientId: string | undefined = body.clientId;

  const pending = await prisma.pendingCalendarEvent.findUnique({ where: { id } });
  if (!pending) return Response.json({ error: "Not found" }, { status: 404 });
  if (pending.status !== "PENDING") {
    return Response.json({ error: "Already processed" }, { status: 400 });
  }

  const clientId = overrideClientId ?? pending.suggestedClientId;
  if (!clientId) {
    return Response.json({ error: "No client assigned. Provide clientId in body." }, { status: 400 });
  }

  // Find the oldest active package for this client
  const pkg = await prisma.clientPackage.findFirst({
    where: { clientId, status: "ACTIVE" },
    orderBy: { startDate: "asc" },
    include: { payments: true, adjustments: true },
  });
  if (!pkg) {
    return Response.json({ error: "No active package for this client" }, { status: 400 });
  }
  if (computeRemaining(pkg) <= 0) {
    return Response.json({ error: "No sessions remaining in package" }, { status: 400 });
  }

  // Check for duplicate
  const duplicate = await prisma.session.findUnique({
    where: { calendarEventId: pending.calendarEventId },
  });
  if (duplicate) {
    return Response.json({ error: "Session already recorded for this event" }, { status: 409 });
  }

  const [session] = await prisma.$transaction([
    prisma.session.create({
      data: {
        clientPackageId: pkg.id,
        sessionDate: pending.eventDate,
        source: "CALENDAR_SYNC",
        calendarEventId: pending.calendarEventId,
        notes: pending.eventTitle,
      },
    }),
    prisma.clientPackage.update({
      where: { id: pkg.id },
      data: { usedSessions: { increment: 1 } },
    }),
    prisma.pendingCalendarEvent.update({
      where: { id },
      data: { status: "APPROVED", suggestedClientId: clientId },
    }),
  ]);

  return Response.json(session, { status: 201 });
}
