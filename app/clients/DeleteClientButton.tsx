"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export default function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); // prevent Link navigation
    e.stopPropagation();
    if (!confirm(`Permanently delete "${clientName}"? All their packages, sessions, and payments will be deleted. This cannot be undone.`)) return;
    setLoading(true);
    await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title="Delete permanently"
      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
    >
      <Trash2 size={12} />
      {loading ? "Deleting…" : "Delete"}
    </button>
  );
}
