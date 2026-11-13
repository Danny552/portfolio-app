// Pure validation and normalization of import data.
// No Excel and no database in here: plain rows in, an ImportPlan out.

export type DocumentType = "CC" | "CE" | "NIT" | "PASSPORT" | "TI" | "PEP" | "OTHER";
export type OccupationType = "EMPLOYEE" | "SELF_EMPLOYED";
export type MaritalStatus = "SINGLE" | "MARRIED" | "COMMON_LAW" | "DIVORCED" | "WIDOWED";
export type IncomeType = "FIXED" | "ADDITIONAL";

export type Problem = {
  sheet: string;
  row: number; // spreadsheet row number (0 = whole file / sheet)
  column?: string;
  severity: "error" | "warning";
  message: string;
};

export type RawRow = { row: number; cells: Record<string, unknown> };
export type RawWorkbook = {
  clientes: RawRow[];
  ingresos: RawRow[];
  activos: RawRow[];
  gastos: RawRow[];
  creditos: RawRow[];
  fileProblems?: Problem[]; // missing sheets / columns, found while reading
};

export type ParsedClient = {
  row: number;
  documentType: DocumentType;
  documentNumber: string;
  fullName: string;
  birthDate?: Date;
  profession?: string;
  occupationType?: OccupationType;
  jobTitle?: string;
  ciiuCode?: string;
  yearsExperience?: number;
  maritalStatus?: MaritalStatus;
  dependents?: number;
  email?: string;
  phone?: string;
  incomes: { row: number; type: IncomeType; description?: string; monthlyAmount: number }[];
  assets: { row: number; category: string; description?: string; value: number; asOfDate?: Date }[];
  expenses: { row: number; category: string; monthlyAmount: number }[];
  creditAccounts: {
    row: number;
    entity: string;
    accountType: string;
    creditLimit?: number;
    balance: number;
    monthlyPayment?: number;
    status?: string;
    reportDate?: Date;
  }[];
  missing: string[]; // fields still empty: what the client portal will ask for
};

export type ImportPlan = {
  clients: ParsedClient[];
  problems: Problem[];
  gapCounts: Record<string, number>;
  stats: {
    clientRows: number;
    clientsOk: number;
    clientsBlocked: number;
    exampleRowsSkipped: number;
    incomes: number;
    assets: number;
    expenses: number;
    creditAccounts: number;
    childRowsBlocked: number;
  };
};

// ---------- Sheet / column names (must match the template) ----------

export const SHEETS = {
  clientes: "Clientes",
  ingresos: "Ingresos",
  activos: "Activos",
  gastos: "Gastos",
  creditos: "Cuentas de crédito",
} as const;

const H = {
  tipoDoc: "Tipo de documento",
  numDoc: "Número de documento",
  nombre: "Nombre completo",
  nacimiento: "Fecha de nacimiento",
  profesion: "Profesión",
  ocupacion: "Ocupación",
  cargo: "Cargo",
  ciiu: "Actividad económica (CIIU)",
  anios: "Años de experiencia",
  civil: "Estado civil",
  aCargo: "Personas a cargo",
  correo: "Correo",
  telefono: "Teléfono",
  tipoIngreso: "Tipo de ingreso",
  descripcion: "Descripción",
  montoMensual: "Monto mensual (COP)",
  categoria: "Categoría",
  valor: "Valor (COP)",
  fechaValoracion: "Fecha de valoración",
  entidad: "Entidad",
  tipoCuenta: "Tipo de cuenta",
  cupo: "Cupo (COP)",
  saldo: "Saldo (COP)",
  cuota: "Cuota mensual (COP)",
  estado: "Estado",
  fechaReporte: "Fecha de reporte",
} as const;

export const HEADERS: Record<keyof typeof SHEETS, { required: string[]; optional: string[] }> = {
  clientes: {
    required: [H.tipoDoc, H.numDoc, H.nombre],
    optional: [H.nacimiento, H.profesion, H.ocupacion, H.cargo, H.ciiu, H.anios, H.civil, H.aCargo, H.correo, H.telefono],
  },
  ingresos: { required: [H.tipoDoc, H.numDoc, H.tipoIngreso, H.montoMensual], optional: [H.descripcion] },
  activos: { required: [H.tipoDoc, H.numDoc, H.categoria, H.valor], optional: [H.descripcion, H.fechaValoracion] },
  gastos: { required: [H.tipoDoc, H.numDoc, H.categoria, H.montoMensual], optional: [] },
  creditos: {
    required: [H.tipoDoc, H.numDoc, H.entidad, H.tipoCuenta, H.saldo],
    optional: [H.cupo, H.cuota, H.estado, H.fechaReporte],
  },
};

// ---------- Small helpers ----------

const str = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, " ").trim();
};
const isBlank = (v: unknown): boolean => str(v) === "";
const fold = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const DOC_TYPES: Record<string, DocumentType> = {
  cc: "CC", "c.c.": "CC", "c.c": "CC", cedula: "CC", "cedula de ciudadania": "CC",
  ce: "CE", "c.e.": "CE", "c.e": "CE", "cedula de extranjeria": "CE",
  nit: "NIT",
  ti: "TI", "tarjeta de identidad": "TI",
  pep: "PEP",
  pasaporte: "PASSPORT", passport: "PASSPORT",
  otro: "OTHER", other: "OTHER",
};
const OCCUPATIONS: Record<string, OccupationType> = {
  empleado: "EMPLOYEE", empleada: "EMPLOYEE", "empleado/a": "EMPLOYEE", dependiente: "EMPLOYEE",
  independiente: "SELF_EMPLOYED",
};
const MARITAL: Record<string, MaritalStatus> = {
  soltero: "SINGLE", soltera: "SINGLE", "soltero/a": "SINGLE",
  casado: "MARRIED", casada: "MARRIED", "casado/a": "MARRIED",
  "union libre": "COMMON_LAW", "union marital de hecho": "COMMON_LAW",
  divorciado: "DIVORCED", divorciada: "DIVORCED", "divorciado/a": "DIVORCED",
  viudo: "WIDOWED", viuda: "WIDOWED", "viudo/a": "WIDOWED",
};
const INCOME_TYPES: Record<string, IncomeType> = {
  fijo: "FIXED", fijos: "FIXED", adicional: "ADDITIONAL", adicionales: "ADDITIONAL",
};

const ASSET_CATEGORIES = ["Inmueble", "Vehículo", "Inversiones", "Cuentas bancarias", "Negocio / empresa", "Otro"];
const EXPENSE_CATEGORIES = ["Vivienda", "Alimentación", "Transporte", "Salud", "Educación", "Servicios", "Deudas", "Otro"];
const canonical = (value: string, list: string[]): string =>
  list.find((c) => fold(c) === fold(value)) ?? value;

function normalizeDocNumber(v: unknown): string {
  return str(v).replace(/[.\s,]/g, "").toUpperCase();
}

function parseDate(v: unknown): Date | null {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  if (typeof v === "number") {
    // Excel serial number stored in a cell that is not date-formatted
    if (v > 0 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return null;
  }
  const s = str(v);
  let y: number, m: number, d: number;
  let mt = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/); // 2026-03-21
  if (mt) {
    y = +mt[1]; m = +mt[2]; d = +mt[3];
  } else {
    mt = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); // 21/03/2026 (day first, as in Colombia)
    if (!mt) return null;
    d = +mt[1]; m = +mt[2]; y = +mt[3];
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function parseBirthDate(v: unknown): Date | null {
  const d = parseDate(v);
  if (!d) return null;
  if (d.getUTCFullYear() < 1900 || d.getTime() > Date.now()) return null;
  return d;
}

// Colombian reading of amounts: "1.200.000" and "1.200.000,50" use dots for thousands.
function parseMoney(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") {
    n = v;
  } else {
    let s = str(v).replace(/cop/gi, "").replace(/[$\s]/g, "");
    if (s === "") return null;
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, "");
    else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
    else if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    n = Number(s);
  }
  if (!Number.isFinite(n) || n < 0 || n >= 1e15) return null;
  return Math.round(n * 100) / 100;
}

function parseCount(v: unknown, max: number): number | null {
  const n = typeof v === "number" ? v : /^\d+$/.test(str(v)) ? Number(str(v)) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}

function parseEmail(v: unknown): string | null {
  const s = str(v).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

function parsePhone(v: unknown): string | null {
  const raw = str(v);
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? "+" + digits : null;
  if (digits.length === 10) return "+57" + digits;
  if (digits.length === 12 && digits.startsWith("57")) return "+" + digits;
  return null;
}

function parseCiiu(v: unknown, valid: Set<string>): string | null {
  let s = str(v).replace(/\.0+$/, "");
  if (/^\d{3}$/.test(s)) s = "0" + s; // Excel drops the leading zero of 0111
  return /^\d{4}$/.test(s) && valid.has(s) ? s : null;
}

// ---------- Row context: collects problems for one spreadsheet row ----------

function makeCtx(problems: Problem[], sheet: string, row: number) {
  let bad = false;
  return {
    err(message: string, column?: string) {
      bad = true;
      problems.push({ sheet, row, column, severity: "error", message });
    },
    warn(message: string, column?: string) {
      problems.push({ sheet, row, column, severity: "warning", message });
    },
    isBad() {
      return bad;
    },
  };
}
type Ctx = ReturnType<typeof makeCtx>;

function readDocument(ctx: Ctx, cells: Record<string, unknown>) {
  let documentType: DocumentType | null = null;
  if (isBlank(cells[H.tipoDoc])) {
    ctx.err("Falta el tipo de documento.", H.tipoDoc);
  } else {
    documentType = DOC_TYPES[fold(str(cells[H.tipoDoc]))] ?? null;
    if (!documentType) ctx.err(`Tipo de documento no reconocido: "${str(cells[H.tipoDoc])}".`, H.tipoDoc);
  }
  const documentNumber = normalizeDocNumber(cells[H.numDoc]);
  if (documentNumber === "") ctx.err("Falta el número de documento.", H.numDoc);
  if (!documentType || documentNumber === "") return null;
  return { documentType, documentNumber, key: `${documentType}:${documentNumber}` };
}

// Optional field: blank -> undefined (a gap); present but invalid -> warning + undefined.
function optional<T>(
  ctx: Ctx,
  cells: Record<string, unknown>,
  column: string,
  parse: (v: unknown) => T | null,
  why: string
): T | undefined {
  const v = cells[column];
  if (isBlank(v)) return undefined;
  const parsed = parse(v);
  if (parsed === null) {
    ctx.warn(`${why}: "${str(v)}". Se dejará vacío.`, column);
    return undefined;
  }
  return parsed;
}

const text = (v: unknown): string | null => (isBlank(v) ? null : str(v));

// ---------- Main entry point ----------

export function validateImport(raw: RawWorkbook, opts: { validCiiu: Set<string> }): ImportPlan {
  const problems: Problem[] = [...(raw.fileProblems ?? [])];
  const stats = {
    clientRows: 0, clientsOk: 0, clientsBlocked: 0, exampleRowsSkipped: 0,
    incomes: 0, assets: 0, expenses: 0, creditAccounts: 0, childRowsBlocked: 0,
  };
  if (problems.some((p) => p.severity === "error")) {
    return { clients: [], problems, gapCounts: {}, stats };
  }

  const accepted = new Map<string, ParsedClient>();
  const blocked = new Map<string, number>(); // key -> spreadsheet row of the blocked client

  // ---- Clientes ----
  for (const r of raw.clientes) {
    const c = r.cells;
    if (Object.values(c).every(isBlank)) continue;
    if (fold(str(c[H.nombre])).startsWith("ejemplo")) {
      stats.exampleRowsSkipped++;
      continue;
    }
    stats.clientRows++;
    const ctx = makeCtx(problems, SHEETS.clientes, r.row);

    const doc = readDocument(ctx, c);
    const fullName = str(c[H.nombre]);
    if (fullName === "") ctx.err("Falta el nombre completo.", H.nombre);

    // Contact: at least one valid way to reach the client (needed for portal login)
    const email = optional(ctx, c, H.correo, parseEmail, "No es un correo válido");
    const phone = optional(ctx, c, H.telefono, parsePhone, "No es un teléfono válido");
    if (!email && !phone) ctx.err("Falta un dato de contacto válido: correo o teléfono.", `${H.correo} / ${H.telefono}`);

    const birthDate = optional(ctx, c, H.nacimiento, parseBirthDate, "No es una fecha de nacimiento válida (use AAAA-MM-DD)");
    const occupationType = optional(ctx, c, H.ocupacion, (v) => OCCUPATIONS[fold(str(v))] ?? null, "Ocupación no reconocida (use Empleado o Independiente)");
    const maritalStatus = optional(ctx, c, H.civil, (v) => MARITAL[fold(str(v))] ?? null, "Estado civil no reconocido");
    const ciiuCode = optional(ctx, c, H.ciiu, (v) => parseCiiu(v, opts.validCiiu), "Código CIIU no válido");
    const yearsExperience = optional(ctx, c, H.anios, (v) => parseCount(v, 80), "Años de experiencia no válidos");
    const dependents = optional(ctx, c, H.aCargo, (v) => parseCount(v, 30), "Personas a cargo no válido");

    if (doc && !ctx.isBad()) {
      if (accepted.has(doc.key)) {
        ctx.err(`Documento repetido: ya aparece en la fila ${accepted.get(doc.key)!.row} de Clientes.`, H.numDoc);
      }
    }
    if (ctx.isBad()) {
      stats.clientsBlocked++;
      if (doc && !blocked.has(doc.key) && !accepted.has(doc.key)) blocked.set(doc.key, r.row);
      continue;
    }

    accepted.set(doc!.key, {
      row: r.row,
      documentType: doc!.documentType,
      documentNumber: doc!.documentNumber,
      fullName,
      birthDate,
      profession: text(c[H.profesion]) ?? undefined,
      occupationType,
      jobTitle: text(c[H.cargo]) ?? undefined,
      ciiuCode,
      yearsExperience,
      maritalStatus,
      dependents,
      email,
      phone,
      incomes: [], assets: [], expenses: [], creditAccounts: [],
      missing: [],
    });
  }

  // Finds the client a child row belongs to (by tipo + número de documento)
  function clientFor(ctx: Ctx, cells: Record<string, unknown>): ParsedClient | null {
    const doc = readDocument(ctx, cells);
    if (!doc) return null;
    const client = accepted.get(doc.key);
    if (client) return client;
    if (blocked.has(doc.key)) {
      ctx.err(`El cliente de la fila ${blocked.get(doc.key)} de Clientes tiene errores y no se importará.`, H.numDoc);
    } else {
      ctx.err("Este documento no aparece en la hoja Clientes.", H.numDoc);
    }
    return null;
  }

  function required<T>(ctx: Ctx, cells: Record<string, unknown>, column: string, parse: (v: unknown) => T | null, what: string): T | null {
    if (isBlank(cells[column])) {
      ctx.err(`Falta ${what}.`, column);
      return null;
    }
    const parsed = parse(cells[column]);
    if (parsed === null) ctx.err(`${what[0].toUpperCase()}${what.slice(1)} no es válido: "${str(cells[column])}".`, column);
    return parsed;
  }

  // ---- Ingresos ----
  for (const r of raw.ingresos) {
    const c = r.cells;
    if (Object.values(c).every(isBlank)) continue;
    const ctx = makeCtx(problems, SHEETS.ingresos, r.row);
    const client = clientFor(ctx, c);
    const type = required(ctx, c, H.tipoIngreso, (v) => INCOME_TYPES[fold(str(v))] ?? null, "el tipo de ingreso (Fijo o Adicional)");
    const amount = required(ctx, c, H.montoMensual, parseMoney, "el monto mensual");
    if (ctx.isBad() || !client) { stats.childRowsBlocked++; continue; }
    client.incomes.push({ row: r.row, type: type!, description: text(c[H.descripcion]) ?? undefined, monthlyAmount: amount! });
    stats.incomes++;
  }

  // ---- Activos ----
  for (const r of raw.activos) {
    const c = r.cells;
    if (Object.values(c).every(isBlank)) continue;
    const ctx = makeCtx(problems, SHEETS.activos, r.row);
    const client = clientFor(ctx, c);
    const category = required(ctx, c, H.categoria, text, "la categoría");
    const value = required(ctx, c, H.valor, parseMoney, "el valor");
    const asOfDate = optional(ctx, c, H.fechaValoracion, parseDate, "No es una fecha válida (use AAAA-MM-DD)");
    if (ctx.isBad() || !client) { stats.childRowsBlocked++; continue; }
    client.assets.push({
      row: r.row, category: canonical(category!, ASSET_CATEGORIES),
      description: text(c[H.descripcion]) ?? undefined, value: value!, asOfDate,
    });
    stats.assets++;
  }

  // ---- Gastos ----
  for (const r of raw.gastos) {
    const c = r.cells;
    if (Object.values(c).every(isBlank)) continue;
    const ctx = makeCtx(problems, SHEETS.gastos, r.row);
    const client = clientFor(ctx, c);
    const category = required(ctx, c, H.categoria, text, "la categoría");
    const amount = required(ctx, c, H.montoMensual, parseMoney, "el monto mensual");
    if (ctx.isBad() || !client) { stats.childRowsBlocked++; continue; }
    client.expenses.push({ row: r.row, category: canonical(category!, EXPENSE_CATEGORIES), monthlyAmount: amount! });
    stats.expenses++;
  }

  // ---- Cuentas de crédito ----
  for (const r of raw.creditos) {
    const c = r.cells;
    if (Object.values(c).every(isBlank)) continue;
    const ctx = makeCtx(problems, SHEETS.creditos, r.row);
    const client = clientFor(ctx, c);
    const entity = required(ctx, c, H.entidad, text, "la entidad");
    const accountType = required(ctx, c, H.tipoCuenta, text, "el tipo de cuenta");
    const balance = required(ctx, c, H.saldo, parseMoney, "el saldo");
    const creditLimit = optional(ctx, c, H.cupo, parseMoney, "Cupo no válido");
    const monthlyPayment = optional(ctx, c, H.cuota, parseMoney, "Cuota no válida");
    const reportDate = optional(ctx, c, H.fechaReporte, parseDate, "No es una fecha válida (use AAAA-MM-DD)");
    if (ctx.isBad() || !client) { stats.childRowsBlocked++; continue; }
    client.creditAccounts.push({
      row: r.row, entity: entity!, accountType: accountType!, creditLimit, balance: balance!,
      monthlyPayment, status: text(c[H.estado]) ?? undefined, reportDate,
    });
    stats.creditAccounts++;
  }

  // ---- Gaps: what each client still has to complete ----
  const gapCounts: Record<string, number> = {};
  for (const cl of accepted.values()) {
    const m: string[] = [];
    if (!cl.birthDate) m.push("Fecha de nacimiento");
    if (!cl.profession) m.push("Profesión");
    if (!cl.occupationType) m.push("Ocupación");
    if (cl.occupationType === "EMPLOYEE" && !cl.jobTitle) m.push("Cargo");
    if (cl.occupationType === "SELF_EMPLOYED" && !cl.ciiuCode) m.push("Actividad económica");
    if (cl.yearsExperience === undefined) m.push("Años de experiencia");
    if (!cl.maritalStatus) m.push("Estado civil");
    if (cl.dependents === undefined) m.push("Personas a cargo");
    if (!cl.email) m.push("Correo");
    if (!cl.phone) m.push("Teléfono");
    if (cl.incomes.length === 0) m.push("Ingresos");
    if (cl.assets.length === 0) m.push("Activos");
    if (cl.expenses.length === 0) m.push("Gastos");
    cl.missing = m;
    for (const g of m) gapCounts[g] = (gapCounts[g] ?? 0) + 1;
  }

  stats.clientsOk = accepted.size;
  return { clients: [...accepted.values()], problems, gapCounts, stats };
}
