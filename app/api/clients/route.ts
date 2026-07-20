import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      packages: {
        where: { status: "ACTIVE" },
        include: { payments: true, adjustments: true, sessions: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  return Response.json(clients);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, notes, currency } = body;
  if (!name?.trim()) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const client = await prisma.client.create({
    data: { name: name.trim(), email, phone, notes, currency: currency ?? "GBP" },
  });
  return Response.json(client, { status: 201 });
}
