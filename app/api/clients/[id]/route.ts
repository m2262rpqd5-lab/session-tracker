import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  if (!client) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(client);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, email, phone, notes, isArchived, currency } = body;
  const client = await prisma.client.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(notes !== undefined && { notes }),
      ...(currency !== undefined && { currency }),
      ...(isArchived !== undefined && {
        isArchived,
        archivedAt: isArchived ? new Date() : null,
      }),
    },
  });
  return Response.json(client);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Manually delete children in order to handle DBs without cascade support
  const packages = await prisma.clientPackage.findMany({ where: { clientId: id }, select: { id: true } });
  const pkgIds = packages.map((p) => p.id);

  await prisma.$transaction([
    prisma.pendingCalendarEvent.deleteMany({ where: { suggestedClientId: id } }),
    prisma.session.deleteMany({ where: { clientPackageId: { in: pkgIds } } }),
    prisma.payment.deleteMany({ where: { clientPackageId: { in: pkgIds } } }),
    prisma.adjustment.deleteMany({ where: { clientPackageId: { in: pkgIds } } }),
    prisma.clientPackage.deleteMany({ where: { clientId: id } }),
    prisma.client.delete({ where: { id } }),
  ]);

  return new Response(null, { status: 204 });
}
