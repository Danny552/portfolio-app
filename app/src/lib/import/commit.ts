// Writes a validated import to the database, all or nothing (one transaction).
// Every row it creates carries the ID of the ImportBatch, so a batch can be traced and undone later.
import { prisma } from "@/lib/prisma";
import type { ClientAction } from "./compare";

export type PortfolioChoice =
  | { mode: "existing"; portfolioId: number }
  | {
      mode: "new";
      name: string;
      origin: "ORIGINAL" | "PURCHASED" | "INHERITED";
      source?: string;
      acquiredAt?: Date;
    };

export type CommitResult =
  | {
      ok: true;
      batchId: number;
      portfolioName: string;
      created: number;
      updated: number;
      unchanged: number;
      skippedBlocked: number;
      incomes: number;
      assets: number;
      expenses: number;
      creditAccounts: number;
    }
  | { ok: false; error: string };

// Makes values safe for a JSON column (dates become text)
const json = (v: unknown) => JSON.parse(JSON.stringify(v));

export async function commitImport(args: {
  actions: ClientAction[];
  portfolio: PortfolioChoice;
  fileName: string;
}): Promise<CommitResult> {
  const { actions, portfolio, fileName } = args;

  // TODO: replace with the logged-in admin once authentication exists.
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) return { ok: false, error: "No hay un usuario administrador en la base de datos. Ejecute el seed." };

  const isNoop = (a: ClientAction) =>
    a.kind === "update" && Object.keys(a.patch).length === 0 && a.added.length === 0;
  const work = actions.filter((a) => a.kind === "create" || (a.kind === "update" && !isNoop(a)));
  const unchanged = actions.filter((a) => a.kind === "update" && isNoop(a)).length;
  const skippedBlocked = actions.filter((a) => a.kind === "archived").length;

  if (work.length === 0) {
    return { ok: false, error: "No hay nada que importar: no hay clientes nuevos ni datos por completar." };
  }

  const activities = await prisma.economicActivity.findMany({ select: { id: true, code: true } });
  const activityId = new Map(activities.map((a) => [a.code, a.id]));

  try {
    return await prisma.$transaction(
      async (tx) => {
        // 1. Destination portfolio
        const target =
          portfolio.mode === "existing"
            ? await tx.portfolio.findUnique({ where: { id: portfolio.portfolioId }, select: { id: true, name: true } })
            : await tx.portfolio.create({
                data: {
                  name: portfolio.name,
                  origin: portfolio.origin,
                  source: portfolio.source,
                  acquiredAt: portfolio.acquiredAt,
                },
                select: { id: true, name: true },
              });
        if (!target) throw new Error("La cartera seleccionada no existe.");

        // 2. The batch record
        const batch = await tx.importBatch.create({
          data: { filename: fileName, uploadedById: admin.id, portfolioId: target.id, status: "COMPLETED" },
        });
        const batchId = batch.id;

        const totals = { created: 0, updated: 0, incomes: 0, assets: 0, expenses: 0, creditAccounts: 0 };
        const audit: {
          userId: number; action: string; entity: string; entityId: string; before?: unknown; after?: unknown;
        }[] = [];

        // 3. Clients, one by one, with their rows
        for (const a of work) {
          if (a.kind === "create") {
            const c = a.client;
            const created = await tx.client.create({
              data: {
                portfolioId: target.id,
                importBatchId: batchId,
                documentType: c.documentType,
                documentNumber: c.documentNumber,
                fullName: c.fullName,
                birthDate: c.birthDate,
                profession: c.profession,
                occupationType: c.occupationType,
                jobTitle: c.jobTitle,
                economicActivityId: c.ciiuCode ? activityId.get(c.ciiuCode) : undefined,
                yearsExperience: c.yearsExperience,
                maritalStatus: c.maritalStatus,
                dependents: c.dependents,
                email: c.email,
                phone: c.phone,
                incomes: {
                  create: c.incomes.map((i) => ({
                    type: i.type, description: i.description, monthlyAmount: i.monthlyAmount,
                    source: "IMPORT" as const, importBatchId: batchId,
                  })),
                },
                assets: {
                  create: c.assets.map((x) => ({
                    category: x.category, description: x.description, value: x.value, asOfDate: x.asOfDate,
                    source: "IMPORT" as const, importBatchId: batchId,
                  })),
                },
                expenses: {
                  create: c.expenses.map((x) => ({
                    category: x.category, monthlyAmount: x.monthlyAmount,
                    source: "IMPORT" as const, importBatchId: batchId,
                  })),
                },
                creditAccounts: {
                  create: c.creditAccounts.map((x) => ({
                    entity: x.entity, accountType: x.accountType, creditLimit: x.creditLimit, balance: x.balance,
                    monthlyPayment: x.monthlyPayment, status: x.status, reportDate: x.reportDate,
                    source: "IMPORT" as const, importBatchId: batchId,
                  })),
                },
              },
              select: { id: true },
            });
            totals.created++;
            totals.incomes += c.incomes.length;
            totals.assets += c.assets.length;
            totals.expenses += c.expenses.length;
            totals.creditAccounts += c.creditAccounts.length;
            audit.push({
              userId: admin.id, action: "IMPORT_CREATE", entity: "Client", entityId: created.id,
              after: {
                batchId, document: `${c.documentType} ${c.documentNumber}`, fullName: c.fullName,
                incomes: c.incomes.length, assets: c.assets.length, expenses: c.expenses.length,
                creditAccounts: c.creditAccounts.length,
              },
            });
          } else if (a.kind === "update") {
            const c = a.client;
            const { economicActivityCode, ...fields } = a.patch;
            const added = (key: string) => a.added.some((s) => s.key === key);

            await tx.client.update({
              where: { id: a.existingId },
              data: {
                ...fields, // only fields that are empty today
                ...(economicActivityCode ? { economicActivityId: activityId.get(economicActivityCode) } : {}),
                ...(added("incomes") && {
                  incomes: {
                    create: c.incomes.map((i) => ({
                      type: i.type, description: i.description, monthlyAmount: i.monthlyAmount,
                      source: "IMPORT" as const, importBatchId: batchId,
                    })),
                  },
                }),
                ...(added("assets") && {
                  assets: {
                    create: c.assets.map((x) => ({
                      category: x.category, description: x.description, value: x.value, asOfDate: x.asOfDate,
                      source: "IMPORT" as const, importBatchId: batchId,
                    })),
                  },
                }),
                ...(added("expenses") && {
                  expenses: {
                    create: c.expenses.map((x) => ({
                      category: x.category, monthlyAmount: x.monthlyAmount,
                      source: "IMPORT" as const, importBatchId: batchId,
                    })),
                  },
                }),
                ...(added("creditAccounts") && {
                  creditAccounts: {
                    create: c.creditAccounts.map((x) => ({
                      entity: x.entity, accountType: x.accountType, creditLimit: x.creditLimit, balance: x.balance,
                      monthlyPayment: x.monthlyPayment, status: x.status, reportDate: x.reportDate,
                      source: "IMPORT" as const, importBatchId: batchId,
                    })),
                  },
                }),
              },
            });
            totals.updated++;
            if (added("incomes")) totals.incomes += c.incomes.length;
            if (added("assets")) totals.assets += c.assets.length;
            if (added("expenses")) totals.expenses += c.expenses.length;
            if (added("creditAccounts")) totals.creditAccounts += c.creditAccounts.length;

            // before = what was empty, after = what the import filled in
            const before = Object.fromEntries(Object.keys(a.patch).map((k) => [k, null]));
            audit.push({
              userId: admin.id, action: "IMPORT_UPDATE", entity: "Client", entityId: a.existingId,
              before: json(before),
              after: json({ ...a.patch, batchId, sectionsAdded: a.added.map((s) => s.key) }),
            });
          }
        }

        // 4. Audit trail and batch summary
        await tx.auditLog.createMany({
          data: audit.map((e) => ({
            userId: e.userId, action: e.action, entity: e.entity, entityId: e.entityId,
            before: e.before === undefined ? undefined : json(e.before),
            after: e.after === undefined ? undefined : json(e.after),
          })),
        });
        await tx.importBatch.update({
          where: { id: batchId },
          data: {
            rowCount: totals.created + totals.updated,
            summary: json({ ...totals, unchanged, skippedBlocked }),
          },
        });

        return {
          ok: true as const,
          batchId,
          portfolioName: target.name,
          created: totals.created,
          updated: totals.updated,
          unchanged,
          skippedBlocked,
          incomes: totals.incomes,
          assets: totals.assets,
          expenses: totals.expenses,
          creditAccounts: totals.creditAccounts,
        };
      },
      { timeout: 120_000, maxWait: 10_000 } // the default 5 s is too short for big files
    );
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") {
      return { ok: false, error: "Otro proceso creó uno de estos clientes mientras tanto. No se guardó nada; revise el archivo de nuevo." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar la importación." };
  }
}
