import { esFechaISO, type ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto } from "./tipos";

type Objeto = Record<string, unknown>;

function datoInvalido(ruta: string, motivo: string): never {
    throw new Error(`Respuesta de precios históricos inválida en ${ruta}: ${motivo}.`);
}

function objeto(valor: unknown, ruta: string): Objeto {
    if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
        datoInvalido(ruta, "se esperaba un objeto");
    }
    return valor as Objeto;
}

function lista(valor: unknown, ruta: string): unknown[] {
    if (!Array.isArray(valor)) datoInvalido(ruta, "se esperaba una lista");
    return valor;
}

function texto(valor: unknown, ruta: string): void {
    if (typeof valor !== "string") datoInvalido(ruta, "se esperaba un texto");
}

function numero(valor: unknown, ruta: string): void {
    if (typeof valor !== "number" || !Number.isFinite(valor)) {
        datoInvalido(ruta, "se esperaba un número finito");
    }
}

function fecha(valor: unknown, ruta: string): void {
    if (!esFechaISO(valor)) {
        datoInvalido(ruta, "se esperaba una fecha real en formato AAAA-MM-DD");
    }
}

export function validarHistoricoProducto(valor: unknown, consulta?: ConsultaHistorica): HistoricoProducto {
    const historico = objeto(valor, "$");
    numero(historico.classification_id, "classification_id");
    texto(historico.classification, "classification");
    numero(historico.species_id, "species_id");
    texto(historico.species, "species");
    fecha(historico.from, "from");
    fecha(historico.to, "to");

    if (consulta && historico.species_id !== consulta.speciesId) {
        datoInvalido("species_id", "la especie no coincide con la consulta");
    }

    for (const [indiceDia, diaValor] of lista(historico.series, "series").entries()) {
        const rutaDia = `series[${indiceDia}]`;
        const dia = objeto(diaValor, rutaDia);
        fecha(dia.date, `${rutaDia}.date`);
        if (dia.volume_kg !== undefined && dia.volume_kg !== null) {
            numero(dia.volume_kg, `${rutaDia}.volume_kg`);
        }

        for (const [indicePresentacion, presentacionValor] of lista(dia.presentations, `${rutaDia}.presentations`).entries()) {
            const rutaPresentacion = `${rutaDia}.presentations[${indicePresentacion}]`;
            const presentacion = objeto(presentacionValor, rutaPresentacion);
            for (const campo of ["variety", "caliber", "country", "measure_unit"] as const) {
                texto(presentacion[campo], `${rutaPresentacion}.${campo}`);
            }

            for (const [indicePrecio, precioValor] of lista(presentacion.prices, `${rutaPresentacion}.prices`).entries()) {
                const rutaPrecio = `${rutaPresentacion}.prices[${indicePrecio}]`;
                const precio = objeto(precioValor, rutaPrecio);
                texto(precio.category, `${rutaPrecio}.category`);
                for (const campo of ["min_kg", "max_kg", "min_un", "max_un"] as const) {
                    numero(precio[campo], `${rutaPrecio}.${campo}`);
                }
                if (typeof precio.is_reference !== "boolean") {
                    datoInvalido(`${rutaPrecio}.is_reference`, "se esperaba un booleano");
                }
            }
        }
    }

    return valor as HistoricoProducto;
}
