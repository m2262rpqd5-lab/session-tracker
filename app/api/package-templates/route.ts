import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const templates = await prisma.packageTemplate.findMany({
    where: { isActive: true },
    orderBy: { sessionCount: "asc" },
  });
  return Response.json(templates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, sessionCount, price, validityDays } = body;
  if (!name || !sessionCount || !price) {
    return Response.json({ error: "name, sessionCount, price required" }, { status: 400 });
  }
  const template = await prisma.packageTemplate.create({
    data: { name, sessionCount: Number(sessionCount), price: Number(price), validityDays: validityDays ? Number(validityDays) : null },
  });
  return Response.json(template, { status: 201 });
}
