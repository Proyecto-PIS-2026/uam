"use client";

export default function ErrorMiPerfil({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <main className="contenedor-pagina secciones-pagina">
            <section role="alert" className="rounded-2xl border p-6">
                <h1 className="mb-3 text-xl font-semibold">No se pudo cargar el perfil</h1>
                <p>Ocurrió un problema al consultar tus datos. Intentá nuevamente.</p>
                <button type="button" onClick={reset} className="boton-secundario mt-5">Reintentar</button>
            </section>
        </main>
    );
}
