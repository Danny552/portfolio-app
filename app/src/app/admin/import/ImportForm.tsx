"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { confirmImport, previewImport } from "./actions";
import type { PreviewClientRow, PreviewResult } from "@/lib/import/compare";
import type { CommitResult } from "@/lib/import/commit";

type Ok = Extract<PreviewResult, { ok: true }>;
type Portfolio = { id: number; name: string };

const ACTION_LABEL: Record<PreviewClientRow["action"], string> = {
  create: "Nuevo",
  update: "Ya existe",
  archived: "Archivado",
};

const inputClass = "rounded border border-neutral-400 bg-transparent px-2 py-1 text-sm";

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-400/50 p-3">
      <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function ProblemTable({ items }: { items: Ok["problems"] }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-400 text-left">
            <th className="p-2">Hoja</th>
            <th className="p-2">Fila</th>
            <th className="p-2">Columna</th>
            <th className="p-2">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr key={i} className="border-b border-neutral-300/40">
              <td className="p-2">{p.sheet}</td>
              <td className="p-2">{p.row || "—"}</td>
              <td className="p-2">{p.column ?? "—"}</td>
              <td className="p-2">{p.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-60">{title}</div>
      <ul className="list-disc pl-5">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function summary(c: PreviewClientRow): string {
  if (c.action === "create") return c.missing.length ? `faltan ${c.missing.length} datos` : "completo";
  if (c.action === "update") return `${c.fills.length} por completar · ${c.conflicts.length} conflictos`;
  return "no se importará";
}

function Preview({ result }: { result: Ok }) {
  const errors = result.problems.filter((p) => p.severity === "error");
  const warnings = result.problems.filter((p) => p.severity === "warning");
  const t = result.totals;
  const gaps = Object.entries(result.gapCounts).sort((a, b) => b[1] - a[1]);

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Vista previa: {result.fileName}</h2>
      <p className="mt-1 text-sm opacity-70">Todavía no se guardó nada en la base de datos.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card label="Clientes nuevos" value={t.toCreate} />
        <Card label="Ya existen" value={t.toUpdate} />
        <Card label="Bloqueados" value={t.blockedInFile + t.archived} />
        <Card label="Errores" value={errors.length} />
        <Card label="Avisos" value={warnings.length} />
      </div>
      <p className="mt-3 text-sm opacity-70">
        Filas válidas de las otras hojas: {t.incomes} ingresos · {t.assets} activos · {t.expenses} gastos ·{" "}
        {t.creditAccounts} cuentas de crédito ({t.childRowsBlocked} bloqueadas).
      </p>

      {errors.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold">Errores ({errors.length}): estas filas no se importarán</h3>
          <ProblemTable items={errors} />
        </div>
      )}

      {warnings.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer font-semibold">
            Avisos ({warnings.length}): se importa dejando el campo vacío
          </summary>
          <ProblemTable items={warnings} />
        </details>
      )}

      {gaps.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold">Datos que faltan (según el archivo)</h3>
          <p className="text-sm opacity-70">Los completará el cliente desde su portal.</p>
          <ul className="mt-2 grid grid-cols-1 gap-x-8 text-sm md:grid-cols-2">
            {gaps.map(([field, n]) => (
              <li key={field} className="flex justify-between border-b border-neutral-300/40 py-1">
                <span>{field}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <h3 className="font-semibold">Clientes ({result.clients.length})</h3>
        <ul className="mt-2 divide-y divide-neutral-300/40 text-sm">
          {result.clients.map((c) => (
            <li key={`${c.row}-${c.document}`} className="py-2">
              <details>
                <summary className="cursor-pointer">
                  <span className="mr-2 rounded-full border border-neutral-400 px-2 py-0.5 text-xs">
                    {ACTION_LABEL[c.action]}
                  </span>
                  {c.document} · {c.name} <span className="ml-2 opacity-60">{summary(c)}</span>
                </summary>
                <div className="mt-2 space-y-2 pl-4">
                  <List title="Datos pendientes (los completará el cliente)" items={c.missing} />
                  <List title="Se completarán" items={c.fills} />
                  <List title="Conflictos" items={c.conflicts} />
                  <List title="Se agregan" items={c.added} />
                  <List title="Se omiten" items={c.skipped} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function ImportForm({ portfolios }: { portfolios: Portfolio[] }) {
  // The file is kept in memory: React clears <input type="file"> after a form action,
  // and the confirm step needs to send the very same file again.
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [done, setDone] = useState<CommitResult | null>(null);
  const [pending, startTransition] = useTransition();

  const [mode, setMode] = useState<"existing" | "new">(portfolios.length > 0 ? "existing" : "new");
  const [portfolioId, setPortfolioId] = useState<number>(portfolios[0]?.id ?? 0);
  const [newName, setNewName] = useState("");
  const [newOrigin, setNewOrigin] = useState("PURCHASED");
  const [newSource, setNewSource] = useState("");
  const [newDate, setNewDate] = useState("");

  function onReview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setDone(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      setPreview(await previewImport(fd));
    });
  }

  function onConfirm() {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("portfolioMode", mode);
    if (mode === "existing") {
      fd.set("portfolioId", String(portfolioId));
    } else {
      fd.set("newName", newName);
      fd.set("newOrigin", newOrigin);
      fd.set("newSource", newSource);
      fd.set("newAcquiredAt", newDate);
    }
    startTransition(async () => {
      const result = await confirmImport(fd);
      setDone(result);
      if (result.ok) {
        // clear everything so the same file cannot be imported twice by accident
        setPreview(null);
        setFile(null);
        setInputKey((k) => k + 1);
      }
    });
  }

  const ok = preview && preview.ok ? preview : null;
  const canConfirm = ok !== null && ok.totals.toCreate + ok.totals.toUpdate > 0;

  return (
    <div>
      <form onSubmit={onReview} className="flex flex-wrap items-center gap-3">
        <input
          key={inputKey}
          type="file"
          accept=".xlsx"
          required
          className="text-sm"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setDone(null);
          }}
        />
        <button
          type="submit"
          disabled={pending || !file}
          className="rounded-full border border-foreground bg-foreground px-4 py-1.5 text-sm text-background disabled:opacity-50"
        >
          {pending ? "Procesando…" : "Revisar archivo"}
        </button>
        <a href="/plantilla-importacion-clientes.xlsx" download className="text-sm underline opacity-70">
          Descargar plantilla
        </a>
      </form>

      {done && !done.ok && <p className="mt-6 rounded border border-red-500 p-3 text-sm">{done.error}</p>}

      {done && done.ok && (
        <div className="mt-6 rounded border border-green-600 p-4 text-sm">
          <p className="font-semibold">Importación completada (lote #{done.batchId})</p>
          <p className="mt-1">
            Cartera: {done.portfolioName}. {done.created} clientes nuevos, {done.updated} existentes completados
            {done.unchanged > 0 ? `, ${done.unchanged} sin cambios` : ""}. Filas agregadas: {done.incomes} ingresos,{" "}
            {done.assets} activos, {done.expenses} gastos, {done.creditAccounts} cuentas de crédito.
          </p>
          <p className="mt-2">
            <Link href="/admin/clients" className="underline">
              Ver clientes →
            </Link>
          </p>
        </div>
      )}

      {preview && !preview.ok && <p className="mt-6 rounded border border-red-500 p-3 text-sm">{preview.error}</p>}

      {ok && (
        <>
          <Preview result={ok} />

          <section className="mt-10 rounded-lg border border-neutral-400/50 p-4">
            <h2 className="text-lg font-semibold">Confirmar importación</h2>
            {canConfirm ? (
              <>
                <p className="mt-1 text-sm opacity-70">
                  Se guardarán {ok.totals.toCreate} clientes nuevos y se completarán datos de {ok.totals.toUpdate}{" "}
                  existentes. Las filas con errores se omiten. Los clientes que ya existen conservan su cartera actual.
                </p>

                <div className="mt-4 space-y-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} disabled={portfolios.length === 0} />
                    Cartera existente
                    <select
                      className={inputClass}
                      value={portfolioId}
                      disabled={mode !== "existing"}
                      onChange={(e) => setPortfolioId(Number(e.target.value))}
                    >
                      {portfolios.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
                    Nueva cartera
                  </label>
                  {mode === "new" && (
                    <div className="grid grid-cols-1 gap-3 pl-6 md:grid-cols-2">
                      <input className={inputClass} placeholder="Nombre de la cartera" value={newName} onChange={(e) => setNewName(e.target.value)} />
                      <select className={inputClass} value={newOrigin} onChange={(e) => setNewOrigin(e.target.value)}>
                        <option value="PURCHASED">Adquirida</option>
                        <option value="INHERITED">Heredada</option>
                        <option value="ORIGINAL">Propia</option>
                      </select>
                      <input className={inputClass} placeholder="Fuente (de quién proviene)" value={newSource} onChange={(e) => setNewSource(e.target.value)} />
                      <input className={inputClass} type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={pending}
                  className="mt-5 rounded-full border border-foreground bg-foreground px-5 py-2 text-sm text-background disabled:opacity-50"
                >
                  {pending ? "Guardando…" : `Importar ${ok.totals.toCreate} nuevos y completar ${ok.totals.toUpdate} existentes`}
                </button>
              </>
            ) : (
              <p className="mt-1 text-sm opacity-70">No hay nada que importar en este archivo.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
