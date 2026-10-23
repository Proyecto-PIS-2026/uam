import { leerHistorico } from "./almacen-historicos";
import { validarParametrosConsulta, type ConsultaHistorica } from "./parametros-consulta";
import { actualizarHistoricoEspecie } from "./sincronizar-historicos";
import type { HistoricoProducto, OpcionesFiltrosHistoricos } from "./tipos";
import { filtrarHistorico, type FiltrosHistoricos } from "./transformar-historico";
import { textoValorHistorico } from "./valores-historicos";

export async function obtenerHistoricoPreciosConFiltros(consulta: ConsultaHistorica, filtros: FiltrosHistoricos = {}): Promise<{
    historico: HistoricoProducto;
    opcionesFiltros: OpcionesFiltrosHistoricos;
}> {
    validarParametrosConsulta(consulta);
    await actualizarHistoricoEspecie(consulta.speciesId);
    const estado = await leerHistorico(consulta.speciesId);
    if (!estado) throw new Error("No se pudo obtener el histórico de esta especie. Podés volver a intentar.");
    const periodo = filtrarHistorico(estado.historico, consulta);
    const presentaciones = periodo.series.flatMap((dia) => dia.presentations);
    const unicos = (valores: unknown[]) => [...new Set(valores.map(textoValorHistorico))].sort(new Intl.Collator("es", { sensitivity: "base", numeric: true }).compare);
    return {
        historico: filtrarHistorico(periodo, consulta, filtros),
        opcionesFiltros: {
            variedades: unicos(presentaciones.map((presentacion) => presentacion.variety)),
            paises: unicos(presentaciones.map((presentacion) => presentacion.country)),
            calibres: unicos(presentaciones.map((presentacion) => presentacion.caliber)),
            categorias: unicos(presentaciones.flatMap((presentacion) => presentacion.prices.map((precio) => precio.category))),
        },
    };
}
