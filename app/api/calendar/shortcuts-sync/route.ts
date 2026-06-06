/**
 * Shortcuts-friendly sync endpoint.
 *
 * SIMPLE usage (recommended for Apple Shortcuts):
 *   GET /api/calendar/shortcuts-sync?secret=YOUR_SECRET&title=EVENT_TITLE
 *
 * In the Shortcut's "Get Contents of URL" field, type:
 *   https://session-tracker-six.vercel.app/api/calendar/shortcuts-sync?secret=my-session-tracker-secret&title=
 * …then append the "Repeat Item" variable immediately after the = sign.
 * No JSON body, no custom headers needed.
 *
 * ADVANCED usage (JSON body, for batch/Python script):
 *   POST with body: { "title": "...", "startDate": "..." }
 *   or             { "events": [{ "title": "...", "startDate": "..." }] }
 *   Requires header: x-sync-secret: YOUR_SECRET
 */
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { matchEventToClient } from "@/lib/calendar-matcher";
import crypto from "crypto";

const SYNC_SECRET = process.env.SYNC_SECRET || "my-session-tracker-secret";

function deterministicId(title: string, startDate: string) {
  return "sc-" + crypto.createHash("sha1").update(`${title}|${startDate}`).digest("hex").slice(0, 16);
}

async function processEvent(
  title: string,
  startDate: string,
  clients: { id: string; name: string }[]
) {
  if (!title?.trim()) return "invalid";

  const parsedDate = new Date(startDate);
  const eventDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const calendarEventId = deterministicId(title, eventDate.toISOString().slice(0, 10));

  if (eventDate > new Date()) return "future";

  const existingSession = await prisma.session.findUnique({ where: { calendarEventId } });
  if (existingSession) return "duplicate";

  const existingPending = await prisma.pendingCalendarEvent.findUnique({ where: { calendarEventId } });
  if (existingPending) {
    if (existingPending.status === "PENDING") {
      await prisma.pendingCalendarEvent.update({
        where: { id: existingPending.id },
        data: { eventDate, eventTitle: title },
      });
    }
    return "duplicate";
  }

  const match = matchEventToClient(title, clients);

  await prisma.pendingCalendarEvent.create({
    data: {
      calendarEventId,
      eventTitle: title,
      eventDate,
      suggestedClientId: match?.client.id ?? null,
      matchConfidence: match?.confidence ?? null,
      status: "PENDING",
    },
  });

  return match ? "matched" : "unmatched";
}

// ── GET (simple Shortcuts usage) ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const secret = searchParams.get("secret");
  const title = searchParams.get("title");
  const date = searchParams.get("date");

  if (secret !== SYNC_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!title?.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const clients = await prisma.client.findMany({ select: { id: true, name: true } });
  const result = await processEvent(title, date || new Date().toISOString(), clients);

  await prisma.calendarSyncLog.create({
    data: {
      eventsScanned: 1,
      eventsMatched: result === "matched" ? 1 : 0,
      eventsPending: result === "unmatched" ? 1 : 0,
      eventsSkipped: ["duplicate", "future", "invalid"].includes(result) ? 1 : 0,
    },
  });

  return Response.json({ ok: true, result });
}

// ── POST (JSON body, for batch / Python script) ────────────────────────────────
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-sync-secret");
  if (secret !== SYNC_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const clients = await prisma.client.findMany({ select: { id: true, name: true } });

  const events: { title: string; startDate?: string }[] = Array.isArray(body.events)
    ? body.events
    : [{ title: body.title, startDate: body.startDate }];

  const counts = { scanned: 0, matched: 0, unmatched: 0, skipped: 0 };

  for (const event of events) {
    if (!event.title?.trim()) { counts.skipped++; continue; }
    counts.scanned++;
    const result = await processEvent(
      event.title,
      event.startDate || new Date().toISOString(),
      clients
    );
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
