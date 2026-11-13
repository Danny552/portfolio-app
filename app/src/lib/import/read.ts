// Reads an .xlsx file (ExcelJS) into plain rows for validateImport().
// This is the only file in the import code that knows about Excel.
import ExcelJS from "exceljs";
import { HEADERS, SHEETS } from "./validate";
import type { RawWorkbook } from "./validate";
  
// ExcelJS cell values can be numbers, text, dates, formulas, rich text, hyperlinks...
function plain(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if ("result" in o) return plain(o.result as ExcelJS.CellValue); // formula
    if ("richText" in o) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if ("text" in o) return o.text; // hyperlink
    if ("error" in o) return null;
  }
  return v;
}
 
export async function readWorkbook(data: Buffer | ArrayBuffer | Uint8Array): Promise<RawWorkbook> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch (e) {
    throw new Error(
      `No se pudo leer el archivo. ¿Es un .xlsx válido, sin contraseña? (${e instanceof Error ? e.message : String(e)})`
    );
  }
 
  const out: RawWorkbook = {
    clientes: [], ingresos: [], activos: [], gastos: [], creditos: [],
    fileProblems: [],
  };
 
  for (const key of Object.keys(SHEETS) as (keyof typeof SHEETS)[]) {
    const sheetName = SHEETS[key];
    const ws = wb.getWorksheet(sheetName);
 
    if (!ws) {
      out.fileProblems!.push({
        sheet: sheetName, row: 0,
        severity: key === "clientes" ? "error" : "warning",
        message: key === "clientes"
          ? "Falta la hoja Clientes. ¿Es la plantilla correcta?"
          : `No se encontró la hoja ${sheetName}; se tratará como vacía.`,
      });
      continue;
    }
 
    // Row 1 = headers. The trailing " *" that marks required columns is ignored.
    const headerByColumn = new Map<number, string>();
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
      const h = String(plain(cell.value) ?? "").replace(/\s*\*\s*$/, "").trim();
      if (h) headerByColumn.set(col, h);
    });
    const present = new Set(headerByColumn.values());
 
    for (const h of HEADERS[key].required) {
      if (!present.has(h)) {
        out.fileProblems!.push({
          sheet: sheetName, row: 1, column: h, severity: "error",
          message: `Falta la columna "${h}". No cambie los encabezados de la plantilla.`,
        });
      }
    }
    for (const h of HEADERS[key].optional) {
      if (!present.has(h)) {
        out.fileProblems!.push({
          sheet: sheetName, row: 1, column: h, severity: "warning",
          message: `No se encontró la columna "${h}"; se tratará como vacía.`,
        });
      }
    }
 
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const cells: Record<string, unknown> = {};
      headerByColumn.forEach((header, col) => {
        cells[header] = plain(row.getCell(col).value);
      });
      out[key].push({ row: rowNumber, cells });
    });
  }
 
  return out;
}
 
