import type { Metadata } from "next";
import { Suspense } from "react";
import PreciosHistoricos from "@/modulos/informacion-uam/precios-historicos/PreciosHistoricos";
import { obtenerHistoricoPrecios } from "@/modulos/informacion-uam/precios-historicos/consultas-precios-historicos";
import { obtenerCatalogoEspeciesHistoricas } from "@/modulos/informacion-uam/precios-historicos/catalogo-especies";
import {
    fechaActualMontevideo,
    fechaHaceTresAnios,
    validarParametrosConsulta,
    type ConsultaHistorica,
} from "@/modulos/informacion-uam/precios-historicos/parametros-consulta";
import type { HistoricoProducto, ProductoSeleccionado } from "@/modulos/informacion-uam/precios-historicos/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Precios históricos | UAM",
    description: "Consulta los precios históricos de productos de la UAM.",
};

type Parametros = {
    species_id?: string | string[];
    producto?: string | string[];
    variedad?: string | string[];
    pais?: string | string[];
    calibre?: string | string[];
    categoria?: string | string[];
    from?: string | string[];
    to?: string | string[];
};

function textoParametro(valor: string | string[] | undefined, alternativa = "") {
    return typeof valor === "string" ? valor : alternativa;
}

function identificadorValido(valor: string | string[] | undefined) {
    return typeof valor === "string" && /^\d+$/.test(valor)
        && Number.isSafeInteger(Number(valor)) && Number(valor) > 0;
}

async function ContenidoPreciosHistoricos({ producto, consulta }: {
    producto: ProductoSeleccionado;
    consulta: ConsultaHistorica;
}) {
    const catalogo = obtenerCatalogoEspeciesHistoricas();
    let historico: HistoricoProducto | null = null;
    let error: string | undefined;
    try {
        historico = await obtenerHistoricoPrecios(consulta);
    } catch (causa) {
        const detalle = causa instanceof Error ? `${causa.name}: ${causa.message}` : String(causa);
        error = detalle.trim() || "Error de carga sin detalle.";
    }
    return (
        <PreciosHistoricos
            producto={historico ? { ...producto, especie: historico.species } : producto}
            historico={historico}
            desde={consulta.desde}
            hasta={consulta.hasta}
            error={error}
            especies={await catalogo}
        />
    );
}

export default async function PaginaPreciosHistoricos({
    searchParams,
}: {
    searchParams: Promise<Parametros>;
}) {
    const parametros = await searchParams;
    const hoy = fechaActualMontevideo();
    const hasta = textoParametro(parametros.to, hoy);
    const desde = parametros.from === undefined ? fechaHaceTresAnios(hoy) : textoParametro(parametros.from);
    const producto: ProductoSeleccionado = {
        id: identificadorValido(parametros.species_id) ? String(Number(parametros.species_id)) : "",
        especie: textoParametro(parametros.producto, "Producto"),
        variedad: textoParametro(parametros.variedad),
        pais: textoParametro(parametros.pais),
        calibre: textoParametro(parametros.calibre),
        categoria: textoParametro(parametros.categoria),
    };
    let error: string | undefined;
    const consulta: ConsultaHistorica = {
        speciesId: Number(parametros.species_id),
        desde,
        hasta,
    };

    if (!identificadorValido(parametros.species_id)) {
        error = "Seleccioná un producto válido desde precios de referencia para consultar su histórico.";
    } else {
        try {
            if (Array.isArray(parametros.from) || Array.isArray(parametros.to)) throw new Error("Fechas repetidas");
            validarParametrosConsulta(consulta);
            if (desde > hoy || hasta > hoy) throw new Error("Fechas futuras");
        } catch {
            error = "Revisá el período: ingresá fechas válidas hasta hoy y una fecha de inicio anterior o igual a la fecha de fin.";
        }
    }
    const claveConsulta = JSON.stringify([producto, desde, hasta]);

    return (
        <main className="flex-1 bg-background text-foreground">
            <div className="contenedor-pagina">
                {error ? (
                    <PreciosHistoricos
                        key={claveConsulta}
                        producto={producto}
                        historico={null}
                        desde={desde}
                        hasta={hasta}
                        error={error}
                    />
                ) : (
                    <Suspense
                        key={claveConsulta}
                        fallback={<PreciosHistoricos producto={producto} historico={null} desde={desde} hasta={hasta} cargando />}
                    >
                        <ContenidoPreciosHistoricos producto={producto} consulta={consulta} />
                    </Suspense>
                )}
            </div>
        </main>
    );
}
