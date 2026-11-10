import { esFechaISO, type ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto } from "./tipos";

type Objeto = Record<string, unknown>;

function valorRecibido(valor: unknown): string {
    if (valor === null || typeof valor === "number" || typeof valor === "boolean" || valor === undefined) return String(valor);
    if (typeof valor === "string") return JSON.stringify(valor.length > 200 ? valor.slice(0, 200) + "…" : valor);
    return Array.isArray(valor) ? "[lista]" : "[objeto]";
}

function datoInvalido(ruta: string, motivo: string, valor: unknown): never {
    throw new Error(`Respuesta de precios históricos inválida en ${ruta}: ${motivo}. Valor recibido: ${valorRecibido(valor)}.`);
}

function objeto(valor: unknown, ruta: string): Objeto {
    if (valor === null || typeof valor !== "object" || Array.isArray(valor)) datoInvalido(ruta, "se esperaba un objeto", valor);
    return valor as Objeto;
}

function lista(valor: unknown, ruta: string): unknown[] {
    if (!Array.isArray(valor)) datoInvalido(ruta, "se esperaba una lista", valor);
    return valor;
}

function exigirCampos(registro: Objeto, campos: readonly string[], ruta: string): void {
    for (const campo of campos) {
        if (!Object.hasOwn(registro, campo)) datoInvalido(`${ruta}.${campo}`, "falta el campo requerido", undefined);
    }
}

function numero(valor: unknown, ruta: string): void {
    if (typeof valor !== "number" || !Number.isFinite(valor)) datoInvalido(ruta, "se esperaba un número finito", valor);
}

function fecha(valor: unknown, ruta: string): void {
    if (!esFechaISO(valor)) datoInvalido(ruta, "se esperaba una fecha real en formato AAAA-MM-DD", valor);
}

export function validarHistoricoProducto(valor: unknown, consulta?: ConsultaHistorica): HistoricoProducto {
    const historico = objeto(valor, "$");
    numero(historico.species_id, "species_id");
    fecha(historico.from, "from");
    fecha(historico.to, "to");
    if (consulta && historico.species_id !== consulta.speciesId) datoInvalido("species_id", "la especie no coincide con la consulta", historico.species_id);
    const originales = lista(historico.series, "series");
    const series: Objeto[] = [];
    let huboDescartes = false;

    for (const [indiceDia, diaValor] of originales.entries()) {
        const rutaDia = `series[${indiceDia}]`;
        let dia: Objeto;
        let presentaciones: unknown[];
        try {
            dia = objeto(diaValor, rutaDia);
            exigirCampos(dia, ["date", "presentations"], rutaDia);
            presentaciones = lista(dia.presentations, `${rutaDia}.presentations`);
        } catch {
            huboDescartes = true;
            continue;
        }
        const presentacionesValidas: Objeto[] = [];
        let cambioDia = false;

        for (const [indicePresentacion, presentacionValor] of presentaciones.entries()) {
            const rutaPresentacion = `${rutaDia}.presentations[${indicePresentacion}]`;
            let presentacion: Objeto;
            let precios: unknown[];
            try {
                presentacion = objeto(presentacionValor, rutaPresentacion);
                exigirCampos(presentacion, ["variety", "caliber", "country", "measure_unit", "prices"], rutaPresentacion);
                precios = lista(presentacion.prices, `${rutaPresentacion}.prices`);
            } catch {
                cambioDia = true;
                continue;
            }
            const preciosValidos: Objeto[] = [];
            let cambioPresentacion = false;

            for (const [indicePrecio, precioValor] of precios.entries()) {
                const rutaPrecio = `${rutaPresentacion}.prices[${indicePrecio}]`;
                let precio: Objeto;
                try {
                    precio = objeto(precioValor, rutaPrecio);
                    exigirCampos(precio, ["category", "min_kg", "max_kg", "min_un", "max_un", "is_reference"], rutaPrecio);
                } catch {
                    cambioPresentacion = true;
                    continue;
                }
                preciosValidos.push(precio);
            }
            presentacionesValidas.push(cambioPresentacion ? { ...presentacion, prices: preciosValidos } : presentacion);
            cambioDia ||= cambioPresentacion;
        }
        series.push(cambioDia ? { ...dia, presentations: presentacionesValidas } : dia);
        huboDescartes ||= cambioDia;
    }
    if (originales.length > 0 && series.length === 0) datoInvalido("series", "no contiene días con una estructura procesable", historico.series);
    let resultado = huboDescartes ? { ...historico, series } : historico;
    if ("erroresValidacion" in resultado) {
        if (resultado === historico) resultado = { ...historico };
        delete resultado.erroresValidacion;
    }
    return resultado as HistoricoProducto;
}
