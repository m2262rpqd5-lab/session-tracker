import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { matchEventToClient } from "@/lib/calendar-matcher";

const SYNC_SECRET = process.env.SYNC_SECRET || "dev-secret";

type IncomingEvent = {
  id: string;
  title: string;
  date: number; // unix timestamp
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-sync-secret");
  if (secret !== SYNC_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const events: IncomingEvent[] = body.events ?? [];

  const clients = await prisma.client.findMany({ select: { id: true, name: true } });

  let scanned = 0, matched = 0, pending = 0, skipped = 0;

  for (const event of events) {
    scanned++;
    const eventDate = new Date(event.date * 1000);

    // Skip future events
    if (eventDate > new Date()) { skipped++; continue; }

    // Already processed as a session
    const existingSession = await prisma.session.findUnique({
      where: { calendarEventId: event.id },
    });
    if (existingSession) { skipped++; continue; }

    // Already in pending queue
    const existingPending = await prisma.pendingCalendarEvent.findUnique({
      where: { calendarEventId: event.id },
    });
    if (existingPending) {
      // Update date if rescheduled
      if (existingPending.status === "PENDING") {
        await prisma.pendingCalendarEvent.update({
          where: { id: existingPending.id },
          data: { eventDate, eventTitle: event.title },
        });
      }
      skipped++;
      continue;
    }

    const match = matchEventToClient(event.title, clients);

    await prisma.pendingCalendarEvent.create({
      data: {
        calendarEventId: event.id,
        eventTitle: event.title,
        eventDate,
        suggestedClientId: match?.client.id ?? null,
        matchConfidence: match?.confidence ?? null,
        status: match && match.confidence >= 0.85 ? "PENDING" : "PENDING",
      },
    });

    if (match) matched++;
    else pending++;
  }

  await prisma.calendarSyncLog.create({
    data: { eventsScanned: scanned, eventsMatched: matched, eventsPending: pending, eventsSkipped: skipped },
  });

  return Response.json({ scanned, matched, pending, skipped });
}
