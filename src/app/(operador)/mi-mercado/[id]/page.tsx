import Link from "next/link";
import { notFound } from "next/navigation";
import varsTemp from "../vars-temporales";

import { obtenerPublicacionesDeOperador } from "@/infraestructura/persistencia/prisma/publicaciones";

// ESTA CARPETA VA A SER BORRADA LUEGO. ES TEMPORAL PARA PROBAR COSAS. 
// O CAPAZ QUE LA NECESITAMOS DESPUES, NI IDEA

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function DetallePublicacion({ params }: Props) {
    const { id } = await params;
    const publicacionId = Number(id);

    if (Number.isNaN(publicacionId)) {
        notFound();
    }

    // TODO: reemplazar por el operadorId del usuario logueado
    const operadorId = varsTemp.operadorId;

    const publicaciones = await obtenerPublicacionesDeOperador(operadorId);

    const relacion = publicaciones.find(
        (rel) => Number(rel.publicacion.id) === publicacionId
    );

    if (!relacion) {
        notFound();
    }

    const pub = relacion.publicacion;
    const nombreProducto =
        pub.presentacion.variedad.especie.nombreEspecie;

    return (
        <main className="min-h-screen bg-[var(--lightgray)] px-4 py-8">
            <div className="mx-auto max-w-4xl">
                <Link
                    href="/mi-mercado"
                    className="mb-6 inline-block font-semibold text-[var(--green)] hover:underline"
                >
                    ← Volver a Mi Mercado
                </Link>

                <div className="rounded-2xl border border-gray-200 bg-white p-8">
                    <h1 className="text-4xl font-extrabold text-[var(--ink)]">
                        {nombreProducto}
                    </h1>

                    <p className="mt-6 text-lg text-gray-500">
                        Acá poner la info
                    </p>
                </div>
            </div>
        </main>
    );
}