"use client";
import { useEffect, useState, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle, Clock, Copy, Check, RefreshCw, Zap, Terminal } from "lucide-react";

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

function CopyField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="flex items-center gap-2">
        <code className={`flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm break-all ${mono ? "font-mono" : ""}`}>
          {value}
        </code>
        <button
          onClick={copy}
          className="shrink-0 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"
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
      <div className="flex-1 space-y-2 pb-4">
        <div className="font-medium text-gray-900 text-sm">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [tab, setTab] = useState<"shortcuts" | "python">("shortcuts");
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [testTitle, setTestTitle] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const syncSecret = "dev-secret";
  const appUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const syncUrl = `${appUrl}/api/calendar/shortcuts-sync`;

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

  async function sendTestEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!testTitle.trim()) return;
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/calendar/shortcuts-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": syncSecret },
      body: JSON.stringify({ title: testTitle, startDate: new Date().toISOString() }),
    });
    const d = await res.json();
    setTesting(false);
    if (res.ok) {
      setTestResult(`✓ Sent. Matched: ${d.matched}, Unmatched: ${d.unmatched}`);
      setTestTitle("");
      load();
    } else {
      setTestResult(`✗ ${d.error}`);
    }
  }

  const pending = events.filter((e) => e.status === "PENDING");
  const lastSync = syncLogs[0];

  const shortcutBody = JSON.stringify({ title: "Shortcut Input.title", startDate: "Shortcut Input.startDate" }, null, 2)
    .replace('"Shortcut Input.title"', "[Event Title variable]")
    .replace('"Shortcut Input.startDate"', "[Start Date variable, ISO 8601]");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Calendar Sync</h1>
          {lastSync && (
            <div className="text-xs text-gray-400 mt-0.5">
              Last sync {formatDistanceToNow(new Date(lastSync.syncedAt), { addSuffix: true })} ·{" "}
              {lastSync.eventsScanned} scanned · {lastSync.eventsMatched + lastSync.eventsPending} queued
            </div>
          )}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Setup Guide */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { key: "shortcuts", label: "Apple Shortcuts", icon: Zap, desc: "Easiest — no Terminal needed" },
            { key: "python", label: "Python Script", icon: Terminal, desc: "Runs automatically in background" },
          ].map(({ key, label, icon: Icon, desc }) => (
            <button
              key={key}
              onClick={() => setTab(key as "shortcuts" | "python")}
              className={`flex-1 flex items-center gap-2 px-5 py-3.5 text-sm transition-colors ${
                tab === key
                  ? "bg-gray-50 text-gray-900 font-medium border-b-2 border-gray-900"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon size={15} />
              <span>{label}</span>
              <span className="text-xs text-gray-400 hidden sm:inline">— {desc}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "shortcuts" && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">
                Build a Shortcut that reads your calendar and posts events here — no code, no Terminal.
                Takes about 5 minutes to set up, then runs automatically every day.
              </p>

              <Step n={1} title='Open the Shortcuts app and tap "+ New Shortcut"'>
                <p className="text-sm text-gray-500">On Mac: Spotlight → "Shortcuts". On iPhone/iPad: the Shortcuts app.</p>
              </Step>

              <Step n={2} title='Add action: "Find Calendar Events"'>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Search for <strong className="text-gray-700">Find Calendar Events</strong> and add it.</p>
                  <p>Configure it: <strong className="text-gray-700">Start Date is in the last 1 day</strong></p>
                  <p className="text-gray-400">Tip: add a calendar filter (e.g. "Work") so it only picks up your client sessions.</p>
                </div>
              </Step>

              <Step n={3} title='Add action: "Repeat with Each"'>
                <p className="text-sm text-gray-500">
                  Drag <strong className="text-gray-700">Repeat with Each Item in Calendar Events</strong> after the Find action.
                  Everything inside the loop runs once per event.
                </p>
              </Step>

              <Step n={4} title='Inside the loop, add action: "Get Contents of URL"'>
                <div className="space-y-3 text-sm text-gray-500">
                  <p>Configure the action with these exact values:</p>
                  <CopyField label="URL" value={syncUrl} mono />
                  <CopyField label="Method" value="POST" />
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Headers — tap "Add new header"</div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 text-xs font-mono">
                      <div className="flex gap-4">
                        <span className="text-gray-400 w-36">x-sync-secret</span>
                        <CopyField label="" value={syncSecret} mono />
                      </div>
                      <div className="flex gap-4">
                        <span className="text-gray-400 w-36">Content-Type</span>
                        <span>application/json</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Request Body — select "JSON"</div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono space-y-1">
                      <div className="flex gap-4">
                        <span className="text-gray-400 w-12">title</span>
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Repeat Item · Title</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-gray-400 w-12">startDate</span>
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Repeat Item · Start Date</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">Tap the blue variable pills to insert the Repeat Item properties.</p>
                  </div>
                </div>
              </Step>

              <Step n={5} title='Add "End Repeat" and name your Shortcut'>
                <p className="text-sm text-gray-500">Tap the arrow back, rename it e.g. <strong className="text-gray-700">"Sync Sessions"</strong>, and run it once manually to test.</p>
              </Step>

              <Step n={6} title="Automate it (optional but recommended)">
                <div className="text-sm text-gray-500 space-y-1">
                  <p>In Shortcuts → <strong className="text-gray-700">Automation</strong> tab → <strong className="text-gray-700">New Automation</strong>:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-gray-400">
                    <li>Trigger: <strong className="text-gray-700">Time of Day</strong> — e.g. 8 PM daily</li>
                    <li>Action: <strong className="text-gray-700">Run Shortcut → "Sync Sessions"</strong></li>
                    <li>Turn off "Ask Before Running"</li>
                  </ul>
                </div>
              </Step>

              {/* Test area */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <div className="text-sm font-medium text-gray-700">Test your setup</div>
                <p className="text-sm text-gray-500">Send a fake event now to confirm the pipeline is working before you set up the Shortcut.</p>
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
          )}

          {tab === "python" && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">
                A Python script reads your Mac's Calendar database directly and syncs automatically every 15 minutes via a background LaunchAgent.
              </p>

              <Step n={1} title="Install the requests library (one time)">
                <CopyField label="Run in Terminal" value="pip3 install requests" mono />
              </Step>

              <Step n={2} title="Run the sync script manually to test">
                <CopyField label="Run in Terminal" value={`SYNC_SECRET=${syncSecret} SESSION_TRACKER_URL=${appUrl} python3 ${typeof window !== "undefined" ? window.location.origin.replace(/https?:\/\/[^/]+/, "") : ""}/sync/sync_calendar.py`.replace("//", "/")} mono />
                <p className="text-sm text-gray-400 mt-1">The script is at <code className="bg-gray-100 px-1 rounded text-xs">session-tracker/sync/sync_calendar.py</code></p>
              </Step>

              <Step n={3} title="Grant Full Disk Access to Terminal (macOS requirement)">
                <div className="text-sm text-gray-500 space-y-1">
                  <p><strong className="text-gray-700">System Settings → Privacy &amp; Security → Full Disk Access</strong></p>
                  <p>Add <strong className="text-gray-700">Terminal</strong> (or iTerm) to allow the script to read the Calendar database.</p>
                  <p className="text-gray-400">Without this, macOS blocks access to <code className="bg-gray-100 px-1 rounded text-xs">~/Library/Group Containers/…/Calendar Cache</code>.</p>
                </div>
              </Step>

              <Step n={4} title="Install LaunchAgent for automatic background sync">
                <div className="text-sm text-gray-500 space-y-2">
                  <p>Edit the path in <code className="bg-gray-100 px-1 rounded text-xs">sync/com.sessiontracker.sync.plist</code> to match your username, then:</p>
                  <CopyField label="Install" value="cp sync/com.sessiontracker.sync.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/com.sessiontracker.sync.plist" mono />
                  <p className="text-gray-400">Runs every 15 minutes in the background. Logs go to <code className="bg-gray-100 px-1 rounded text-xs">/tmp/sessiontracker-sync.log</code>.</p>
                </div>
              </Step>
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
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : pending.length === 0 ? (
          <div className="py-10 text-center space-y-1">
            <CheckCircle className="mx-auto text-green-400 mb-2" size={28} />
            <p className="text-gray-500 text-sm">All caught up — no pending events.</p>
            <p className="text-gray-400 text-xs">New events will appear here after each sync.</p>
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
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${confidence >= 0.85 ? "bg-green-100 text-green-700" : confidence >= 0.5 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
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
                    <span className="text-gray-300 ml-1.5">{formatDistanceToNow(new Date(log.syncedAt), { addSuffix: true })}</span>
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
