import { clsx } from "clsx";

export default function SessionProgress({
  used,
  total,
  remaining,
}: {
  used: number;
  total: number;
  remaining: number;
}) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const barColor =
    remaining === 0
      ? "bg-red-400"
      : remaining <= 2
      ? "bg-yellow-400"
      : "bg-emerald-400";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{used} used</span>
        <span className={clsx("font-semibold", remaining === 0 ? "text-red-600" : "text-gray-700")}>
          {remaining} left
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
