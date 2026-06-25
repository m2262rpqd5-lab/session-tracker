import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = await req.json();
  const pkg = await prisma.clientPackage.update({
    where: { id },
    data: { status },
  });
  return Response.json(pkg);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.clientPackage.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
