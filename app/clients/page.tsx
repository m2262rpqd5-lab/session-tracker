export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Archive } from "lucide-react";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  const clients = await prisma.client.findMany({
    where: { isArchived: showArchived },
    orderBy: { name: "asc" },
    include: { packages: { where: { status: "ACTIVE" }, take: 1 } },
  });

  const archivedCount = await prisma.client.count({ where: { isArchived: true } });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          {showArchived ? "Archived Clients" : "Clients"}
        </h1>
        <div className="flex gap-2">
          {!showArchived && archivedCount > 0 && (
            <Link
              href="/clients?archived=1"
              className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              <Archive size={13} /> {archivedCount} archived
            </Link>
          )}
          {showArchived && (
            <Link
              href="/clients"
              className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              ← Active clients
            </Link>
          )}
          <Link href="/clients/new" className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700">
            + New Client
          </Link>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          {showArchived ? "No archived clients." : "No clients yet."}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {showArchived && <Archive size={13} className="text-gray-300 shrink-0" />}
                <div>
                  <div className={`font-medium ${showArchived ? "text-gray-400" : "text-gray-900"}`}>
                    {c.name}
                  </div>
                  {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {showArchived
                  ? <span className="italic text-gray-300">Archived</span>
                  : c.packages.length > 0 ? "Active package" : <span className="italic text-gray-300">No package</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
