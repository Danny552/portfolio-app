import { prisma } from "@/lib/prisma";
import ImportForm from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const portfolios = await prisma.portfolio.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true } });

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-semibold">Importar clientes</h1>
      <p className="mt-1 mb-6 text-sm opacity-70">
        Suba un archivo Excel con la plantilla. Primero se revisa y se muestra una vista previa; solo se guarda cuando
        usted confirma.
      </p>
      <ImportForm portfolios={portfolios} />
    </main>
  );
}
