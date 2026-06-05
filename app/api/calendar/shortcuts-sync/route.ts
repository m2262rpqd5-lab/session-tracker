/**
 * Shortcuts-friendly sync endpoint.
 * Accepts ISO date strings instead of unix timestamps and auto-generates
 * deterministic event IDs from title + date so Shortcuts doesn't need to
 * supply a persistent ID.
 *
 * Expected body (single event from a Shortcut loop):
 *   { "title": "Session - Jane Smith", "startDate": "2026-06-05T10:00:00" }
 *
 * Or a batch (for the Python script):
 *   { "events": [{ "title": "...", "startDate": "..." }, ...] }
 */
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { matchEventToClient } from "@/lib/calendar-matcher";
import crypto from "crypto";

const SYNC_SECRET = process.env.SYNC_SECRET || "dev-secret";

type ShortcutEvent = {
  title: string;
  startDate: string; // ISO 8601
};

function deterministicId(title: string, startDate: string) {
  return "sc-" + crypto.createHash("sha1").update(`${title}|${startDate}`).digest("hex").slice(0, 16);
}

async function processEvent(event: ShortcutEvent, clients: { id: string; name: string }[]) {
  const eventDate = new Date(event.title ? event.startDate : "");
  const calendarEventId = deterministicId(event.title, event.startDate);
  const parsedDate = new Date(event.startDate);

  if (isNaN(parsedDate.getTime())) return "invalid";
  if (parsedDate > new Date()) return "future";

  const existingSession = await prisma.session.findUnique({ where: { calendarEventId } });
  if (existingSession) return "duplicate";

  const existingPending = await prisma.pendingCalendarEvent.findUnique({ where: { calendarEventId } });
  if (existingPending) {
    if (existingPending.status === "PENDING") {
      await prisma.pendingCalendarEvent.update({
        where: { id: existingPending.id },
        data: { eventDate: parsedDate, eventTitle: event.title },
      });
    }
    return "duplicate";
  }

  const match = matchEventToClient(event.title, clients);

  await prisma.pendingCalendarEvent.create({
    data: {
      calendarEventId,
      eventTitle: event.title,
      eventDate: parsedDate,
      suggestedClientId: match?.client.id ?? null,
      matchConfidence: match?.confidence ?? null,
      status: "PENDING",
    },
  });

  return match ? "matched" : "unmatched";
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-sync-secret");
  if (secret !== SYNC_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const clients = await prisma.client.findMany({ select: { id: true, name: true } });

  // Support both single event and batch
  const events: ShortcutEvent[] = Array.isArray(body.events)
    ? body.events
    : [{ title: body.title, startDate: body.startDate }];

  const counts = { scanned: 0, matched: 0, unmatched: 0, skipped: 0 };

  for (const event of events) {
    if (!event.title || !event.startDate) { counts.skipped++; continue; }
    counts.scanned++;
    const result = await processEvent(event, clients);
    if (result === "matched") counts.matched++;
    else if (result === "unmatched") counts.unmatched++;
    else counts.skipped++;
  }

  await prisma.calendarSyncLog.create({
    data: {
      eventsScanned: counts.scanned,
      eventsMatched: counts.matched,
      eventsPending: counts.unmatched,
      eventsSkipped: counts.skipped,
    },
  });

  return Response.json({ ok: true, ...counts });
}
