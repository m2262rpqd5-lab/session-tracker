export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Archive } from "lucide-react";
import DeleteClientButton from "./DeleteClientButton";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; type?: string }>;
}) {
  const { archived, type } = await searchParams;
  const showArchived = archived === "1";
  const clientType = type === "LYO" ? "LYO" : "PRIVATE";

  const clients = await prisma.client.findMany({
    where: { isArchived: showArchived, clientType },
    orderBy: { name: "asc" },
    include: { packages: { where: { status: "ACTIVE" }, take: 1 } },
  });

  const archivedCount = await prisma.client.count({ where: { isArchived: true, clientType } });
  const lyoCount = await prisma.client.count({ where: { isArchived: false, clientType: "LYO" } });
  const privateCount = await prisma.client.count({ where: { isArchived: false, clientType: "PRIVATE" } });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          {showArchived ? `Archived ${clientType === "LYO" ? "LYO" : "Private"} Clients` : "Clients"}
        </h1>
        <div className="flex gap-2">
          {!showArchived && archivedCount > 0 && (
            <Link
              href={`/clients?archived=1&type=${clientType}`}
              className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              <Archive size={13} /> {archivedCount} archived
            </Link>
          )}
          {showArchived && (
            <Link
              href={`/clients?type=${clientType}`}
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

      {/* LYO / Private toggle */}
      {!showArchived && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <Link
            href="/clients?type=PRIVATE"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              clientType === "PRIVATE" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Private
            {privateCount > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${clientType === "PRIVATE" ? "bg-gray-100 text-gray-600" : "bg-gray-200 text-gray-500"}`}>
                {privateCount}
              </span>
            )}
          </Link>
          <Link
            href="/clients?type=LYO"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              clientType === "LYO" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            LYO
            {lyoCount > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${clientType === "LYO" ? "bg-gray-100 text-gray-600" : "bg-gray-200 text-gray-500"}`}>
                {lyoCount}
              </span>
            )}
          </Link>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          {showArchived ? `No archived ${clientType === "LYO" ? "LYO" : "private"} clients.` : `No ${clientType === "LYO" ? "LYO" : "private"} clients yet.`}
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
              <div className="flex items-center gap-3">
                {showArchived
                  ? <DeleteClientButton clientId={c.id} clientName={c.name} />
                  : <span className="text-sm text-gray-500">{c.packages.length > 0 ? "Active package" : <span className="italic text-gray-300">No package</span>}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
