import { clsx } from "clsx";

const styles: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  EXPIRED: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full", styles[status] ?? "bg-gray-100 text-gray-600")}>
      {status}
    </span>
  );
}
