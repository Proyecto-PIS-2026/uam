"use client";

import AvisoErrorToast from "@/compartido/componentes/AvisoErrorToast";

export default function ErrorMiPerfil({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <main className="contenedor-pagina secciones-pagina">
            <AvisoErrorToast mensaje="No se pudo cargar el perfil. Ocurrió un problema al consultar tus datos. Intentá nuevamente." />
            <section aria-labelledby="titulo-mi-perfil" className="rounded-2xl border p-6">
                <h1 id="titulo-mi-perfil" className="mb-3 text-xl font-semibold">Mi perfil</h1>
                <button type="button" onClick={reset} className="boton-secundario mt-5">Reintentar</button>
            </section>
        </main>
    );
}
