import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status, name, totalSessions, usedSessions } = await req.json();

  if (totalSessions !== undefined && (isNaN(Number(totalSessions)) || Number(totalSessions) < 0)) {
    return Response.json({ error: "Total sessions must be 0 or more" }, { status: 400 });
  }
  if (usedSessions !== undefined && (isNaN(Number(usedSessions)) || Number(usedSessions) < 0)) {
    return Response.json({ error: "Used sessions must be 0 or more" }, { status: 400 });
  }

  const pkg = await prisma.clientPackage.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(name !== undefined && { name }),
      ...(totalSessions !== undefined && { totalSessions: Number(totalSessions) }),
      ...(usedSessions !== undefined && { usedSessions: Number(usedSessions) }),
    },
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
