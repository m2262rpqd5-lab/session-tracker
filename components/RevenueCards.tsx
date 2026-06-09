import { PoundSterling } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

type Props = {
  thisMonth: Record<string, number>;
  total: Record<string, number>;
  gbpToSar: number;
};

export default function RevenueCards({ thisMonth, total, gbpToSar }: Props) {
  const monthGbp = thisMonth["GBP"] ?? 0;
  const totalGbp = total["GBP"] ?? 0;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-green-600 mb-2"><PoundSterling size={18} /></div>
        <div className="text-2xl font-bold text-gray-900">{formatCurrency(monthGbp, "GBP")}</div>
        <div className="text-xs text-gray-500 mt-0.5">This Month</div>
        <div className="text-xs text-gray-400 mt-1">≈ {formatCurrency(Math.round(monthGbp * gbpToSar), "SAR")}</div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-emerald-600 mb-2"><PoundSterling size={18} /></div>
        <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalGbp, "GBP")}</div>
        <div className="text-xs text-gray-500 mt-0.5">Total Revenue</div>
        <div className="text-xs text-gray-400 mt-1">≈ {formatCurrency(Math.round(totalGbp * gbpToSar), "SAR")}</div>
      </div>
    </>
  );
}
