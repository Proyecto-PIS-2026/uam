"use client";

/*
 * DEMO: muestra una opción de reintento si falla la carga de Mi Mercado.
 * Este archivo se puede retirar cuando exista un manejo definitivo del error.
 */
export default function ErrorMiMercado({ retry }: { retry: () => void }) {
    return (
        <main className="contenedor-pagina flex min-h-[60dvh] items-center justify-center">
            <section role="alert" className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
                <h1 className="text-xl font-bold text-foreground">No pudimos cargar Mi Mercado</h1>
                <p className="mt-2 text-sm text-muted-foreground">Intentá de nuevo en unos segundos.</p>
                <button type="button" onClick={retry} className="mt-6 rounded-lg bg-secondary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Reintentar</button>
            </section>
        </main>
    );
}
