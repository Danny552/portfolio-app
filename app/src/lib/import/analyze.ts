// Server-side: reads an uploaded file, validates it and compares it with the database.
// Used by BOTH the preview and the confirm step, so what you preview is what gets written.
import { prisma } from "@/lib/prisma";
import { readWorkbook } from "./read";
import { validateImport } from "./validate";
import type { ImportPlan } from "./validate";
import { compareWithDatabase } from "./compare";
import type { ClientAction, ExistingClient } from "./compare";

const MAX_BYTES = 10 * 1024 * 1024;

// Returns an error message, or null if the upload looks fine.
export function fileError(file: unknown): string | null {
  if (!(file instanceof File) || file.size === 0) return "Seleccione un archivo .xlsx.";
  if (!file.name.toLowerCase().endsWith(".xlsx")) return "El archivo debe estar en formato .xlsx (Excel).";
  if (file.size > MAX_BYTES) return "El archivo supera los 10 MB.";
  return null;
}

export async function analyzeFile(file: File): Promise<{ plan: ImportPlan; actions: ClientAction[] }> {
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

  return { plan, actions: compareWithDatabase(plan.clients, existing) };
}
