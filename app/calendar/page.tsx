"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle, Clock, Copy, Check, RefreshCw, Upload } from "lucide-react";

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

function copyToClipboard(text: string) {
  // Preferred: async Clipboard API
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    return;
  }
  fallbackCopy(text);
}

function fallbackCopy(text: string) {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

function CopyField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="space-y-1.5">
      {label && <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</div>}
      <div className="flex items-center gap-2">
        <code className={`flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm break-all ${mono ? "font-mono" : ""}`}>
          {value}
        </code>
        <button
          onClick={copy}
          className="shrink-0 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
          title="Copy"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div className="flex-1 pb-5">
        <div className="font-medium text-gray-900 text-sm mb-2">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [testTitle, setTestTitle] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://session-tracker-six.vercel.app";
  const syncUrl = `${origin}/api/calendar/shortcuts-sync?secret=my-session-tracker-secret&title=`;

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
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/calendar/import", { method: "POST", body: fd });
    const d = await res.json();
    setImporting(false);
    if (res.ok) {
      setImportResult(`✓ Done! ${d.scanned} events imported, ${d.matched} matched to clients, ${d.skipped} duplicates/future skipped.`);
      load();
    } else {
      setImportResult(`✗ ${d.error}`);
    }
    // reset so same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function sendTestEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!testTitle.trim()) return;
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/calendar/shortcuts-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": "dev-secret" },
      body: JSON.stringify({ title: testTitle, startDate: new Date().toISOString() }),
    });
    const d = await res.json();
    setTesting(false);
    if (res.ok) {
      setTestResult(`✓ Sent! Matched: ${d.matched}, Unmatched: ${d.unmatched}`);
      setTestTitle("");
      load();
    } else {
      setTestResult(`✗ ${d.error}`);
    }
  }

  const [deletingAll, setDeletingAll] = useState(false);

  async function deleteAllPending() {
    if (!confirm(`Delete all ${pending.length} pending events? This cannot be undone.`)) return;
    setDeletingAll(true);
    await fetch("/api/calendar/pending", { method: "DELETE" });
    setDeletingAll(false);
    load();
  }

  const pending = events.filter((e) => e.status === "PENDING");
  const lastSync = syncLogs[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Calendar Sync</h1>
          {lastSync ? (
            <div className="text-xs text-gray-400 mt-0.5">
              Last sync {formatDistanceToNow(new Date(lastSync.syncedAt), { addSuffix: true })} ·{" "}
              {lastSync.eventsScanned} scanned · {lastSync.eventsMatched + lastSync.eventsPending} queued
            </div>
          ) : (
            <div className="text-xs text-gray-400 mt-0.5">No syncs yet — follow the guide below</div>
          )}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* File Import */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="font-medium text-gray-900">Import from Calendar File</div>
          <div className="text-sm text-gray-500 mt-0.5">Upload a <strong>.ics</strong> file from Apple/Google Calendar, or a <strong>.csv</strong> from Google Calendar export</div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 border border-gray-100">
              <div className="font-medium text-gray-800">🍎 Apple Calendar</div>
              <ol className="list-decimal pl-4 space-y-0.5 text-gray-500">
                <li>Open Calendar on Mac</li>
                <li>File → Export → Export…</li>
                <li>Save the <code className="bg-gray-100 px-1 rounded">.ics</code> file</li>
                <li>Upload it below</li>
              </ol>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 border border-gray-100">
              <div className="font-medium text-gray-800">📅 Google Calendar</div>
              <ol className="list-decimal pl-4 space-y-0.5 text-gray-500">
                <li>Open Google Calendar on web</li>
                <li>Settings → Import &amp; Export</li>
                <li>Click <strong>Export</strong> — downloads a zip</li>
                <li>Unzip, then upload the <code className="bg-gray-100 px-1 rounded">.ics</code> file</li>
              </ol>
            </div>
          </div>

          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto text-gray-300 mb-3" size={28} />
            <div className="text-sm font-medium text-gray-600">{importing ? "Importing…" : "Click to upload your .ics or .csv file"}</div>
            <div className="text-xs text-gray-400 mt-1">Duplicate events are automatically skipped</div>
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
            <div className={`text-sm px-3 py-2 rounded-lg ${importResult.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {importResult}
            </div>
          )}
        </div>
      </div>

      {/* Shortcuts Setup Guide */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="font-medium text-gray-900">Apple Shortcuts Setup</div>
          <div className="text-sm text-gray-500 mt-0.5">5-minute setup · runs automatically · no Terminal needed</div>
        </div>
        <div className="p-6 space-y-1">

          <Step n={1} title='Open Shortcuts → New Shortcut → add "Find Calendar Events"'>
            <p className="text-sm text-gray-500">
              Set the filter: <strong className="text-gray-700">Start Date is in the last 1 day</strong>.
              Add a calendar filter to select only your client session calendar.
            </p>
          </Step>

          <Step n={2} title='Add "Repeat with Each Item in Calendar Events"'>
            <p className="text-sm text-gray-500">Everything inside the loop runs once per event.</p>
          </Step>

          <Step n={3} title='Inside the loop, add "Get Contents of URL" — build the URL with two variables'>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Base URL — paste this first</div>
                <CopyField label="" value={syncUrl} mono />
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-1">
                  <div className="font-medium">After pasting the URL, add two variables:</div>
                  <ol className="list-decimal pl-4 space-y-1 text-amber-700">
                    <li>Click after <code className="bg-amber-100 px-1 rounded text-xs">title=</code>, tap the variable icon (✦), choose <strong>"Repeat Item's Title"</strong></li>
                    <li>Then type <code className="bg-amber-100 px-1 rounded text-xs">&date=</code> at the end, tap the variable icon again, choose <strong>"Repeat Item's Start Date"</strong></li>
                  </ol>
                  <div className="text-amber-600 text-xs mt-1">The date variable is required — without it every session is logged as today.</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-600 break-all">
                  <span className="text-gray-400">...&title=</span><span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Repeat Item's Title</span>
                  <span className="text-gray-400">&date=</span><span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Repeat Item's Start Date</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Method</div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono">GET</div>
              </div>
            </div>
          </Step>

          <Step n={4} title='Add "End Repeat", name the Shortcut "Sync Sessions", run it once'>
            <p className="text-sm text-gray-500">Use the test area below first to confirm everything works before running the full Shortcut.</p>
          </Step>

          <Step n={5} title="Automate: Shortcuts → Automation → New Automation → Time of Day">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
              <div className="flex gap-2"><span className="text-gray-400 w-20">Trigger</span><span className="text-gray-700 font-medium">Time of Day — 8 PM, Daily</span></div>
              <div className="flex gap-2"><span className="text-gray-400 w-20">Action</span><span className="text-gray-700 font-medium">Run Shortcut → "Sync Sessions"</span></div>
              <div className="flex gap-2"><span className="text-gray-400 w-20">Setting</span><span className="text-gray-700 font-medium">Turn off "Ask Before Running"</span></div>
            </div>
          </Step>

          {/* Test area */}
          <div className="border-t border-gray-100 pt-5 space-y-3">
            <div className="text-sm font-medium text-gray-700">Test it now</div>
            <form onSubmit={sendTestEvent} className="flex gap-2">
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder={clients[0] ? `e.g. "Session - ${clients[0].name}"` : "e.g. Session - Jane Smith"}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <button
                type="submit"
                disabled={testing || !testTitle.trim()}
                className="shrink-0 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-40"
              >
                {testing ? "Sending…" : "Send test event"}
              </button>
            </form>
            {testResult && (
              <div className={`text-sm px-3 py-2 rounded-lg ${testResult.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {testResult}
              </div>
            )}
          </div>
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
            <p className="text-gray-400 text-xs">Events from your Shortcut appear here after each sync.</p>
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
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-medium text-gray-700">Sync History</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-2 font-medium text-gray-400">Time</th>
                <th className="text-left px-5 py-2 font-medium text-gray-400">Scanned</th>
                <th className="text-left px-5 py-2 font-medium text-gray-400">Queued</th>
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
