import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.session.delete({ where: { id } }),
    prisma.clientPackage.update({
      where: { id: session.clientPackageId },
      data: { usedSessions: { decrement: 1 } },
    }),
  ]);

  return new Response(null, { status: 204 });
}
