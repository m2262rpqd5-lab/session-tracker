"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdjustmentDeleteButton({ adjustmentId }: { adjustmentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Remove this adjustment? The session count change will be reversed.")) return;
    setLoading(true);
    await fetch(`/api/adjustments/${adjustmentId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 ml-1"
    >
      {loading ? "…" : "Remove"}
    </button>
  );
}
