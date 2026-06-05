import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      packages: {
        orderBy: { createdAt: "desc" },
        include: {
          sessions: { orderBy: { sessionDate: "desc" } },
          payments: { orderBy: { paymentDate: "desc" } },
          adjustments: { orderBy: { adjustedAt: "desc" } },
          template: true,
        },
      },
    },
  });
  if (!client) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(client);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, email, phone, notes } = body;
  const client = await prisma.client.update({
    where: { id },
    data: { name, email, phone, notes },
  });
  return Response.json(client);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.client.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
