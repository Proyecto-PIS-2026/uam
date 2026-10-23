import { esFechaISO, validarParametrosConsulta, type ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto, PresentacionHistorica, RegistroHistorico } from "./tipos";
import { textoValorHistorico } from "./valores-historicos";

export type FiltrosHistoricos = {
    variedad?: string;
    pais?: string;
    calibre?: string;
    categoria?: string;
};

function firmaValores(valores: unknown[]): string {
    return JSON.stringify(valores, (_clave, valor: unknown) => {
        if (valor === null || typeof valor !== "object" || Array.isArray(valor)) return valor;
        const objeto = valor as Record<string, unknown>;
        return Object.fromEntries(Object.keys(objeto).sort().map((clave) => [clave, objeto[clave]]));
    });
}

function clavePresentacion(presentacion: PresentacionHistorica): string {
    return firmaValores([
        presentacion.variety, presentacion.caliber, presentacion.country, presentacion.measure_unit,
    ]);
}

function copiarPresentacion(presentacion: PresentacionHistorica): PresentacionHistorica {
    return structuredClone(presentacion);
}

function copiarRegistro(registro: RegistroHistorico): RegistroHistorico {
    return structuredClone(registro);
}

function sinDiagnosticosPublicos(historico: HistoricoProducto): HistoricoProducto {
    const resultado = { ...historico };
    if ("erroresValidacion" in resultado) delete resultado.erroresValidacion;
    return resultado;
}

function incorporarRegistro(guardado: RegistroHistorico, recibido: RegistroHistorico): void {
    if (guardado.volume_kg == null && recibido.volume_kg != null) {
        guardado.volume_kg = structuredClone(recibido.volume_kg);
    }

    const presentaciones = new Map(guardado.presentations.map((presentacion) => [
        clavePresentacion(presentacion), presentacion,
    ]));
    for (const presentacion of recibido.presentations) {
        const clave = clavePresentacion(presentacion);
        let existente = presentaciones.get(clave);
        if (!existente) {
            existente = { ...copiarPresentacion(presentacion), prices: [] };
            guardado.presentations.push(existente);
            presentaciones.set(clave, existente);
        }

        const categorias = new Set(existente.prices.map((precio) => firmaValores([precio.category])));
        for (const precio of presentacion.prices) {
            const categoria = firmaValores([precio.category]);
            if (!categorias.has(categoria)) {
                existente.prices.push(structuredClone(precio));
                categorias.add(categoria);
            }
        }
    }
}

export function fusionarHistoricos(guardado: HistoricoProducto, recibido: HistoricoProducto): HistoricoProducto {
    if (guardado.species_id !== recibido.species_id) {
        throw new Error("No se pueden fusionar históricos de distintas especies.");
    }

    const registros = new Map<string, RegistroHistorico>();
    for (const registro of [...guardado.series, ...recibido.series]) {
        const clave = firmaValores([registro.date]);
        let existente = registros.get(clave);
        if (!existente) {
            existente = { ...copiarRegistro(registro), presentations: [] };
            registros.set(clave, existente);
        }
        incorporarRegistro(existente, registro);
    }

    return {
        ...sinDiagnosticosPublicos(guardado),
        from: guardado.from < recibido.from ? guardado.from : recibido.from,
        to: guardado.to > recibido.to ? guardado.to : recibido.to,
        series: [...registros.values()].sort((a, b) => textoValorHistorico(a.date).localeCompare(textoValorHistorico(b.date))),
    };
}

export function filtrarHistorico(
    historico: HistoricoProducto,
    consulta: ConsultaHistorica,
    filtros: FiltrosHistoricos = {},
): HistoricoProducto {
    validarParametrosConsulta(consulta);
    if (historico.species_id !== consulta.speciesId) {
        throw new Error("La especie del histórico no coincide con la consulta.");
    }

    const desdeDisponible = historico.from > consulta.desde ? historico.from : consulta.desde;
    const hastaDisponible = historico.to < consulta.hasta ? historico.to : consulta.hasta;
    const hayCobertura = desdeDisponible <= hastaDisponible;

    const hayFiltros = [filtros.variedad, filtros.pais, filtros.calibre, filtros.categoria]
        .some((valor) => valor !== undefined);
    const series = (hayCobertura ? historico.series : [])
        .filter((registro) => !esFechaISO(registro.date) || registro.date >= consulta.desde && registro.date <= consulta.hasta)
        .map((registro) => {
            if (!hayFiltros) return copiarRegistro(registro);

            const presentations = registro.presentations
                .filter((presentacion) => (
                    (filtros.variedad === undefined || textoValorHistorico(presentacion.variety) === filtros.variedad)
                    && (filtros.pais === undefined || textoValorHistorico(presentacion.country) === filtros.pais)
                    && (filtros.calibre === undefined || textoValorHistorico(presentacion.caliber) === filtros.calibre)
                ))
                .map((presentacion) => ({
                    ...copiarPresentacion(presentacion),
                    prices: presentacion.prices
                        .filter((precio) => filtros.categoria === undefined || textoValorHistorico(precio.category) === filtros.categoria)
                        .map((precio) => structuredClone(precio)),
                }))
                .filter((presentacion) => presentacion.prices.length > 0);
            return { ...copiarRegistro(registro), presentations };
        })
        .filter((registro) => !hayFiltros || registro.presentations.length > 0);

    return {
        ...sinDiagnosticosPublicos(historico),
        from: hayCobertura ? desdeDisponible : consulta.desde,
        to: hayCobertura ? hastaDisponible : consulta.hasta,
        series,
    };
}
