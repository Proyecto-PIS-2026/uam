import type { Metadata } from "next";
import PreciosReferencia from "@/modulos/informacion-uam/precios-referencia/PreciosReferencia";
import { obtenerPreciosReferencia } from "@/modulos/informacion-uam/precios-referencia/consultas-precios-referencia";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Precios de referencia | UAM",
    description: "Consulta los precios relevados de frutas y hortalizas de la UAM.",
};

export default async function PaginaPreciosReferencia() {
    const consulta = await obtenerPreciosReferencia();

    return (
        <main className="flex-1 bg-background text-foreground">
            <div className="contenedor-pagina">
                <PreciosReferencia fechaRelevamiento={consulta.fechaRelevamiento} filas={consulta.filas} />
            </div>
        </main>
    );
}
