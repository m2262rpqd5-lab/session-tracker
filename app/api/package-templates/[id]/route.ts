import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const inUse = await prisma.clientPackage.findFirst({ where: { templateId: id } });
  if (inUse) {
    return Response.json({ error: "Template is in use by one or more client packages" }, { status: 409 });
  }
  await prisma.packageTemplate.delete({ where: { id } });
  return new Response(null, { status: 204 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, sessionCount, price, currency, validityDays, isActive } = body;
  const template = await prisma.packageTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(sessionCount !== undefined && { sessionCount: Number(sessionCount) }),
      ...(price !== undefined && { price: Number(price) }),
      ...(currency !== undefined && { currency }),
      ...(validityDays !== undefined && { validityDays: validityDays ? Number(validityDays) : null }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  return Response.json(template);
}
