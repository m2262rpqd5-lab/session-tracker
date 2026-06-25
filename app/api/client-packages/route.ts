import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { addDays } from "date-fns";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientId, templateId, customName, customSessions, customPrice, startDate } = body;

  if (!clientId) {
    return Response.json({ error: "clientId required" }, { status: 400 });
  }

  let name: string;
  let totalSessions: number;
  let expiryDate: Date | null = null;
  const start = startDate ? new Date(startDate) : new Date();

  if (templateId) {
    const template = await prisma.packageTemplate.findUnique({ where: { id: templateId } });
    if (!template) return Response.json({ error: "Template not found" }, { status: 404 });
    name = template.name;
    totalSessions = template.sessionCount;
    if (template.validityDays) expiryDate = addDays(start, template.validityDays);
  } else {
    if (!customName || !customSessions) {
      return Response.json({ error: "customName and customSessions required for custom package" }, { status: 400 });
    }
    name = customName;
    totalSessions = Number(customSessions);
  }

  // Find the most recent non-cancelled package to carry over any session deficit
  const previousPkg = await prisma.clientPackage.findFirst({
    where: { clientId, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    include: { adjustments: true },
  });

  // Calculate how many sessions were used beyond what the previous package covered
  let carryOver = 0;
  if (previousPkg) {
    const adjustmentTotal = previousPkg.adjustments.reduce((sum, a) => sum + a.delta, 0);
    const remaining = previousPkg.totalSessions - previousPkg.usedSessions + adjustmentTotal;
    if (remaining < 0) {
      carryOver = Math.abs(remaining);
    }
    // Close out the previous package
    await prisma.clientPackage.update({
      where: { id: previousPkg.id },
      data: { status: "EXHAUSTED" },
    });
  }

  const pkg = await prisma.clientPackage.create({
    data: {
      clientId,
      templateId: templateId || null,
      name,
      totalSessions,
      usedSessions: carryOver,
      startDate: start,
      expiryDate,
    },
    include: { client: true, template: true },
  });

  return Response.json(pkg, { status: 201 });
}
