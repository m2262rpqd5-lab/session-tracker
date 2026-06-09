"use client";
import { PoundSterling } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

type Props = {
  thisMonth: Record<string, number>;
  total: Record<string, number>;
};

const CURRENCIES = ["GBP", "SAR"];

function CurrencyIcon({ currency }: { currency: string }) {
  if (currency === "GBP") return <PoundSterling size={18} />;
  return <span className="text-base font-bold leading-none">﷼</span>;
}

export default function RevenueCards({ thisMonth, total }: Props) {
  return (
    <>
      {CURRENCIES.map((cur) => (
        <div key={`month-${cur}`} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-green-600 mb-2"><CurrencyIcon currency={cur} /></div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(thisMonth[cur] ?? 0, cur)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">This Month · {cur}</div>
        </div>
      ))}
      {CURRENCIES.map((cur) => (
        <div key={`total-${cur}`} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-emerald-600 mb-2"><CurrencyIcon currency={cur} /></div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(total[cur] ?? 0, cur)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Total Revenue · {cur}</div>
        </div>
      ))}
    </>
  );
}
