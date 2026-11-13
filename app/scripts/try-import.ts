// Usage (from the app folder):  npx tsx scripts/try-import.ts path/to/file.xlsx
// Reads the file, validates it and prints what WOULD be imported. Writes nothing.
import { readFileSync } from "fs";
import path from "path";
import { readWorkbook } from "../src/lib/import/read";
import { validateImport } from "../src/lib/import/validate";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Uso: npx tsx scripts/try-import.ts ruta/al/archivo.xlsx");
    process.exit(1);
  }

  const ciiu = JSON.parse(
    readFileSync(path.join(process.cwd(), "prisma", "data", "ciiu-rev4-ac.json"), "utf-8")
  ) as { code: string }[];

  const raw = await readWorkbook(readFileSync(file));
  const plan = validateImport(raw, { validCiiu: new Set(ciiu.map((c) => c.code)) });
  const s = plan.stats;

  console.log("\n=== RESUMEN ===");
  console.log(`Clientes en el archivo: ${s.clientRows}  ->  ${s.clientsOk} se importarían, ${s.clientsBlocked} bloqueados`);
  if (s.exampleRowsSkipped) console.log(`(se omitieron ${s.exampleRowsSkipped} fila(s) de ejemplo)`);
  console.log(`Ingresos: ${s.incomes} · Activos: ${s.assets} · Gastos: ${s.expenses} · Cuentas de crédito: ${s.creditAccounts}`);
  console.log(`Filas de otras hojas bloqueadas: ${s.childRowsBlocked}`);

  const errors = plan.problems.filter((p) => p.severity === "error");
  const warnings = plan.problems.filter((p) => p.severity === "warning");
  const show = (p: (typeof plan.problems)[number]) =>
    `  ${p.sheet}${p.row ? ` fila ${p.row}` : ""}${p.column ? ` · ${p.column}` : ""}: ${p.message}`;

  console.log(`\n=== ERRORES (${errors.length}) — bloquean la fila ===`);
  errors.forEach((p) => console.log(show(p)));
  console.log(`\n=== AVISOS (${warnings.length}) — se importa dejando el campo vacío ===`);
  warnings.forEach((p) => console.log(show(p)));

  console.log("\n=== DATOS QUE FALTAN (clientes que se importarían) ===");
  Object.entries(plan.gapCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([field, n]) => console.log(`  ${field}: ${n}`));

  console.log("\n=== CLIENTES ===");
  for (const c of plan.clients) {
    console.log(`  ${c.documentType} ${c.documentNumber}  ${c.fullName}  (faltan ${c.missing.length}: ${c.missing.join(", ") || "—"})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
