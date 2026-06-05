export const dynamic = "force-dynamic";
import Link from "next/link";
import { format } from "date-fns";
import { Users, DollarSign, CalendarCheck, AlertCircle } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import SessionProgress from "@/components/SessionProgress";
import { prisma } from "@/lib/db";
import { computeRemaining, computeTotalPaid } from "@/lib/package-utils";
import { startOfMonth, endOfMonth } from "date-fns";

async function getDashboard() {
  const clients = await prisma.client.findMany({
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
  });
  const revenueThisMonth = paymentsThisMonth.reduce((s, p) => s + p.amount, 0);
  const allPayments = await prisma.payment.findMany();
  const totalRevenue = allPayments.reduce((s, p) => s + p.amount, 0);
  const pendingCalendarEvents = await prisma.pendingCalendarEvent.count({ where: { status: "PENDING" } });

  const clientSummaries = clients.map((client) => {
    const activePackage = client.packages.find((p) => p.status === "ACTIVE") ?? client.packages[0] ?? null;
    const allPaid = client.packages.reduce((sum, p) => sum + computeTotalPaid(p), 0);
    return {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
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
    revenueThisMonth,
    totalRevenue,
    activeClientCount: clients.filter((c) => c.packages.some((p) => p.status === "ACTIVE")).length,
    pendingCalendarEvents,
  };
}

export default async function DashboardPage() {
  const data = await getDashboard();

  const { clients, revenueThisMonth, totalRevenue, activeClientCount, pendingCalendarEvents } = data;

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
        {[
          { label: "Active Clients", value: activeClientCount, icon: Users, color: "text-blue-600" },
          { label: "Revenue This Month", value: `$${revenueThisMonth.toLocaleString()}`, icon: DollarSign, color: "text-green-600" },
          { label: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600" },
          { label: "Pending Sync", value: pendingCalendarEvents, icon: CalendarCheck, color: "text-amber-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`${color} mb-2`}><Icon size={18} /></div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-4">No clients yet.</p>
          <Link href="/clients/new" className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
            Add your first client
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                    <Link href={`/clients/${client.id}`} className="font-medium text-gray-900 hover:text-blue-600">{client.name}</Link>
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
                  <td className="px-5 py-4 text-gray-700">${(client.activePackage?.totalPaid ?? 0).toLocaleString()}</td>
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
      )}
    </div>
  );
}
