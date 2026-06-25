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

  // If there's already an active package, add sessions to it instead of creating a new one
  const existingPkg = await prisma.clientPackage.findFirst({
    where: { clientId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  if (existingPkg) {
    const updated = await prisma.clientPackage.update({
      where: { id: existingPkg.id },
      data: { totalSessions: { increment: totalSessions } },
      include: { client: true, template: true },
    });
    return Response.json(updated, { status: 200 });
  }

  const pkg = await prisma.clientPackage.create({
    data: {
      clientId,
      templateId: templateId || null,
      name,
      totalSessions,
      startDate: start,
      expiryDate,
    },
    include: { client: true, template: true },
  });

  return Response.json(pkg, { status: 201 });
}
