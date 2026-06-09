export type Currency = "GBP" | "SAR";

export const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "GBP", label: "GBP (£)" },
  { value: "SAR", label: "SAR (﷼)" },
];

export function formatCurrency(amount: number, currency: string): string {
  if (currency === "GBP") {
    return `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  if (currency === "SAR") {
    return `SAR ${amount.toLocaleString("en-SA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  return `${amount.toLocaleString()}`;
}
