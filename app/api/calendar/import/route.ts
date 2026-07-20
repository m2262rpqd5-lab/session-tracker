/**
 * POST /api/calendar/import
 * Accepts a multipart/form-data upload with a single field "file"
 * containing either a .ics (iCalendar) or .csv (Google Calendar export) file.
 *
 * Parses events, runs them through the same matching + dedup logic used by
 * the Shortcuts sync, and queues new events as PendingCalendarEvents.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma";
import { NextRequest } from "next/server";
import { matchEventToClient } from "@/lib/calendar-matcher";
import crypto from "crypto";

// ── helpers ───────────────────────────────────────────────────────────────────

function deterministicId(title: string, dateStr: string) {
  return "imp-" + crypto.createHash("sha1").update(`${title}|${dateStr}`).digest("hex").slice(0, 16);
}

type RawEvent = { title: string; startDate: Date };

// ── ICS parser ────────────────────────────────────────────────────────────────

function parseIcsDate(val: string): Date | null {
  // DATE-TIME with TZID or UTC:  20240115T100000Z  or  20240115T100000
  // DATE only:                   20240115
  const clean = val.split(";").pop()?.split(":").pop() ?? val;
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
  if (!m) return null;
  return new Date(
    Date.UTC(
      Number(m[1]), Number(m[2]) - 1, Number(m[3]),
      Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)
    )
  );
}

function parseIcs(text: string): RawEvent[] {
  const events: RawEvent[] = [];
  const blocks = text.split("BEGIN:VEVENT");
  for (const block of blocks.slice(1)) {
    const end = block.indexOf("END:VEVENT");
    const body = end !== -1 ? block.slice(0, end) : block;

    // Unfold lines (RFC 5545: CRLF + whitespace = continuation)
    const unfolded = body.replace(/\r?\n[ \t]/g, "");

    const lines: Record<string, string> = {};
    for (const line of unfolded.split(/\r?\n/)) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const key = line.slice(0, colon).split(";")[0].toUpperCase();
      lines[key] = line.slice(colon + 1).trim();
    }

    const title = lines["SUMMARY"]?.replace(/\\,/g, ",").replace(/\\n/g, " ").trim();
    const rawDate = lines["DTSTART"] ?? lines["DTSTART;VALUE=DATE"];
    if (!title || !rawDate) continue;

    const startDate = parseIcsDate(rawDate);
    if (!startDate) continue;

    events.push({ title, startDate });
  }
  return events;
}

// ── Google Calendar CSV parser ────────────────────────────────────────────────
// Columns (Google export): Subject,Start Date,Start Time,End Date,...

function parseCsv(text: string): RawEvent[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase());
  const subjectIdx = headers.findIndex((h) => h === "subject");
  const startDateIdx = headers.findIndex((h) => h === "start date");
  const startTimeIdx = headers.findIndex((h) => h === "start time");

  if (subjectIdx === -1 || startDateIdx === -1) return [];

  const events: RawEvent[] = [];
  for (const line of lines.slice(1)) {
    // Simple CSV split (handles quoted fields with commas inside)
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cols.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur);

    const title = cols[subjectIdx]?.trim();
    const dateStr = cols[startDateIdx]?.trim();
    const timeStr = startTimeIdx !== -1 ? cols[startTimeIdx]?.trim() : "";
    if (!title || !dateStr) continue;

    const combined = timeStr ? `${dateStr} ${timeStr}` : dateStr;
    const startDate = new Date(combined);
    if (isNaN(startDate.getTime())) continue;

    events.push({ title, startDate });
  }
  return events;
}

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const fromStr = formData.get("from") as string | null;
  const toStr = formData.get("to") as string | null;

  if (!file) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  const text = await file.text();
  const filename = file.name.toLowerCase();

  let rawEvents: RawEvent[];
  if (filename.endsWith(".ics")) {
    rawEvents = parseIcs(text);
  } else if (filename.endsWith(".csv")) {
    rawEvents = parseCsv(text);
  } else {
    return Response.json({ error: "Unsupported file type — upload a .ics or .csv file" }, { status: 400 });
  }

  if (rawEvents.length === 0) {
    return Response.json({ error: "No events found in file" }, { status: 400 });
  }

  // Date range filter
  const fromDate = fromStr ? new Date(fromStr) : null;
  const toDate = toStr ? new Date(toStr) : null;
  if (toDate) toDate.setHours(23, 59, 59, 999); // include full end day

  const clients = await prisma.client.findMany({
    select: { id: true, name: true },
    where: { isArchived: false },
  });
  const now = new Date();
  const counts = { scanned: 0, autoLogged: 0, queued: 0, skipped: 0 };

  for (const { title, startDate } of rawEvents) {
    if (!title.trim()) { counts.skipped++; continue; }
    if (startDate > now) { counts.skipped++; continue; }
    if (fromDate && startDate < fromDate) { counts.skipped++; continue; }
    if (toDate && startDate > toDate) { counts.skipped++; continue; }

    counts.scanned++;

    const dateKey = startDate.toISOString().slice(0, 10);
    const calendarEventId = deterministicId(title, dateKey);

    const existingSession = await prisma.session.findUnique({ where: { calendarEventId } });
    if (existingSession) { counts.skipped++; continue; }

    const existingPending = await prisma.pendingCalendarEvent.findUnique({ where: { calendarEventId } });
    if (existingPending) { counts.skipped++; continue; }

    const match = matchEventToClient(title, clients);

    // High confidence — auto-log directly to the client's active package
    if (match && match.confidence >= 0.85) {
      const activePkg = await prisma.clientPackage.findFirst({
        where: { clientId: match.client.id, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });

      if (activePkg) {
        const ops: Prisma.PrismaPromise<unknown>[] = [
          prisma.session.create({
            data: {
              clientPackageId: activePkg.id,
              sessionDate: startDate,
              source: "CALENDAR_SYNC",
              calendarEventId,
              notes: match.isLateCancel ? "Late Cancel" : null,
            },
          }),
          prisma.clientPackage.update({
            where: { id: activePkg.id },
            data: { usedSessions: { increment: 1 } },
          }),
        ];

        // Late cancel: also add an adjustment record as a marker (delta 0 = no extra count change)
        if (match.isLateCancel) {
          ops.push(
            prisma.adjustment.create({
              data: {
                clientPackageId: activePkg.id,
                delta: 0,
                reason: "Late Cancel",
                adjustedAt: startDate,
              },
            })
          );
        }

        await prisma.$transaction(ops);
        counts.autoLogged++;
        continue;
      }
      // No active package — fall through to pending queue
    }

    // Low/no confidence — queue for manual review
    await prisma.pendingCalendarEvent.create({
      data: {
        calendarEventId,
        eventTitle: title,
        eventDate: startDate,
        suggestedClientId: match?.client.id ?? null,
        matchConfidence: match?.confidence ?? null,
        status: "PENDING",
      },
    });
    counts.queued++;
  }

  await prisma.calendarSyncLog.create({
    data: {
      eventsScanned: counts.scanned,
      eventsMatched: counts.autoLogged,
      eventsPending: counts.queued,
      eventsSkipped: counts.skipped,
    },
  });

  return Response.json({ ok: true, ...counts });
}
