import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientPackageId, amount, method, notes, paymentDate } = body;

  if (!clientPackageId || !amount) {
    return Response.json({ error: "clientPackageId and amount required" }, { status: 400 });
  }

  const payment = await prisma.payment.create({
    data: {
      clientPackageId,
      amount: Number(amount),
      method,
      notes,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
    },
  });

  return Response.json(payment, { status: 201 });
}
