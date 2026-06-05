import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientPackageId, delta, reason } = body;

  if (!clientPackageId || delta === undefined || !reason) {
    return Response.json({ error: "clientPackageId, delta, and reason required" }, { status: 400 });
  }

  const adjustment = await prisma.adjustment.create({
    data: {
      clientPackageId,
      delta: Number(delta),
      reason,
    },
  });

  return Response.json(adjustment, { status: 201 });
}
