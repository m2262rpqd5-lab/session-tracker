import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = await prisma.pendingCalendarEvent.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  return Response.json(event);
}
