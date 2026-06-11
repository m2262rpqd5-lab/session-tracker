"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { format, formatDistanceToNow, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { CheckCircle, XCircle, Clock, RefreshCw, Upload } from "lucide-react";

type PendingEvent = {
  id: string;
  eventTitle: string;
  eventDate: string;
  matchConfidence: number | null;
  status: string;
  suggestedClient: { id: string; name: string } | null;
};
type Client = { id: string; name: string };
type SyncLog = {
  id: string;
  syncedAt: string;
  eventsScanned: number;
  eventsMatched: number;
  eventsPending: number;
  eventsSkipped: number;
};

type RangeMode = "today" | "this_week" | "last_week" | "custom";

function today() { return new Date().toISOString().slice(0, 10); }
function weekStart(d: Date) { return startOfWeek(d, { weekStartsOn: 1 }).toISOString().slice(0, 10); }
function weekEnd(d: Date) { return endOfWeek(d, { weekStartsOn: 1 }).toISOString().slice(0, 10); }

export default function CalendarPage() {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Date range state
  const [rangeMode, setRangeMode] = useState<RangeMode>("this_week");
  const [customFrom, setCustomFrom] = useState(today());
  const [customTo, setCustomTo] = useState(today());

  const now = new Date();
  const rangeOptions: { value: RangeMode; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "this_week", label: "This week" },
    { value: "last_week", label: "Last week" },
    { value: "custom", label: "Custom range" },
  ];

  function getRange(): { from: string; to: string } {
    if (rangeMode === "today") return { from: today(), to: today() };
    if (rangeMode === "this_week") return { from: weekStart(now), to: weekEnd(now) };
    if (rangeMode === "last_week") {
      const lw = subWeeks(now, 1);
      return { from: weekStart(lw), to: weekEnd(lw) };
    }
    return { from: customFrom, to: customTo };
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [evRes, clRes, logRes] = await Promise.all([
      fetch("/api/calendar/pending"),
      fetch("/api/clients"),
      fetch("/api/calendar/sync-history"),
    ]);
    setEvents(await evRes.json());
    setClients(await clRes.json());
    setSyncLogs(await logRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(event: PendingEvent) {
    const clientId = overrides[event.id] ?? event.suggestedClient?.id;
    if (!clientId) { alert("Please select a client first."); return; }
    setProcessing((p) => ({ ...p, [event.id]: true }));
    const res = await fetch(`/api/calendar/pending/${event.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error ?? "Failed"); }
    setProcessing((p) => ({ ...p, [event.id]: false }));
    load();
  }

  async function reject(id: string) {
    setProcessing((p) => ({ ...p, [id]: true }));
    await fetch(`/api/calendar/pending/${id}/reject`, { method: "POST" });
    setProcessing((p) => ({ ...p, [id]: false }));
    load();
  }

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const { from, to } = getRange();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("from", from);
    fd.append("to", to);
    const res = await fetch("/api/calendar/import", { method: "POST", body: fd });
    const d = await res.json();
    setImporting(false);
    if (res.ok) {
      setImportResult({ ok: true, msg: `Done! ${d.scanned} events scanned, ${d.matched} matched to clients, ${d.skipped} outside range / duplicates skipped.` });
      load();
    } else {
      setImportResult({ ok: false, msg: d.error ?? "Import failed" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function deleteAllPending() {
    if (!confirm(`Delete all ${pending.length} pending events? This cannot be undone.`)) return;
    setDeletingAll(true);
    await fetch("/api/calendar/pending", { method: "DELETE" });
    setDeletingAll(false);
    load();
  }

  async function deleteHistory() {
    if (!confirm("Delete all sync history? This cannot be undone.")) return;
    setDeletingHistory(true);
    await fetch("/api/calendar/sync-history", { method: "DELETE" });
    setDeletingHistory(false);
    load();
  }

  const pending = events.filter((e) => e.status === "PENDING");
  const lastSync = syncLogs[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Calendar Import</h1>
          {lastSync ? (
            <div className="text-xs text-gray-400 mt-0.5">
              Last import {formatDistanceToNow(new Date(lastSync.syncedAt), { addSuffix: true })}
            </div>
          ) : (
            <div className="text-xs text-gray-400 mt-0.5">No imports yet</div>
          )}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Import card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="font-medium text-gray-900">Import from Calendar File</div>
          <div className="text-sm text-gray-500 mt-0.5">
            Upload a <strong>.ics</strong> or <strong>.csv</strong> export from Apple or Google Calendar — only sessions within the selected date range will be imported.
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* How to export */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 border border-gray-100">
              <div className="font-medium text-gray-800">🍎 Apple Calendar</div>
              <ol className="list-decimal pl-4 space-y-0.5 text-gray-500 text-xs">
                <li>Open Calendar on Mac</li>
                <li>File → Export → Export…</li>
                <li>Save the <code className="bg-gray-100 px-1 rounded">.ics</code> file &amp; upload below</li>
              </ol>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 border border-gray-100">
              <div className="font-medium text-gray-800">📅 Google Calendar</div>
              <ol className="list-decimal pl-4 space-y-0.5 text-gray-500 text-xs">
                <li>Open Google Calendar on web</li>
                <li>Settings → Import &amp; Export → Export</li>
                <li>Unzip, upload the <code className="bg-gray-100 px-1 rounded">.ics</code> file below</li>
              </ol>
            </div>
          </div>

          {/* Date range picker */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Date range to import</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {rangeOptions.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setRangeMode(o.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    rangeMode === o.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {rangeMode === "custom" && (
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
              </div>
            )}

            {rangeMode !== "custom" && (
              <div className="text-xs text-gray-400">
                {(() => {
                  const { from, to } = getRange();
                  return from === to
                    ? `Importing sessions on ${format(new Date(from), "MMM d, yyyy")}`
                    : `Importing sessions from ${format(new Date(from), "MMM d")} to ${format(new Date(to), "MMM d, yyyy")}`;
                })()}
              </div>
            )}
          </div>

          {/* Upload area */}
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
            onClick={() => !importing && fileInputRef.current?.click()}
          >
            <Upload className="mx-auto text-gray-300 mb-3" size={28} />
            <div className="text-sm font-medium text-gray-600">
              {importing ? "Importing…" : "Click to upload your .ics or .csv file"}
            </div>
            <div className="text-xs text-gray-400 mt-1">Duplicates are automatically skipped</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ics,.csv"
              className="hidden"
              onChange={importFile}
              disabled={importing}
            />
          </div>

          {importResult && (
            <div className={`text-sm px-3 py-2 rounded-lg ${importResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {importResult.ok ? "✓ " : "✗ "}{importResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* Pending Events */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {loading ? "Loading…" : pending.length === 0 ? "Pending Events" : `${pending.length} event${pending.length !== 1 ? "s" : ""} awaiting review`}
          </span>
          {pending.length > 0 && (
            <button
              onClick={deleteAllPending}
              disabled={deletingAll}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
            >
              <XCircle size={12} />
              {deletingAll ? "Deleting…" : "Delete all"}
            </button>
          )}
        </div>
        {loading ? (
          <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : pending.length === 0 ? (
          <div className="py-10 text-center space-y-1">
            <CheckCircle className="mx-auto text-green-400 mb-2" size={28} />
            <p className="text-gray-500 text-sm">All caught up — no pending events.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {pending.map((event) => {
              const selectedId = overrides[event.id] ?? event.suggestedClient?.id ?? "";
              const confidence = event.matchConfidence;
              return (
                <div key={event.id} className="px-5 py-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{event.eventTitle}</div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock size={11} />
                      {format(new Date(event.eventDate), "MMM d, yyyy · h:mm a")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={selectedId}
                      onChange={(e) => setOverrides((o) => ({ ...o, [event.id]: e.target.value }))}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                      <option value="">— select client —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {confidence !== null && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidence >= 0.85 ? "bg-green-100 text-green-700" : confidence >= 0.5 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                        {Math.round(confidence * 100)}% match
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => approve(event)} disabled={processing[event.id]}
                      className="flex items-center gap-1 text-sm bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 disabled:opacity-50">
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button onClick={() => reject(event.id)} disabled={processing[event.id]}
                      className="flex items-center gap-1 text-sm bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50">
                      <XCircle size={13} /> Skip
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sync History */}
      {syncLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Import History</span>
            <button
              onClick={deleteHistory}
              disabled={deletingHistory}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
            >
              <XCircle size={12} />
              {deletingHistory ? "Deleting…" : "Delete all"}
            </button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-2 font-medium text-gray-400">Time</th>
                <th className="text-left px-5 py-2 font-medium text-gray-400">Scanned</th>
                <th className="text-left px-5 py-2 font-medium text-gray-400">Matched</th>
                <th className="text-left px-5 py-2 font-medium text-gray-400">Skipped</th>
              </tr>
            </thead>
            <tbody>
              {syncLogs.map((log) => (
                <tr key={log.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 text-gray-500">
                    {format(new Date(log.syncedAt), "MMM d, h:mm a")}
                    <span className="text-gray-300 ml-2">{formatDistanceToNow(new Date(log.syncedAt), { addSuffix: true })}</span>
                  </td>
                  <td className="px-5 py-2.5 text-gray-600">{log.eventsScanned}</td>
                  <td className="px-5 py-2.5 text-gray-600">{log.eventsMatched + log.eventsPending}</td>
                  <td className="px-5 py-2.5 text-gray-400">{log.eventsSkipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
