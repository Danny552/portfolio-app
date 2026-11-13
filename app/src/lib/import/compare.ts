// Compares a validated import with the clients already in the database.
// Rule: an import only FILLS EMPTY fields of existing clients. It never overwrites a value,
// and it never lets an empty cell erase one. Different non-empty values are reported as conflicts
// and the value already in the system is kept.
// Pure functions: no database and no Excel in here.
import type { ImportPlan, MaritalStatus, OccupationType, ParsedClient, Problem } from "./validate";

export type ExistingClient = {
  id: string;
  documentType: string;
  documentNumber: string;
  deletedAt: Date | null;
  fullName: string;
  birthDate: Date | null;
  profession: string | null;
  occupationType: string | null;
  jobTitle: string | null;
  economicActivityCode: string | null;
  yearsExperience: number | null;
  maritalStatus: string | null;
  dependents: number | null;
  email: string | null;
  phone: string | null;
  counts: { incomes: number; assets: number; expenses: number; creditAccounts: number };
};

export type FieldChange = { field: string; current: string; incoming: string }; // display-ready text
export type SectionKey = "incomes" | "assets" | "expenses" | "creditAccounts";
export type SectionNote = { key: SectionKey; section: string; rows: number; existing?: number };

// The exact values to write into an existing client: only fields that are empty today.
export type ClientPatch = {
  fullName?: string;
  birthDate?: Date;
  profession?: string;
  occupationType?: OccupationType;
  jobTitle?: string;
  economicActivityCode?: string;
  yearsExperience?: number;
  maritalStatus?: MaritalStatus;
  dependents?: number;
  email?: string;
  phone?: string;
};

export type ClientAction =
  | { kind: "create"; client: ParsedClient }
  | {
      kind: "update";
      client: ParsedClient;
      existingId: string;
      fills: FieldChange[];
      patch: ClientPatch;
      conflicts: FieldChange[];
      added: SectionNote[];
      skipped: SectionNote[];
    }
  | { kind: "archived"; client: ParsedClient; existingId: string };

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const digits = (s: string) => s.replace(/\D/g, "");
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

const OCCUPATION_ES: Record<string, string> = { EMPLOYEE: "Empleado", SELF_EMPLOYED: "Independiente" };
const MARITAL_ES: Record<string, string> = {
  SINGLE: "Soltero/a", MARRIED: "Casado/a", COMMON_LAW: "Unión libre", DIVORCED: "Divorciado/a", WIDOWED: "Viudo/a",
};

type FieldSpec = {
  label: string;
  incoming: (c: ParsedClient) => string;
  current: (e: ExistingClient) => string;
  show?: (v: string) => string;
  same?: (a: string, b: string) => boolean;
  apply: (c: ParsedClient, p: ClientPatch) => void; // copies the incoming value into the patch
};

const FIELDS: FieldSpec[] = [
  { label: "Nombre", incoming: (c) => c.fullName, current: (e) => e.fullName, apply: (c, p) => { p.fullName = c.fullName; } },
  { label: "Fecha de nacimiento", incoming: (c) => iso(c.birthDate), current: (e) => iso(e.birthDate), apply: (c, p) => { p.birthDate = c.birthDate; } },
  { label: "Profesión", incoming: (c) => c.profession ?? "", current: (e) => e.profession ?? "", apply: (c, p) => { p.profession = c.profession; } },
  { label: "Ocupación", incoming: (c) => c.occupationType ?? "", current: (e) => e.occupationType ?? "", show: (v) => OCCUPATION_ES[v] ?? v, apply: (c, p) => { p.occupationType = c.occupationType; } },
  { label: "Cargo", incoming: (c) => c.jobTitle ?? "", current: (e) => e.jobTitle ?? "", apply: (c, p) => { p.jobTitle = c.jobTitle; } },
  { label: "Actividad económica (CIIU)", incoming: (c) => c.ciiuCode ?? "", current: (e) => e.economicActivityCode ?? "", apply: (c, p) => { p.economicActivityCode = c.ciiuCode; } },
  { label: "Años de experiencia", incoming: (c) => num(c.yearsExperience), current: (e) => num(e.yearsExperience), apply: (c, p) => { p.yearsExperience = c.yearsExperience; } },
  { label: "Estado civil", incoming: (c) => c.maritalStatus ?? "", current: (e) => e.maritalStatus ?? "", show: (v) => MARITAL_ES[v] ?? v, apply: (c, p) => { p.maritalStatus = c.maritalStatus; } },
  { label: "Personas a cargo", incoming: (c) => num(c.dependents), current: (e) => num(e.dependents), apply: (c, p) => { p.dependents = c.dependents; } },
  { label: "Correo", incoming: (c) => c.email ?? "", current: (e) => e.email ?? "", apply: (c, p) => { p.email = c.email; } },
  // phones are compared by digits only, so "+57 300..." and "+57300..." are the same number
  { label: "Teléfono", incoming: (c) => c.phone ?? "", current: (e) => e.phone ?? "", same: (a, b) => digits(a) === digits(b), apply: (c, p) => { p.phone = c.phone; } },
];

const SECTIONS = [
  { key: "incomes", label: "Ingresos" },
  { key: "assets", label: "Activos" },
  { key: "expenses", label: "Gastos" },
  { key: "creditAccounts", label: "Cuentas de crédito" },
] as const;

export function compareWithDatabase(clients: ParsedClient[], existing: ExistingClient[]): ClientAction[] {
  const byKey = new Map(existing.map((e) => [`${e.documentType}:${e.documentNumber}`, e]));

  return clients.map((client): ClientAction => {
    const e = byKey.get(`${client.documentType}:${client.documentNumber}`);
    if (!e) return { kind: "create", client };
    if (e.deletedAt) return { kind: "archived", client, existingId: e.id };

    const fills: FieldChange[] = [];
    const conflicts: FieldChange[] = [];
    const patch: ClientPatch = {};
    for (const f of FIELDS) {
      const cur = f.current(e);
      const inc = f.incoming(client);
      if (inc === "") continue; // empty in the file: never touches existing data
      const show = f.show ?? ((v: string) => v);
      if (cur === "") {
        fills.push({ field: f.label, current: "", incoming: show(inc) });
        f.apply(client, patch);
      } else if (!(f.same ?? ((a, b) => norm(a) === norm(b)))(cur, inc)) {
        conflicts.push({ field: f.label, current: show(cur), incoming: show(inc) });
      }
    }

    const added: SectionNote[] = [];
    const skipped: SectionNote[] = [];
    for (const s of SECTIONS) {
      const n = client[s.key].length;
      if (n === 0) continue;
      const have = e.counts[s.key];
      if (have === 0) added.push({ key: s.key, section: s.label, rows: n });
      else skipped.push({ key: s.key, section: s.label, rows: n, existing: have });
    }
    return { kind: "update", client, existingId: e.id, fills, patch, conflicts, added, skipped };
  });
}

// ---------- What the browser receives (only plain strings and numbers) ----------

export type PreviewClientRow = {
  row: number;
  document: string;
  name: string;
  action: "create" | "update" | "archived";
  missing: string[]; // only for new clients
  fills: string[];
  conflicts: string[];
  added: string[];
  skipped: string[];
};

export type PreviewResult =
  | {
      ok: true;
      fileName: string;
      totals: {
        toCreate: number; toUpdate: number; archived: number; blockedInFile: number;
        incomes: number; assets: number; expenses: number; creditAccounts: number; childRowsBlocked: number;
      };
      problems: Problem[];
      gapCounts: Record<string, number>;
      clients: PreviewClientRow[];
    }
  | { ok: false; error: string };

export function buildPreview(plan: ImportPlan, actions: ClientAction[], fileName: string): PreviewResult {
  const problems: Problem[] = [...plan.problems];
  const clients: PreviewClientRow[] = actions.map((a) => {
    const c = a.client;
    const base = { row: c.row, document: `${c.documentType} ${c.documentNumber}`, name: c.fullName };
    if (a.kind === "create") {
      return { ...base, action: "create", missing: c.missing, fills: [], conflicts: [], added: [], skipped: [] };
    }
    if (a.kind === "archived") {
      problems.push({
        sheet: "Clientes", row: c.row, column: "Número de documento", severity: "error",
        message: "Este documento ya existe en el sistema pero el cliente está archivado; no se importará.",
      });
      return { ...base, action: "archived", missing: [], fills: [], conflicts: [], added: [], skipped: [] };
    }
    return {
      ...base,
      action: "update",
      missing: [],
      fills: a.fills.map((f) => `${f.field}: ${f.incoming}`),
      conflicts: a.conflicts.map((f) => `${f.field}: en el sistema "${f.current}", en el archivo "${f.incoming}" (se conserva el del sistema)`),
      added: a.added.map((s) => `${s.section}: se agregan ${s.rows}`),
      skipped: a.skipped.map((s) => `${s.section}: el cliente ya tiene ${s.existing}; se omiten ${s.rows} del archivo`),
    };
  });

  const count = (k: PreviewClientRow["action"]) => clients.filter((c) => c.action === k).length;
  return {
    ok: true,
    fileName,
    totals: {
      toCreate: count("create"),
      toUpdate: count("update"),
      archived: count("archived"),
      blockedInFile: plan.stats.clientsBlocked,
      incomes: plan.stats.incomes,
      assets: plan.stats.assets,
      expenses: plan.stats.expenses,
      creditAccounts: plan.stats.creditAccounts,
      childRowsBlocked: plan.stats.childRowsBlocked,
    },
    problems,
    gapCounts: plan.gapCounts,
    clients,
  };
}
