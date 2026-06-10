"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { CURRENCIES, formatCurrency } from "@/lib/currency";

type Template = { id: string; name: string; sessionCount: number; price: number; currency: string };
type Pkg = { id: string; name: string; status: string };
type Client = { id: string; name: string; isArchived: boolean; currency: string; clientType: string };

export default function ClientActions({
  client,
  templates,
  activePackage,
}: {
  client: Client;
  templates: Template[];
  activePackage: Pkg | null;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"session" | "payment" | "package" | "adjustment" | "currency" | "clientType" | null>(null);
  const [archiving, setArchiving] = useState(false);
  const close = () => setModal(null);
  const refresh = () => { close(); router.refresh(); };

  async function toggleArchive() {
    if (!confirm(client.isArchived
      ? `Unarchive ${client.name}? They'll reappear on the dashboard.`
      : `Archive ${client.name}? They'll be hidden from the dashboard.`
    )) return;
    setArchiving(true);
    await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !client.isArchived }),
    });
    setArchiving(false);
    router.push("/clients");
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap justify-end">
        {!client.isArchived && activePackage && (
          <>
            <Btn onClick={() => setModal("session")} color="blue">Log Session</Btn>
            <Btn onClick={() => setModal("payment")} color="green">Add Payment</Btn>
            <Btn onClick={() => setModal("adjustment")} color="orange">Adjustment</Btn>
          </>
        )}
        {!client.isArchived && (
          <Btn onClick={() => setModal("package")} color="gray">Assign Package</Btn>
        )}
        <Btn onClick={() => setModal("clientType")} color="gray">
          {client.clientType === "LYO" ? "LYO" : "Private"}
        </Btn>
        <Btn onClick={() => setModal("currency")} color="gray">
          {client.currency === "GBP" ? "£ GBP" : "﷼ SAR"}
        </Btn>
        <Btn onClick={toggleArchive} color={client.isArchived ? "green" : "red"} disabled={archiving}>
          {archiving ? "…" : client.isArchived ? "Unarchive" : "Archive"}
        </Btn>
      </div>

      {/* Log Session */}
      <Modal open={modal === "session"} onClose={close} title="Log Session">
        <LogSessionForm packageId={activePackage?.id ?? ""} onDone={refresh} />
      </Modal>

      {/* Add Payment */}
      <Modal open={modal === "payment"} onClose={close} title="Record Payment">
        <PaymentForm packageId={activePackage?.id ?? ""} currency={client.currency} onDone={refresh} />
      </Modal>

      {/* Assign Package */}
      <Modal open={modal === "package"} onClose={close} title="Assign Package">
        <AssignPackageForm clientId={client.id} templates={templates} currency={client.currency} onDone={refresh} />
      </Modal>

      {/* Adjustment */}
      <Modal open={modal === "adjustment"} onClose={close} title="Add Adjustment">
        <AdjustmentForm packageId={activePackage?.id ?? ""} onDone={refresh} />
      </Modal>

      {/* Client Type */}
      <Modal open={modal === "clientType"} onClose={close} title="Change Client Type">
        <ClientTypeForm clientId={client.id} current={client.clientType} onDone={refresh} />
      </Modal>

      {/* Currency */}
      <Modal open={modal === "currency"} onClose={close} title="Change Currency">
        <CurrencyForm clientId={client.id} current={client.currency} onDone={refresh} />
      </Modal>
    </>
  );
}

function Btn({ onClick, children, color, disabled }: { onClick: () => void; children: React.ReactNode; color: string; disabled?: boolean }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
    green: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
    orange: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200",
    gray: "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200",
    red: "bg-red-50 text-red-600 hover:bg-red-100 border-red-200",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-sm border px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${colors[color]}`}
    >
      {children}
    </button>
  );
}

function LogSessionForm({ packageId, onDone }: { packageId: string; onDone: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientPackageId: packageId, sessionDate: date, notes }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
      </div>
      <button type="submit" disabled={saving}
        className="w-full bg-gray-900 text-white text-sm py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
        {saving ? "Saving…" : "Log Session"}
      </button>
    </form>
  );
}

function PaymentForm({ packageId, currency, onDone }: { packageId: string; currency: string; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const currencyLabel = currency === "GBP" ? "£ GBP" : "SAR";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientPackageId: packageId, amount: Number(amount), method, notes, paymentDate: date }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({currencyLabel})</label>
        <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
          {["Cash", "Venmo", "Zelle", "Check", "Credit Card", "Bank Transfer", "Other"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
      </div>
      <button type="submit" disabled={saving}
        className="w-full bg-gray-900 text-white text-sm py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
        {saving ? "Saving…" : "Record Payment"}
      </button>
    </form>
  );
}

function AssignPackageForm({ clientId, templates, currency, onDone }: { clientId: string; templates: Template[]; currency: string; onDone: () => void }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [isCustom, setIsCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customSessions, setCustomSessions] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/client-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        ...(isCustom ? { customName, customSessions } : { templateId }),
        startDate,
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setIsCustom(false)}
          className={`flex-1 text-sm py-1.5 rounded-lg border ${!isCustom ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600"}`}>
          From template
        </button>
        <button type="button" onClick={() => setIsCustom(true)}
          className={`flex-1 text-sm py-1.5 rounded-lg border ${isCustom ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600"}`}>
          Custom
        </button>
      </div>

      {!isCustom ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Package</label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {t.sessionCount} sessions @ {t.currency === "GBP" ? `£${t.price}` : `SAR ${t.price}`}</option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Package Name</label>
            <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} required={isCustom}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Sessions</label>
            <input type="number" min="1" value={customSessions} onChange={(e) => setCustomSessions(e.target.value)} required={isCustom}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
      </div>
      <button type="submit" disabled={saving}
        className="w-full bg-gray-900 text-white text-sm py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
        {saving ? "Assigning…" : "Assign Package"}
      </button>
    </form>
  );
}

function CurrencyForm({ clientId, current, onDone }: { clientId: string; current: string; onDone: () => void }) {
  const [currency, setCurrency] = useState(current);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency }),
    });
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={saving}
        className="w-full bg-gray-900 text-white text-sm py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function ClientTypeForm({ clientId, current, onDone }: { clientId: string; current: string; onDone: () => void }) {
  const [clientType, setClientType] = useState(current);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientType }),
    });
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2">
        {["PRIVATE", "LYO"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setClientType(t)}
            className={`flex-1 text-sm py-2 rounded-lg border transition-colors ${clientType === t ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {t === "PRIVATE" ? "Private" : "LYO"}
          </button>
        ))}
      </div>
      <button type="submit" disabled={saving}
        className="w-full bg-gray-900 text-white text-sm py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function AdjustmentForm({ packageId, onDone }: { packageId: string; onDone: () => void }) {
  const [delta, setDelta] = useState("1");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientPackageId: packageId, delta: Number(delta), reason }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sessions delta (use negative to deduct)</label>
        <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} required
          placeholder="e.g. Bonus session, Missed appointment refund"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
      </div>
      <button type="submit" disabled={saving}
        className="w-full bg-gray-900 text-white text-sm py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
        {saving ? "Saving…" : "Save Adjustment"}
      </button>
    </form>
  );
}
