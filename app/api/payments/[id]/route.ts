import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const exists = await prisma.payment.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return Response.json({ error: "Not found" }, { status: 404 });
  await prisma.payment.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
