import type { ConsultaPreciosReferencia } from "./consultas-precios-referencia";

type Registro = Record<string, unknown>;

function datoInvalido(ruta: string, motivo: string): never {
    throw new Error(`Respuesta de precios de referencia inválida en ${ruta}: ${motivo}`);
}

function objeto(valor: unknown, ruta: string): Registro {
    if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
        datoInvalido(ruta, "se esperaba un objeto");
    }
    return valor as Registro;
}

function lista(valor: unknown, ruta: string): unknown[] {
    if (!Array.isArray(valor)) {
        datoInvalido(ruta, "se esperaba una lista");
    }
    return valor;
}

function texto(valor: unknown, ruta: string): string {
    if (typeof valor !== "string" || valor.trim().length === 0) {
        datoInvalido(ruta, "se esperaba un texto no vacío");
    }
    return valor;
}

function exigirCampos(registro: Registro, campos: readonly string[], ruta: string): void {
    for (const campo of campos) {
        if (!Object.hasOwn(registro, campo)) datoInvalido(`${ruta}.${campo}`, "falta el campo requerido");
    }
}

function procesarLista(
    originales: unknown[],
    ruta: string,
    campos: readonly string[],
    procesar?: (registro: Registro, ruta: string) => Registro,
): unknown[] {
    const resultado: Registro[] = [];
    let huboDescartes = false;
    for (const [indice, valor] of originales.entries()) {
        const rutaRegistro = `${ruta}[${indice}]`;
        try {
            const registro = objeto(valor, rutaRegistro);
            exigirCampos(registro, campos, rutaRegistro);
            const procesado = procesar ? procesar(registro, rutaRegistro) : registro;
            resultado.push(procesado);
            huboDescartes ||= procesado !== registro;
        } catch {
            huboDescartes = true;
        }
    }
    return huboDescartes ? resultado : originales;
}

function procesarHijos(
    registro: Registro,
    campo: string,
    ruta: string,
    campos: readonly string[],
    procesar?: (registro: Registro, ruta: string) => Registro,
): Registro {
    const rutaHijos = `${ruta}.${campo}`;
    const originales = lista(registro[campo], rutaHijos);
    const hijos = procesarLista(originales, rutaHijos, campos, procesar);
    return hijos === originales ? registro : { ...registro, [campo]: hijos };
}

function fechaRelevamiento(valor: unknown): void {
    const fecha = texto(valor, "survey_date");
    const instante = Date.parse(`${fecha}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(instante) || new Date(instante).toISOString().slice(0, 10) !== fecha) {
        datoInvalido("survey_date", "se esperaba una fecha real en formato AAAA-MM-DD");
    }
}

export function validarConsultaPreciosReferencia(valor: unknown): ConsultaPreciosReferencia {
    const consulta = objeto(valor, "$");
    fechaRelevamiento(consulta.survey_date);

    const originales = lista(consulta.types, "types");
    const tipos = procesarLista(originales, "types", ["classification_id", "classification", "products"], (tipo, rutaTipo) =>
        procesarHijos(tipo, "products", rutaTipo, ["species_id", "species", "varieties"], (producto, rutaProducto) => {
            if (typeof producto.species_id !== "number" || !Number.isFinite(producto.species_id)) {
                datoInvalido(`${rutaProducto}.species_id`, "se esperaba un número finito");
            }
            return procesarHijos(producto, "varieties", rutaProducto, ["variety", "presentations"], (variedad, rutaVariedad) =>
                procesarHijos(variedad, "presentations", rutaVariedad, ["caliber", "country", "measure_unit", "prices"], (presentacion, rutaPresentacion) =>
                    procesarHijos(presentacion, "prices", rutaPresentacion, ["category", "min_kg", "max_kg", "min_un", "max_un", "is_reference"]),
                ),
            );
        }),
    );
    if (originales.length > 0 && tipos.length === 0) {
        datoInvalido("types", "no contiene clasificaciones con una estructura procesable");
    }

    return (tipos === originales ? consulta : { ...consulta, types: tipos }) as ConsultaPreciosReferencia;
}
