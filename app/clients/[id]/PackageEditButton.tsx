"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";

export default function PackageEditButton({
  packageId,
  name,
  totalSessions,
  usedSessions,
}: {
  packageId: string;
  name: string;
  totalSessions: number;
  usedSessions: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name,
    totalSessions: String(totalSessions),
    usedSessions: String(usedSessions),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const remaining = Number(form.totalSessions || 0) - Number(form.usedSessions || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/client-packages/${packageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        totalSessions: Number(form.totalSessions),
        usedSessions: Number(form.usedSessions),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to save");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-blue-400 hover:text-blue-600"
      >
        Edit
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit Package">
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Package Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Sessions</label>
              <input
                type="number"
                min="0"
                value={form.totalSessions}
                onChange={(e) => setForm((f) => ({ ...f, totalSessions: e.target.value }))}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sessions Used</label>
              <input
                type="number"
                min="0"
                value={form.usedSessions}
                onChange={(e) => setForm((f) => ({ ...f, usedSessions: e.target.value }))}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Remaining after save: <span className={`font-medium ${remaining < 0 ? "text-red-500" : "text-gray-700"}`}>{remaining}</span>
            {" "}(adjustments still apply on top of this)
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-gray-900 text-white text-sm py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </Modal>
    </>
  );
}
