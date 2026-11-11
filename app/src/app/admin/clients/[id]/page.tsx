import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// timeZone UTC so date-only values don't shift a day back in Colombia (UTC-5)
const date = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" }).format(d)
    : "—";

const sum = (values: unknown[]) =>
  values.reduce<number>((total, v) => total + Number(v), 0);

const OCCUPATION: Record<string, string> = {
  EMPLOYEE: "Empleado",
  SELF_EMPLOYED: "Independiente",
};
const MARITAL: Record<string, string> = {
  SINGLE: "Soltero/a",
  MARRIED: "Casado/a",
  COMMON_LAW: "Unión libre",
  DIVORCED: "Divorciado/a",
  WIDOWED: "Viudo/a",
};
const INCOME_TYPE: Record<string, string> = {
  FIXED: "Fijo",
  ADDITIONAL: "Adicional",
};
const ORIGIN: Record<string, string> = {
  ORIGINAL: "Propia",
  PURCHASED: "Adquirida",
  INHERITED: "Heredada",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-400/50 p-4">
      <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide opacity-60">{label}</dt>
      <dd className="mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      {empty ? (
        <p className="mt-2 text-sm opacity-60">Sin registros.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">{children}</table>
        </div>
      )}
    </section>
  );
}

const th = "p-2 text-left border-b border-neutral-400";
const td = "p-2 border-b border-neutral-300/40";

const status = (verifiedAt: Date | null) =>
  verifiedAt ? "Verificado" : "Declarado";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
    include: {
      portfolio: true,
      economicActivity: true,
      incomes: { where: { deletedAt: null }, orderBy: { id: "asc" } },
      assets: { where: { deletedAt: null }, orderBy: { id: "asc" } },
      expenses: { where: { deletedAt: null }, orderBy: { id: "asc" } },
      creditAccounts: { orderBy: { id: "asc" } },
    },
  });

  if (!client) notFound();

  const income = sum(client.incomes.map((i) => i.monthlyAmount));
  const expenses = sum(client.expenses.map((e) => e.monthlyAmount));
  const assets = sum(client.assets.map((a) => a.value));
  const debts = sum(client.creditAccounts.map((d) => d.balance));

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/admin/clients" className="text-sm underline opacity-70">
        ← Volver a clientes
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">{client.fullName}</h1>
      <p className="mt-1 text-sm opacity-70">
        {client.documentType} {client.documentNumber} · Cartera:{" "}
        {client.portfolio.name} ({ORIGIN[client.portfolio.origin]})
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Ingresos / mes" value={cop.format(income)} />
        <Stat label="Gastos / mes" value={cop.format(expenses)} />
        <Stat label="Flujo mensual" value={cop.format(income - expenses)} />
        <Stat label="Activos" value={cop.format(assets)} />
        <Stat label="Deudas" value={cop.format(debts)} />
        <Stat label="Patrimonio neto" value={cop.format(assets - debts)} />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Perfil</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-3">
          <Field label="Fecha de nacimiento" value={date(client.birthDate)} />
          <Field label="Estado civil" value={client.maritalStatus ? MARITAL[client.maritalStatus] : null} />
          <Field label="Personas a cargo" value={client.dependents} />
          <Field label="Profesión" value={client.profession} />
          <Field label="Ocupación" value={client.occupationType ? OCCUPATION[client.occupationType] : null} />
          <Field label="Años de experiencia" value={client.yearsExperience} />
          {client.occupationType === "EMPLOYEE" && (
            <Field label="Cargo" value={client.jobTitle} />
          )}
          {client.occupationType === "SELF_EMPLOYED" && (
            <Field
              label="Actividad económica (CIIU)"
              value={
                client.economicActivity
                  ? `${client.economicActivity.code} · ${client.economicActivity.description}`
                  : null
              }
            />
          )}
          <Field label="Correo" value={client.email} />
          <Field label="Teléfono" value={client.phone} />
        </dl>
      </section>

      <Section title="Ingresos" empty={client.incomes.length === 0}>
        <thead>
          <tr>
            <th className={th}>Tipo</th>
            <th className={th}>Descripción</th>
            <th className={`${th} text-right`}>Monto mensual</th>
            <th className={th}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {client.incomes.map((i) => (
            <tr key={i.id}>
              <td className={td}>{INCOME_TYPE[i.type]}</td>
              <td className={td}>{i.description ?? "—"}</td>
              <td className={`${td} text-right`}>{cop.format(Number(i.monthlyAmount))}</td>
              <td className={td}>{status(i.verifiedAt)}</td>
            </tr>
          ))}
        </tbody>
      </Section>

      <Section title="Activos" empty={client.assets.length === 0}>
        <thead>
          <tr>
            <th className={th}>Categoría</th>
            <th className={th}>Descripción</th>
            <th className={`${th} text-right`}>Valor</th>
            <th className={th}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {client.assets.map((a) => (
            <tr key={a.id}>
              <td className={td}>{a.category}</td>
              <td className={td}>{a.description ?? "—"}</td>
              <td className={`${td} text-right`}>{cop.format(Number(a.value))}</td>
              <td className={td}>{status(a.verifiedAt)}</td>
            </tr>
          ))}
        </tbody>
      </Section>

      <Section title="Gastos" empty={client.expenses.length === 0}>
        <thead>
          <tr>
            <th className={th}>Categoría</th>
            <th className={`${th} text-right`}>Monto mensual</th>
            <th className={th}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {client.expenses.map((e) => (
            <tr key={e.id}>
              <td className={td}>{e.category}</td>
              <td className={`${td} text-right`}>{cop.format(Number(e.monthlyAmount))}</td>
              <td className={td}>{status(e.verifiedAt)}</td>
            </tr>
          ))}
        </tbody>
      </Section>

      <Section title="Cuentas de crédito (Datacrédito)" empty={client.creditAccounts.length === 0}>
        <thead>
          <tr>
            <th className={th}>Entidad</th>
            <th className={th}>Tipo</th>
            <th className={`${th} text-right`}>Cupo</th>
            <th className={`${th} text-right`}>Saldo</th>
            <th className={th}>Estado</th>
            <th className={th}>Fecha de reporte</th>
          </tr>
        </thead>
        <tbody>
          {client.creditAccounts.map((d) => (
            <tr key={d.id}>
              <td className={td}>{d.entity}</td>
              <td className={td}>{d.accountType}</td>
              <td className={`${td} text-right`}>
                {d.creditLimit ? cop.format(Number(d.creditLimit)) : "—"}
              </td>
              <td className={`${td} text-right`}>{cop.format(Number(d.balance))}</td>
              <td className={td}>{d.status ?? "—"}</td>
              <td className={td}>{date(d.reportDate)}</td>
            </tr>
          ))}
        </tbody>
      </Section>
    </main>
  );
}