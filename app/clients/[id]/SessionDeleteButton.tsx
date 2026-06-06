"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SessionDeleteButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Remove this session? The session count will be decremented.")) return;
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 ml-2"
    >
      {loading ? "…" : "Remove"}
    </button>
  );
}
