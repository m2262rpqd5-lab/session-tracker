import { prisma } from "@/lib/db";
import { computeRemaining, computeTotalPaid } from "@/lib/package-utils";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      packages: {
        orderBy: { createdAt: "desc" },
        include: {
          payments: true,
          adjustments: true,
          sessions: { orderBy: { sessionDate: "desc" }, take: 5 },
          template: true,
        },
      },
    },
  });

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Revenue this month
  const paymentsThisMonth = await prisma.payment.findMany({
    where: { paymentDate: { gte: monthStart, lte: monthEnd } },
  });
  const revenueThisMonth = paymentsThisMonth.reduce((s, p) => s + p.amount, 0);

  // Total revenue all time
  const allPayments = await prisma.payment.findMany();
  const totalRevenue = allPayments.reduce((s, p) => s + p.amount, 0);

  // Pending calendar events count
  const pendingCount = await prisma.pendingCalendarEvent.count({
    where: { status: "PENDING" },
  });

  const clientSummaries = clients.map((client) => {
    const activePackage = client.packages.find((p) => p.status === "ACTIVE") ?? client.packages[0] ?? null;
    const allPaid = client.packages.reduce((sum, p) => sum + computeTotalPaid(p), 0);

    return {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      activePackage: activePackage
        ? {
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
          }
        : null,
      totalPaidAllTime: allPaid,
    };
  });

  return Response.json({
    clients: clientSummaries,
    revenueThisMonth,
    totalRevenue,
    activeClientCount: clients.filter((c) => c.packages.some((p) => p.status === "ACTIVE")).length,
    pendingCalendarEvents: pendingCount,
  });
}
