import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, sessionCount, price, validityDays, isActive } = body;
  const template = await prisma.packageTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(sessionCount !== undefined && { sessionCount: Number(sessionCount) }),
      ...(price !== undefined && { price: Number(price) }),
      ...(validityDays !== undefined && { validityDays: validityDays ? Number(validityDays) : null }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  return Response.json(template);
}
