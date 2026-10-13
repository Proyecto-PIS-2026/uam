import { esFechaISO, type ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto, PrecioHistorico, PresentacionHistorica, RegistroHistorico } from "./tipos";

type Objeto = Record<string, unknown>;

function valorRecibido(valor: unknown): string {
    return typeof valor === "number" || valor === undefined ? String(valor) : JSON.stringify(valor);
}

function datoInvalido(ruta: string, motivo: string, valor: unknown): never {
    throw new Error(`Respuesta de precios históricos inválida en ${ruta}: ${motivo}. Valor recibido: ${valorRecibido(valor)}.`);
}

function objeto(valor: unknown, ruta: string): Objeto {
    if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
        datoInvalido(ruta, "se esperaba un objeto", valor);
    }
    return valor as Objeto;
}

function lista(valor: unknown, ruta: string): unknown[] {
    if (!Array.isArray(valor)) datoInvalido(ruta, "se esperaba una lista", valor);
    return valor;
}

function texto(valor: unknown, ruta: string): void {
    if (typeof valor !== "string") datoInvalido(ruta, "se esperaba un texto", valor);
}

function numero(valor: unknown, ruta: string): void {
    if (typeof valor !== "number" || !Number.isFinite(valor)) {
        datoInvalido(ruta, "se esperaba un número finito", valor);
    }
}

function fecha(valor: unknown, ruta: string): void {
    if (!esFechaISO(valor)) {
        datoInvalido(ruta, "se esperaba una fecha real en formato AAAA-MM-DD", valor);
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
        datoInvalido("species_id", "la especie no coincide con la consulta", historico.species_id);
    }

    const errores = Array.isArray(historico.erroresValidacion)
        ? historico.erroresValidacion.filter((error): error is string => typeof error === "string") : [];
    const series: RegistroHistorico[] = [];
    let huboDescartes = false;
    function descartar(causa: unknown, contexto: string) {
        huboDescartes = true;
        errores.push(`Registro descartado (${historico.species}; ${contexto}): ${causa instanceof Error ? causa.message : String(causa)}`);
    }

    for (const [indiceDia, diaValor] of lista(historico.series, "series").entries()) {
        const rutaDia = `series[${indiceDia}]`;
        let dia: Objeto;
        let presentaciones: unknown[];
        try {
            dia = objeto(diaValor, rutaDia);
            fecha(dia.date, `${rutaDia}.date`);
            if (dia.volume_kg !== undefined && dia.volume_kg !== null) {
                numero(dia.volume_kg, `${rutaDia}.volume_kg`);
                if ((dia.volume_kg as number) < 0) datoInvalido(`${rutaDia}.volume_kg`, "el volumen no puede ser negativo", dia.volume_kg);
            }
            presentaciones = lista(dia.presentations, `${rutaDia}.presentations`);
        } catch (causa) {
            const fechaRecibida = diaValor !== null && typeof diaValor === "object" && "date" in diaValor
                ? valorRecibido(diaValor.date) : "fecha no disponible";
            descartar(causa, `fecha: ${fechaRecibida}`);
            continue;
        }

        const presentacionesValidas: PresentacionHistorica[] = [];
        for (const [indicePresentacion, presentacionValor] of presentaciones.entries()) {
            const rutaPresentacion = `${rutaDia}.presentations[${indicePresentacion}]`;
            let presentacion: Objeto;
            let precios: unknown[];
            try {
                presentacion = objeto(presentacionValor, rutaPresentacion);
                for (const campo of ["variety", "caliber", "country", "measure_unit"] as const) {
                    texto(presentacion[campo], `${rutaPresentacion}.${campo}`);
                }
                precios = lista(presentacion.prices, `${rutaPresentacion}.prices`);
            } catch (causa) {
                descartar(causa, `fecha: ${dia.date}; presentación: ${valorRecibido(presentacionValor)}`);
                continue;
            }

            const preciosValidos: PrecioHistorico[] = [];
            for (const [indicePrecio, precioValor] of precios.entries()) {
                const rutaPrecio = `${rutaPresentacion}.prices[${indicePrecio}]`;
                try {
                    const precio = objeto(precioValor, rutaPrecio);
                    texto(precio.category, `${rutaPrecio}.category`);
                    for (const campo of ["min_kg", "max_kg", "min_un", "max_un"] as const) {
                        numero(precio[campo], `${rutaPrecio}.${campo}`);
                        if ((precio[campo] as number) < 0) datoInvalido(`${rutaPrecio}.${campo}`, "el precio no puede ser negativo", precio[campo]);
                    }
                    for (const [minimo, maximo] of [["min_kg", "max_kg"], ["min_un", "max_un"]] as const) {
                        if ((precio[minimo] as number) > (precio[maximo] as number)) {
                            datoInvalido(`${rutaPrecio}.${minimo}`, `el mínimo (${precio[minimo]}) supera al máximo (${precio[maximo]})`, precio[minimo]);
                        }
                    }
                    if (typeof precio.is_reference !== "boolean") {
                        datoInvalido(`${rutaPrecio}.is_reference`, "se esperaba un booleano", precio.is_reference);
                    }
                    preciosValidos.push(precio as PrecioHistorico);
                } catch (causa) {
                    descartar(causa, `fecha: ${dia.date}; variedad: ${presentacion.variety}; calibre: ${presentacion.caliber}; país: ${presentacion.country}; unidad: ${presentacion.measure_unit}; precios: ${valorRecibido(precioValor)}`);
                }
            }
            if (preciosValidos.length > 0 || precios.length === 0) {
                presentacionesValidas.push({ ...presentacion, prices: preciosValidos } as PresentacionHistorica);
            }
        }
        series.push({ ...dia, presentations: presentacionesValidas } as RegistroHistorico);
    }

    return huboDescartes ? { ...historico, series, erroresValidacion: [...new Set(errores)] } as HistoricoProducto : valor as HistoricoProducto;
}
