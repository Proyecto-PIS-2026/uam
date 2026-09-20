import Link from "next/link";
import { notFound } from "next/navigation";
import varsTemp from "../vars-temporales";
import Detalle from "./detalle-publicacion";

import { obtenerPublicacionesDeOperador } from "@/infraestructura/persistencia/prisma/publicaciones";

// ESTA CARPETA VA A SER BORRADA LUEGO. ES TEMPORAL PARA PROBAR COSAS. 
// O CAPAZ QUE LA NECESITAMOS DESPUES, NI IDEA

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function Page({ params }: Props) {
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
    
    let precioInicial = 0;
    if (Number(pub.precio)) {
        precioInicial = Number(pub.precio);
    }

    return (
        <main className="min-h-screen bg-[var(--lightgray)] px-4 py-8">
            <div className="mx-auto max-w-4xl">
                <Link
                    href="/mi-mercado"
                    className="mb-6 inline-block font-semibold text-[var(--green)] hover:underline"
                >
                    ← Volver a Mi Mercado
                </Link>

                <Detalle nombreProducto={nombreProducto} precioInicial={precioInicial} incrementoPrecio={varsTemp.incrementoPrecio}/>
            </div>
        </main>
    );
}