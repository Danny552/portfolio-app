"use server";

// TODO (before real data): require an authenticated admin here.
import { prisma } from "@/lib/prisma";
import { readWorkbook } from "@/lib/import/read";
import { validateImport } from "@/lib/import/validate";
import { buildPreview, compareWithDatabase } from "@/lib/import/compare";
import type { ExistingClient, PreviewResult } from "@/lib/import/compare";

const MAX_BYTES = 10 * 1024 * 1024;

// Reads and checks the file and compares it with the database. Writes nothing.
export async function previewImport(
  _previous: PreviewResult | null,
  formData: FormData
): Promise<PreviewResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Seleccione un archivo .xlsx." };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, error: "El archivo debe estar en formato .xlsx (Excel)." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "El archivo supera los 10 MB." };
  }

  try {
    const raw = await readWorkbook(Buffer.from(await file.arrayBuffer()));

    const activities = await prisma.economicActivity.findMany({ select: { code: true } });
    const plan = validateImport(raw, { validCiiu: new Set(activities.map((a) => a.code)) });

    // Which of these documents already exist? (archived clients included: the unique key covers them)
    const numbers = [...new Set(plan.clients.map((c) => c.documentNumber))];
    const rows =
      numbers.length === 0
        ? []
        : await prisma.client.findMany({
            where: { documentNumber: { in: numbers } },
            include: {
              economicActivity: { select: { code: true } },
              _count: {
                select: {
                  incomes: { where: { deletedAt: null } },
                  assets: { where: { deletedAt: null } },
                  expenses: { where: { deletedAt: null } },
                  creditAccounts: true,
                },
              },
            },
          });

    const existing: ExistingClient[] = rows.map((r) => ({
      id: r.id,
      documentType: r.documentType,
      documentNumber: r.documentNumber,
      deletedAt: r.deletedAt,
      fullName: r.fullName,
      birthDate: r.birthDate,
      profession: r.profession,
      occupationType: r.occupationType,
      jobTitle: r.jobTitle,
      economicActivityCode: r.economicActivity?.code ?? null,
      yearsExperience: r.yearsExperience,
      maritalStatus: r.maritalStatus,
      dependents: r.dependents,
      email: r.email,
      phone: r.phone,
      counts: {
        incomes: r._count.incomes,
        assets: r._count.assets,
        expenses: r._count.expenses,
        creditAccounts: r._count.creditAccounts,
      },
    }));

    return buildPreview(plan, compareWithDatabase(plan.clients, existing), file.name);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo procesar el archivo." };
  }
}
