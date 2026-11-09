import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Always read fresh data from the database
export const dynamic = "force-dynamic";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// Prisma returns money as Decimal objects, so convert before adding
const sum = (values: unknown[]) =>
  values.reduce<number>((total, v) => total + Number(v), 0);

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ portfolio?: string }>;
}) {
  const { portfolio } = await searchParams;
  const portfolioId = Number(portfolio) || undefined;

  const [portfolios, clients] = await Promise.all([
    prisma.portfolio.findMany({ orderBy: { id: "asc" } }),
    prisma.client.findMany({
      where: { deletedAt: null, ...(portfolioId ? { portfolioId } : {}) },
      include: {
        portfolio: true,
        incomes: { where: { deletedAt: null } },
        assets: { where: { deletedAt: null } },
        creditAccounts: true,
      },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const tabClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${
      active
        ? "border-foreground bg-foreground text-background"
        : "border-neutral-400 hover:border-foreground"
    }`;

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-semibold">Clientes</h1>
      <p className="mt-1 text-sm opacity-70">
        {clients.length} clientes · datos de demostración
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/admin/clients" className={tabClass(!portfolioId)}>
          Todas las carteras
        </Link>
        {portfolios.map((p) => (
          <Link
            key={p.id}
            href={`/admin/clients?portfolio=${p.id}`}
            className={tabClass(portfolioId === p.id)}
          >
            {p.name}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-400 text-left">
              <th className="p-2">Nombre</th>
              <th className="p-2">Documento</th>
              <th className="p-2">Cartera</th>
              <th className="p-2 text-right">Ingresos / mes</th>
              <th className="p-2 text-right">Patrimonio neto</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const income = sum(c.incomes.map((i) => i.monthlyAmount));
              const assets = sum(c.assets.map((a) => a.value));
              const debts = sum(c.creditAccounts.map((d) => d.balance));
              return (
                <tr key={c.id} className="border-b border-neutral-300/40">
                  <td className="p-2">{c.fullName}</td>
                  <td className="p-2">
                    {c.documentType} {c.documentNumber}
                  </td>
                  <td className="p-2">{c.portfolio.name}</td>
                  <td className="p-2 text-right">{cop.format(income)}</td>
                  <td className="p-2 text-right">{cop.format(assets - debts)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}