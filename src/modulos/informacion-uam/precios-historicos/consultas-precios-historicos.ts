import { leerHistorico } from "./almacen-historicos";
import { validarParametrosConsulta, type ConsultaHistorica } from "./parametros-consulta";
import { actualizarHistoricosPrecios } from "./sincronizar-historicos";
import type { HistoricoProducto, OpcionesFiltrosHistoricos } from "./tipos";
import { filtrarHistorico, type FiltrosHistoricos } from "./transformar-historico";

export { inicializarHistoricosPrecios, actualizarHistoricosPrecios } from "./sincronizar-historicos";
export type { ResultadoSincronizacionHistorica } from "./sincronizar-historicos";

export async function obtenerHistoricoPreciosConFiltros(consulta: ConsultaHistorica, filtros: FiltrosHistoricos = {}): Promise<{
    historico: HistoricoProducto;
    opcionesFiltros: OpcionesFiltrosHistoricos;
}> {
    validarParametrosConsulta(consulta);
    const resultado = await actualizarHistoricosPrecios();
    const errorFuente = resultado.errores.find((error) => error.speciesId === consulta.speciesId && error.mensaje.startsWith("La fuente"));
    if (errorFuente) throw new Error(errorFuente.mensaje);
    const estado = await leerHistorico(consulta.speciesId);
    if (!estado) throw new Error("El administrador todavía no cargó el histórico de esta especie.");
    const periodo = filtrarHistorico(estado.historico, consulta);
    const presentaciones = periodo.series.flatMap((dia) => dia.presentations);
    const unicos = (valores: string[]) => [...new Set(valores)].sort(new Intl.Collator("es", { sensitivity: "base", numeric: true }).compare);
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

export async function obtenerHistoricoPrecios(consulta: ConsultaHistorica, filtros: FiltrosHistoricos = {}): Promise<HistoricoProducto> {
    return (await obtenerHistoricoPreciosConFiltros(consulta, filtros)).historico;
}
