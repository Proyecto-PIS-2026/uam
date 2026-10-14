import { validarParametrosConsulta, type ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto, PresentacionHistorica, RegistroHistorico } from "./tipos";

export type FiltrosHistoricos = {
    variedad?: string;
    pais?: string;
    calibre?: string;
    categoria?: string;
};

function clavePresentacion(presentacion: PresentacionHistorica): string {
    return JSON.stringify([
        presentacion.variety, presentacion.caliber, presentacion.country, presentacion.measure_unit,
    ]);
}

function copiarPresentacion(presentacion: PresentacionHistorica): PresentacionHistorica {
    return { ...presentacion, prices: presentacion.prices.map((precio) => ({ ...precio })) };
}

function copiarRegistro(registro: RegistroHistorico): RegistroHistorico {
    return { ...registro, presentations: registro.presentations.map(copiarPresentacion) };
}

function incorporarRegistro(guardado: RegistroHistorico, recibido: RegistroHistorico): void {
    if (guardado.volume_kg == null && recibido.volume_kg != null) {
        guardado.volume_kg = recibido.volume_kg;
    }

    const presentaciones = new Map(guardado.presentations.map((presentacion) => [
        clavePresentacion(presentacion), presentacion,
    ]));
    for (const presentacion of recibido.presentations) {
        const clave = clavePresentacion(presentacion);
        let existente = presentaciones.get(clave);
        if (!existente) {
            existente = { ...presentacion, prices: [] };
            guardado.presentations.push(existente);
            presentaciones.set(clave, existente);
        }

        const categorias = new Set(existente.prices.map((precio) => precio.category));
        for (const precio of presentacion.prices) {
            if (!categorias.has(precio.category)) {
                existente.prices.push({ ...precio });
                categorias.add(precio.category);
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
        let existente = registros.get(registro.date);
        if (!existente) {
            existente = { ...registro, presentations: [] };
            registros.set(registro.date, existente);
        }
        incorporarRegistro(existente, registro);
    }

    return {
        ...guardado,
        ...(guardado.erroresValidacion !== undefined || recibido.erroresValidacion !== undefined
            ? { erroresValidacion: [...new Set([...(guardado.erroresValidacion ?? []), ...(recibido.erroresValidacion ?? [])])] }
            : {}),
        from: guardado.from < recibido.from ? guardado.from : recibido.from,
        to: guardado.to > recibido.to ? guardado.to : recibido.to,
        series: [...registros.values()].sort((a, b) => a.date.localeCompare(b.date)),
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

    const hayFiltros = [filtros.variedad, filtros.pais, filtros.calibre, filtros.categoria]
        .some((valor) => valor !== undefined);
    const series = historico.series
        .filter((registro) => registro.date >= consulta.desde && registro.date <= consulta.hasta)
        .map((registro) => {
            if (!hayFiltros) return copiarRegistro(registro);

            const presentations = registro.presentations
                .filter((presentacion) => (
                    (filtros.variedad === undefined || presentacion.variety === filtros.variedad)
                    && (filtros.pais === undefined || presentacion.country === filtros.pais)
                    && (filtros.calibre === undefined || presentacion.caliber === filtros.calibre)
                ))
                .map((presentacion) => ({
                    ...presentacion,
                    prices: presentacion.prices
                        .filter((precio) => filtros.categoria === undefined || precio.category === filtros.categoria)
                        .map((precio) => ({ ...precio })),
                }))
                .filter((presentacion) => presentacion.prices.length > 0);
            return { ...registro, presentations };
        })
        .filter((registro) => !hayFiltros || registro.presentations.length > 0);

    return { ...historico, from: consulta.desde, to: consulta.hasta, series };
}
