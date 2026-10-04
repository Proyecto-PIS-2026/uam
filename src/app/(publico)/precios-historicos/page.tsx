import type { Metadata } from "next";
import PreciosHistoricos from "@/modulos/informacion-uam/precios-historicos/PreciosHistoricos";
import { cargarHistoricoDePrueba } from "@/modulos/informacion-uam/precios-historicos/datos-prueba";
import type { ProductoSeleccionado } from "@/modulos/informacion-uam/precios-historicos/tipos";

export const metadata: Metadata = {
    title: "Precios históricos | UAM",
    description: "Consulta los precios históricos de productos de la UAM.",
};

type Parametros = {
    classification_id?: string;
    species_id?: string;
    producto?: string;
    variedad?: string;
    pais?: string;
    calibre?: string;
    categoria?: string;
};

export default async function PaginaPreciosHistoricos({
    searchParams,
}: {
    searchParams: Promise<Parametros>;
}) {
    const parametros = await searchParams;
    const historico = cargarHistoricoDePrueba();
    const producto: ProductoSeleccionado = {
        id: JSON.stringify([parametros.classification_id, parametros.species_id]),
        especie: parametros.producto ?? "Producto",
        variedad: parametros.variedad ?? "-",
        pais: parametros.pais ?? "-",
        calibre: parametros.calibre ?? "-",
        categoria: parametros.categoria ?? "-",
    };
    const coincide = Number(parametros.classification_id) === historico.classification_id
        && Number(parametros.species_id) === historico.species_id;

    return (
        <main className="flex-1 bg-background text-foreground">
            <div className="contenedor-pagina">
                <PreciosHistoricos producto={producto} historico={coincide ? historico : null} />
            </div>
        </main>
    );
}
