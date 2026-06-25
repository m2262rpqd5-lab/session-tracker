"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PackageDeleteButton({ packageId }: { packageId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this package? All its sessions, payments, and adjustments will also be removed.")) return;
    setLoading(true);
    await fetch(`/api/client-packages/${packageId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
    >
      {loading ? "…" : "Delete"}
    </button>
  );
}
