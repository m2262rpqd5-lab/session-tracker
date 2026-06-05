import type { ClientPackage, Payment, Adjustment } from "@/app/generated/prisma";

type PackageWithRelations = ClientPackage & {
  payments: Payment[];
  adjustments: Adjustment[];
};

export function computeRemaining(pkg: PackageWithRelations): number {
  const adjustmentTotal = pkg.adjustments.reduce((sum, a) => sum + a.delta, 0);
  return pkg.totalSessions - pkg.usedSessions + adjustmentTotal;
}

export function computeTotalPaid(pkg: PackageWithRelations): number {
  return pkg.payments.reduce((sum, p) => sum + p.amount, 0);
}

export function resolvePackageStatus(
  pkg: PackageWithRelations
): "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "CANCELLED" {
  if (pkg.status === "CANCELLED") return "CANCELLED";
  if (pkg.expiryDate && new Date(pkg.expiryDate) < new Date()) return "EXPIRED";
  if (computeRemaining(pkg) <= 0) return "EXHAUSTED";
  return "ACTIVE";
}
