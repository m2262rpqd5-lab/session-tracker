export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { computeRemaining, computeTotalPaid } from "@/lib/package-utils";
import { formatCurrency } from "@/lib/currency";
import StatusBadge from "@/components/StatusBadge";
import SessionProgress from "@/components/SessionProgress";
import ClientActions from "./ClientActions";
import SessionDeleteButton from "./SessionDeleteButton";
import PaymentDeleteButton from "./PaymentDeleteButton";
import AdjustmentDeleteButton from "./AdjustmentDeleteButton";
import PackageDeleteButton from "./PackageDeleteButton";
import PackageEditButton from "./PackageEditButton";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      packages: {
        orderBy: { createdAt: "desc" },
        include: {
          sessions: { orderBy: { sessionDate: "desc" } },
          payments: { orderBy: { paymentDate: "desc" } },
          adjustments: { orderBy: { adjustedAt: "desc" } },
          template: true,
        },
      },
    },
  });
  if (!client) notFound();

  const templates = await prisma.packageTemplate.findMany({
    where: { isActive: true },
    orderBy: { sessionCount: "asc" },
  });

  const activePackage = client.packages.find((p) => p.status === "ACTIVE");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">{client.name}</h1>
          </div>
          <div className="text-sm text-gray-400 mt-0.5 space-x-3">
            {client.email && <span>{client.email}</span>}
            {client.phone && <span>{client.phone}</span>}
          </div>
        </div>
        <ClientActions
          client={{ id: client.id, name: client.name, isArchived: client.isArchived, currency: client.currency }}
          templates={templates}
          activePackage={activePackage ?? null}
        />
      </div>

      {/* Active Package Card */}
      {activePackage ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">{activePackage.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Started {format(new Date(activePackage.startDate), "MMM d, yyyy")}
                {activePackage.expiryDate && (
                  <> · Expires {format(new Date(activePackage.expiryDate), "MMM d, yyyy")}</>
                )}
              </div>
            </div>
            <StatusBadge status={activePackage.status} />
          </div>
          <SessionProgress
            used={activePackage.usedSessions}
            total={activePackage.totalSessions}
            remaining={computeRemaining(activePackage)}
          />
          <div className="grid grid-cols-3 gap-4 pt-1">
            <div>
              <div className="text-xs text-gray-400">Total Sessions</div>
              <div className="font-semibold text-gray-900">{activePackage.totalSessions}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Sessions Used</div>
              <div className="font-semibold text-gray-900">{activePackage.usedSessions}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Total Paid</div>
              <div className="font-semibold text-gray-900">{formatCurrency(computeTotalPaid(activePackage), client.currency)}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          No active package — assign one using the button above.
        </div>
      )}

      {/* Session History */}
      {client.packages.map((pkg) => (
        <div key={pkg.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{pkg.name}</span>
            <div className="flex items-center gap-3">
              <StatusBadge status={pkg.status} />
              <PackageEditButton
                packageId={pkg.id}
                name={pkg.name}
                totalSessions={pkg.totalSessions}
                usedSessions={pkg.usedSessions}
              />
              <PackageDeleteButton packageId={pkg.id} />
            </div>
          </div>

          {pkg.sessions.length === 0 && pkg.payments.length === 0 ? (
            <div className="px-5 py-6 text-sm text-gray-400 italic">No activity yet.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {/* Payments */}
              {pkg.payments.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-700 font-medium">Payment</span>
                      {p.method && <span className="text-gray-400 text-xs">· {p.method}</span>}
                      {p.notes && <span className="text-gray-400 text-xs truncate max-w-[120px]">· {p.notes}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{format(new Date(p.paymentDate), "MMM d, yyyy")}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <span className="text-green-600 font-medium">+{formatCurrency(p.amount, client.currency)}</span>
                    <PaymentDeleteButton paymentId={p.id} />
                  </div>
                </div>
              ))}
              {/* Sessions */}
              {pkg.sessions.map((s) => (
                <div key={s.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-700 font-medium">Session</span>
                      <span className="text-xs text-gray-400">{s.source === "CALENDAR_SYNC" ? "· calendar" : "· manual"}</span>
                      {s.notes && <span className="text-gray-400 text-xs truncate max-w-[120px]">· {s.notes}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{format(new Date(s.sessionDate), "MMM d, yyyy")}</div>
                  </div>
                  <div className="shrink-0">
                    <SessionDeleteButton sessionId={s.id} />
                  </div>
                </div>
              ))}
              {/* Adjustments */}
              {pkg.adjustments.map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                  <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-700 font-medium">Adjustment</span>
                      <span className="text-gray-400 text-xs truncate max-w-[140px]">· {a.reason}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{format(new Date(a.adjustedAt), "MMM d, yyyy")}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <span className={`font-medium ${a.delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {a.delta >= 0 ? "+" : ""}{a.delta} session{Math.abs(a.delta) !== 1 ? "s" : ""}
                    </span>
                    <AdjustmentDeleteButton adjustmentId={a.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
