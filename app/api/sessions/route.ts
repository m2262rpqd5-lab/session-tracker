import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { computeRemaining } from "@/lib/package-utils";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientPackageId, sessionDate, notes } = body;

  if (!clientPackageId) {
    return Response.json({ error: "clientPackageId required" }, { status: 400 });
  }

  const pkg = await prisma.clientPackage.findUnique({
    where: { id: clientPackageId },
    include: { payments: true, adjustments: true },
  });
  if (!pkg) return Response.json({ error: "Package not found" }, { status: 404 });
  if (pkg.status === "CANCELLED") {
    return Response.json({ error: "Package is cancelled" }, { status: 400 });
  }
  if (computeRemaining(pkg) <= 0) {
    return Response.json({ error: "No sessions remaining" }, { status: 400 });
  }

  const [session] = await prisma.$transaction([
    prisma.session.create({
      data: {
        clientPackageId,
        sessionDate: sessionDate ? new Date(sessionDate) : new Date(),
        notes,
        source: "MANUAL",
      },
    }),
    prisma.clientPackage.update({
      where: { id: clientPackageId },
      data: { usedSessions: { increment: 1 } },
    }),
  ]);

  return Response.json(session, { status: 201 });
}
