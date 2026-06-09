"use client";
import { useState } from "react";
import { PoundSterling } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

type Props = {
  thisMonth: Record<string, number>;
  total: Record<string, number>;
};

function CurrencyIcon({ currency }: { currency: string }) {
  if (currency === "GBP") return <PoundSterling size={18} />;
  return <span className="text-base font-bold leading-none">﷼</span>;
}

export default function RevenueCards({ thisMonth, total }: Props) {
  const currencies = Array.from(new Set([...Object.keys(thisMonth), ...Object.keys(total)]));
  const available = currencies.length > 0 ? currencies : ["GBP"];
  const [selected, setSelected] = useState(available[0]);

  return (
    <>
      {/* Currency toggle — only show if more than one currency */}
      {available.length > 1 && (
        <div className="col-span-2 flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {available.map((cur) => (
            <button
              key={cur}
              onClick={() => setSelected(cur)}
              className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${
                selected === cur ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {cur === "GBP" ? "£ GBP" : "﷼ SAR"}
            </button>
          ))}
        </div>
      )}

      {/* This Month card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-green-600 mb-2"><CurrencyIcon currency={selected} /></div>
        <div className="text-2xl font-bold text-gray-900">
          {formatCurrency(thisMonth[selected] ?? 0, selected)}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">This Month · {selected}</div>
      </div>

      {/* Total Revenue card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-emerald-600 mb-2"><CurrencyIcon currency={selected} /></div>
        <div className="text-2xl font-bold text-gray-900">
          {formatCurrency(total[selected] ?? 0, selected)}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">Total Revenue · {selected}</div>
      </div>
    </>
  );
}
