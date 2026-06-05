export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { packages: { where: { status: "ACTIVE" }, take: 1 } },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
        <Link href="/clients/new" className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700">
          + New Client
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          No clients yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <div className="font-medium text-gray-900">{c.name}</div>
                {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
              </div>
              <div className="text-sm text-gray-500">
                {c.packages.length > 0 ? "Active package" : <span className="italic text-gray-300">No package</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
