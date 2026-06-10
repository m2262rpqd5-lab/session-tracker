import { PoundSterling } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

type Props = {
  thisMonth: number;
  total: number;
  gbpToSar: number;
};

export default function RevenueCards({ thisMonth, total, gbpToSar }: Props) {
  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-green-600 mb-2"><PoundSterling size={18} /></div>
        <div className="text-2xl font-bold text-gray-900">{formatCurrency(Math.round(thisMonth), "GBP")}</div>
        <div className="text-xs text-gray-500 mt-0.5">This Month</div>
        <div className="text-xs text-gray-400 mt-1">≈ {formatCurrency(Math.round(thisMonth * gbpToSar), "SAR")}</div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-emerald-600 mb-2"><PoundSterling size={18} /></div>
        <div className="text-2xl font-bold text-gray-900">{formatCurrency(Math.round(total), "GBP")}</div>
        <div className="text-xs text-gray-500 mt-0.5">Total Revenue</div>
        <div className="text-xs text-gray-400 mt-1">≈ {formatCurrency(Math.round(total * gbpToSar), "SAR")}</div>
      </div>
    </>
  );
}
