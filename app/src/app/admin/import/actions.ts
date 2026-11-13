"use server";

// TODO (before real data): require an authenticated admin in both actions.
import { revalidatePath } from "next/cache";
import { analyzeFile, fileError } from "@/lib/import/analyze";
import { buildPreview } from "@/lib/import/compare";
import type { PreviewResult } from "@/lib/import/compare";
import { commitImport } from "@/lib/import/commit";
import type { CommitResult, PortfolioChoice } from "@/lib/import/commit";

// Step 1: check the file and show what would happen. Writes nothing.
export async function previewImport(formData: FormData): Promise<PreviewResult> {
  const file = formData.get("file");
  const problem = fileError(file);
  if (problem) return { ok: false, error: problem };

  try {
    const { plan, actions } = await analyzeFile(file as File);
    return buildPreview(plan, actions, (file as File).name);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo procesar el archivo." };
  }
}

// Step 2: the same file again + the destination portfolio. Re-checks everything, then writes.
export async function confirmImport(formData: FormData): Promise<CommitResult> {
  const file = formData.get("file");
  const problem = fileError(file);
  if (problem) return { ok: false, error: problem };

  const mode = String(formData.get("portfolioMode") ?? "");
  let portfolio: PortfolioChoice;
  if (mode === "existing") {
    const id = Number(formData.get("portfolioId"));
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Seleccione una cartera." };
    portfolio = { mode: "existing", portfolioId: id };
  } else if (mode === "new") {
    const name = String(formData.get("newName") ?? "").trim();
    const origin = String(formData.get("newOrigin") ?? "");
    if (!name) return { ok: false, error: "Escriba el nombre de la nueva cartera." };
    if (name.length > 120) return { ok: false, error: "El nombre de la cartera es demasiado largo." };
    if (!["ORIGINAL", "PURCHASED", "INHERITED"].includes(origin)) {
      return { ok: false, error: "Seleccione el origen de la cartera." };
    }
    const date = String(formData.get("newAcquiredAt") ?? "");
    const acquiredAt = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : undefined;
    portfolio = {
      mode: "new",
      name,
      origin: origin as "ORIGINAL" | "PURCHASED" | "INHERITED",
      source: String(formData.get("newSource") ?? "").trim() || undefined,
      acquiredAt,
    };
  } else {
    return { ok: false, error: "Seleccione la cartera de destino." };
  }

  try {
    const { actions } = await analyzeFile(file as File);
    const result = await commitImport({ actions, portfolio, fileName: (file as File).name });
    if (result.ok) revalidatePath("/admin/clients");
    return result;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar la importación." };
  }
}
