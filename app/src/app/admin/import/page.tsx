import ImportForm from "./ImportForm";

export default function ImportPage() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-semibold">Importar clientes</h1>
      <p className="mt-1 mb-6 text-sm opacity-70">
        Suba un archivo Excel con la plantilla. Primero se revisa y se muestra una vista previa; todavía no se guarda nada.
      </p>
      <ImportForm />
    </main>
  );
}
