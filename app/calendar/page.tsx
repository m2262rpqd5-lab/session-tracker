"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock } from "lucide-react";

type PendingEvent = {
  id: string;
  eventTitle: string;
  eventDate: string;
  matchConfidence: number | null;
  status: string;
  suggestedClient: { id: string; name: string } | null;
};

type Client = { id: string; name: string };

export default function CalendarPage() {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  async function load() {
    const [evRes, clRes] = await Promise.all([
      fetch("/api/calendar/pending"),
      fetch("/api/clients"),
    ]);
    setEvents(await evRes.json());
    setClients(await clRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(event: PendingEvent) {
    const clientId = overrides[event.id] ?? event.suggestedClient?.id;
    if (!clientId) { alert("Please select a client first."); return; }
    setProcessing((p) => ({ ...p, [event.id]: true }));
    const res = await fetch(`/api/calendar/pending/${event.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error ?? "Failed to approve");
    }
    setProcessing((p) => ({ ...p, [event.id]: false }));
    load();
  }

  async function reject(id: string) {
    setProcessing((p) => ({ ...p, [id]: true }));
    await fetch(`/api/calendar/pending/${id}/reject`, { method: "POST" });
    setProcessing((p) => ({ ...p, [id]: false }));
    load();
  }

  const pending = events.filter((e) => e.status === "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Calendar Sync</h1>
        <button onClick={load} className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {/* Setup instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <div className="font-medium">Apple Calendar sync setup</div>
        <p className="text-blue-700">
          Run the companion script on your Mac (see <code className="bg-blue-100 px-1 rounded">sync/sync_calendar.py</code>) to push events here.
          Events are matched to clients by name and queued below for your review.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : pending.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle className="mx-auto text-green-400 mb-3" size={32} />
          <p className="text-gray-500">All caught up — no pending events.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 text-sm font-medium text-gray-700">
            {pending.length} event{pending.length !== 1 ? "s" : ""} awaiting review
          </div>
          <div className="divide-y divide-gray-50">
            {pending.map((event) => {
              const selectedId = overrides[event.id] ?? event.suggestedClient?.id ?? "";
              const confidence = event.matchConfidence;
              return (
                <div key={event.id} className="px-5 py-4 flex items-center gap-4">
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
                      <span className={`text-xs px-1.5 py-0.5 rounded ${confidence >= 0.85 ? "bg-green-100 text-green-700" : confidence >= 0.5 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                        {Math.round(confidence * 100)}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => approve(event)}
                      disabled={processing[event.id]}
                      className="flex items-center gap-1 text-sm bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 disabled:opacity-50"
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button
                      onClick={() => reject(event.id)}
                      disabled={processing[event.id]}
                      className="flex items-center gap-1 text-sm bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50"
                    >
                      <XCircle size={13} /> Skip
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
