export const dynamic = "force-dynamic";
import Link from "next/link";
import { format } from "date-fns";
import { Users, CalendarCheck, AlertCircle } from "lucide-react";
import RevenueCards from "@/components/RevenueCards";
import StatusBadge from "@/components/StatusBadge";
import SessionProgress from "@/components/SessionProgress";
import { prisma } from "@/lib/db";
import { computeRemaining, computeTotalPaid } from "@/lib/package-utils";
import { formatCurrency } from "@/lib/currency";
import { startOfMonth, endOfMonth } from "date-fns";

async function getDashboard() {
  const clients = await prisma.client.findMany({
    where: { isArchived: false },
    orderBy: { name: "asc" },
    include: {
      packages: {
        orderBy: { createdAt: "desc" },
        include: { payments: true, adjustments: true, sessions: { orderBy: { sessionDate: "desc" }, take: 5 }, template: true },
      },
    },
  });

  const now = new Date();
  const paymentsThisMonth = await prisma.payment.findMany({
    where: { paymentDate: { gte: startOfMonth(now), lte: endOfMonth(now) } },
    include: { clientPackage: { include: { client: { select: { currency: true } } } } },
  });
  const allPayments = await prisma.payment.findMany({
    include: { clientPackage: { include: { client: { select: { currency: true } } } } },
  });

  const pendingCalendarEvents = await prisma.pendingCalendarEvent.count({ where: { status: "PENDING" } });

  // Live GBP → SAR exchange rate
  let gbpToSar = 4.73; // fallback
  try {
    const fx = await fetch("https://api.exchangerate-api.com/v4/latest/GBP", { next: { revalidate: 3600 } });
    if (fx.ok) {
      const fxData = await fx.json();
      gbpToSar = fxData.rates?.SAR ?? gbpToSar;
    }
  } catch {}

  // Combined GBP-equivalent totals: GBP payments added directly, SAR payments converted
  function toGbpTotal(payments: typeof allPayments) {
    let total = 0;
    for (const p of payments) {
      const cur = p.clientPackage.client.currency ?? "GBP";
      total += cur === "SAR" ? p.amount / gbpToSar : p.amount;
    }
    return total;
  }
  const revenueThisMonthGbp = toGbpTotal(paymentsThisMonth);
  const totalRevenueGbp = toGbpTotal(allPayments);

  const clientSummaries = clients.map((client) => {
    const activePackage = client.packages.find((p) => p.status === "ACTIVE") ?? client.packages[0] ?? null;
    const allPaid = client.packages.reduce((sum, p) => sum + computeTotalPaid(p), 0);
    return {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      currency: client.currency,
      activePackage: activePackage ? {
        id: activePackage.id,
        name: activePackage.name,
        status: activePackage.status,
        totalSessions: activePackage.totalSessions,
        usedSessions: activePackage.usedSessions,
        remaining: computeRemaining(activePackage),
        totalPaid: computeTotalPaid(activePackage),
        expiryDate: activePackage.expiryDate,
        startDate: activePackage.startDate,
        recentSessions: activePackage.sessions,
      } : null,
      totalPaidAllTime: allPaid,
    };
  });

  return {
    clients: clientSummaries,
    revenueThisMonthGbp,
    totalRevenueGbp,
    gbpToSar,
    activeClientCount: clients.filter((c) => c.packages.some((p) => p.status === "ACTIVE")).length,
    pendingCalendarEvents,
  };
}

export default async function DashboardPage() {
  const data = await getDashboard();

  const { clients, revenueThisMonthGbp, totalRevenueGbp, gbpToSar, activeClientCount, pendingCalendarEvents } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <div className="flex gap-2">
          {pendingCalendarEvents > 0 && (
            <Link href="/calendar" className="flex items-center gap-1.5 text-sm bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
              <AlertCircle size={14} />
              {pendingCalendarEvents} pending sync
            </Link>
          )}
          <Link href="/clients/new" className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700 transition-colors">
            + New Client
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Clients */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-blue-600 mb-2"><Users size={18} /></div>
          <div className="text-2xl font-bold text-gray-900">{activeClientCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Active Clients</div>
        </div>

        {/* Revenue cards — GBP with live SAR conversion */}
        <RevenueCards thisMonth={revenueThisMonthGbp} total={totalRevenueGbp} gbpToSar={gbpToSar} />

        {/* Pending Sync */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-amber-600 mb-2"><CalendarCheck size={18} /></div>
          <div className="text-2xl font-bold text-gray-900">{pendingCalendarEvents}</div>
          <div className="text-xs text-gray-500 mt-0.5">Pending Sync</div>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-4">No clients yet.</p>
          <Link href="/clients/new" className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
            Add your first client
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards — a 6-column table doesn't fit a phone */}
          <div className="md:hidden bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {clients.map((client: any) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="block px-4 py-3.5 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{client.name}</div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">
                      {client.activePackage?.name ?? <span className="italic">No package</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm text-gray-700">
                      {formatCurrency(client.activePackage?.totalPaid ?? 0, client.currency)}
                    </div>
                    {client.activePackage?.expiryDate && (
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Exp {format(new Date(client.activePackage.expiryDate), "MMM d, yyyy")}
                      </div>
                    )}
                  </div>
                </div>
                {client.activePackage && (
                  <div className="mt-2.5">
                    <SessionProgress
                      used={client.activePackage.usedSessions}
                      total={client.activePackage.totalSessions}
                      remaining={client.activePackage.remaining}
                    />
                  </div>
                )}
              </Link>
            ))}
          </div>

          {/* Desktop: full table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Client</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Package</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 w-44">Progress</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Paid</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Expires</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client: any) => (
                  <tr key={client.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/clients/${client.id}`} className="font-medium text-gray-900 hover:text-blue-600">{client.name}</Link>
                      </div>
                      {client.email && <div className="text-xs text-gray-400">{client.email}</div>}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {client.activePackage?.name ?? <span className="text-gray-400 italic">No package</span>}
                    </td>
                    <td className="px-5 py-4 w-44">
                      {client.activePackage ? (
                        <SessionProgress used={client.activePackage.usedSessions} total={client.activePackage.totalSessions} remaining={client.activePackage.remaining} />
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-4 text-gray-700">{formatCurrency(client.activePackage?.totalPaid ?? 0, client.currency)}</td>
                    <td className="px-5 py-4">
                      {client.activePackage ? <StatusBadge status={client.activePackage.status} /> : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {client.activePackage?.expiryDate ? format(new Date(client.activePackage.expiryDate), "MMM d, yyyy") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
