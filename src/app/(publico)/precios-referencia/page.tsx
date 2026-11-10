import type { Metadata } from "next";
import PriceCheckOutlinedIcon from "@mui/icons-material/PriceCheckOutlined";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
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
                    <section className="secciones-pagina">
                        <EncabezadoPagina titulo="Precios de referencia" subtitulo="Consulta los precios relevados de la UAM" />
                        <EstadoVacio
                            titulo="No hay precios de referencia disponibles en este momento."
                            descripcion="Podés volver a intentarlo más tarde para consultar el último relevamiento."
                            icono={<PriceCheckOutlinedIcon />}
                        />
                    </section>
                )}
            </div>
        </main>
    );
}
