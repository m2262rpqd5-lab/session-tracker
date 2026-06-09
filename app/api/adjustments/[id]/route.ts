import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const adjustment = await prisma.adjustment.findUnique({ where: { id } });
  if (!adjustment) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.adjustment.delete({ where: { id } }),
    // Reverse the delta that was applied when the adjustment was created
    prisma.clientPackage.update({
      where: { id: adjustment.clientPackageId },
      data: { usedSessions: { decrement: adjustment.delta } },
    }),
  ]);

  return new Response(null, { status: 204 });
}
