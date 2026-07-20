"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PaymentDeleteButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Remove this payment? This cannot be undone.")) return;
    setLoading(true);
    await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 ml-1 px-1 py-1.5 touch-manipulation"
    >
      {loading ? "…" : "Remove"}
    </button>
  );
}
