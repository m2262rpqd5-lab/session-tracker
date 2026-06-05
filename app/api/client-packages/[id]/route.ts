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
