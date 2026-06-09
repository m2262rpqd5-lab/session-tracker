"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { CURRENCIES, formatCurrency } from "@/lib/currency";

type Template = {
  id: string;
  name: string;
  sessionCount: number;
  price: number;
  currency: string;
  validityDays: number | null;
  isActive: boolean;
};

export default function PackagesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", sessionCount: "", price: "", currency: "GBP", validityDays: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/package-templates");
    setTemplates(await res.json());
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/package-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        sessionCount: Number(form.sessionCount),
        price: Number(form.price),
        currency: form.currency,
        validityDays: form.validityDays ? Number(form.validityDays) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    setModal(false);
    setForm({ name: "", sessionCount: "", price: "", currency: "GBP", validityDays: "" });
    load();
  }

  async function toggle(t: Template) {
    await fetch(`/api/package-templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    load();
  }

  async function deleteTemplate(t: Template) {
    if (!confirm(`Delete template "${t.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/package-templates/${t.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error);
      return;
    }
    load();
  }

  const gbpTemplates = templates.filter((t) => t.currency === "GBP");
  const sarTemplates = templates.filter((t) => t.currency === "SAR");

  function TemplateTable({ list, currency }: { list: Template[]; currency: string }) {
    const label = currency === "GBP" ? "£ GBP" : "﷼ SAR";
    const accent = currency === "GBP" ? "text-green-700 bg-green-50 border-green-200" : "text-blue-700 bg-blue-50 border-blue-200";
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className={`px-5 py-3 border-b border-gray-100 flex items-center justify-between`}>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${accent}`}>{label}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Sessions</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Price</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Valid For</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {!loaded && (
              <tr><td colSpan={6} className="px-5 py-6 text-sm text-gray-400 text-center">Loading…</td></tr>
            )}
            {loaded && list.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-6 text-sm text-gray-400 text-center italic">No {currency} templates yet — click + New Template to add one.</td></tr>
            )}
            {list.map((t) => (
              <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-4 font-medium text-gray-900">{t.name}</td>
                <td className="px-5 py-4 text-gray-600">{t.sessionCount}</td>
                <td className="px-5 py-4 text-gray-600">{formatCurrency(t.price, t.currency)}</td>
                <td className="px-5 py-4 text-gray-600">{t.validityDays ? `${t.validityDays} days` : "—"}</td>
                <td className="px-5 py-4">
                  <button onClick={() => toggle(t)}
                    className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${t.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>
                    {t.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => deleteTemplate(t)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Package Templates</h1>
        <button onClick={() => setModal(true)} className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700">
          + New Template
        </button>
      </div>

      <TemplateTable list={gbpTemplates} currency="GBP" />
      <TemplateTable list={sarTemplates} currency="SAR" />

      <Modal open={modal} onClose={() => setModal(false)} title="New Package Template">
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          {[
            { key: "name", label: "Name", type: "text", required: true },
            { key: "sessionCount", label: "Number of Sessions", type: "number", required: true },
          ].map(({ key, label, type, required }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={type}
                required={required}
                value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
              <input
                type="number"
                required
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valid for (days, leave blank = no expiry)</label>
            <input
              type="number"
              value={form.validityDays}
              onChange={(e) => setForm((f) => ({ ...f, validityDays: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-gray-900 text-white text-sm py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
            {saving ? "Saving…" : "Create Template"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
