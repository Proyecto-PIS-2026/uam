import type { Metadata } from "next";
import PreciosReferencia from "@/modulos/informacion-uam/precios-referencia/PreciosReferencia";
import { obtenerPreciosReferencia, type ResultadoPreciosReferencia } from "@/modulos/informacion-uam/precios-referencia/consultas-precios-referencia";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Precios de referencia | UAM",
    description: "Consulta los precios relevados de frutas y hortalizas de la UAM.",
};

export default async function PaginaPreciosReferencia() {
    let consulta: ResultadoPreciosReferencia | null = null;
    try {
        consulta = await obtenerPreciosReferencia();
    } catch {
        consulta = null;
    }

    return (
        <main className="flex-1 bg-background text-foreground">
            <div className="contenedor-pagina">
                {consulta ? (
                    <PreciosReferencia fechaRelevamiento={consulta.fechaRelevamiento} filas={consulta.filas} />
                ) : (
                    <section>
                        <h1 className="text-2xl font-semibold">Precios de referencia</h1>
                        <p role="status" className="mt-4">No hay precios de referencia disponibles en este momento.</p>
                    </section>
                )}
            </div>
        </main>
    );
}
