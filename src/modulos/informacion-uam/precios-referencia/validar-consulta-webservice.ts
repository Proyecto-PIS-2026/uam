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
    if (!Array.isArray(valor) || valor.length === 0) {
        datoInvalido(ruta, "se esperaba una lista no vacía");
    }
    return valor;
}

function texto(valor: unknown, ruta: string): string {
    if (typeof valor !== "string" || valor.trim().length === 0) {
        datoInvalido(ruta, "se esperaba un texto no vacío");
    }
    return valor;
}

function identificador(valor: unknown, ruta: string): void {
    if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor <= 0) {
        datoInvalido(ruta, "se esperaba un identificador entero positivo");
    }
}

function precio(valor: unknown, ruta: string): number {
    if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
        datoInvalido(ruta, "se esperaba un precio positivo y finito");
    }
    return valor;
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

    for (const [indiceTipo, tipoValor] of lista(consulta.types, "types").entries()) {
        const rutaTipo = `types[${indiceTipo}]`;
        const tipo = objeto(tipoValor, rutaTipo);
        identificador(tipo.classification_id, `${rutaTipo}.classification_id`);
        texto(tipo.classification, `${rutaTipo}.classification`);

        for (const [indiceProducto, productoValor] of lista(tipo.products, `${rutaTipo}.products`).entries()) {
            const rutaProducto = `${rutaTipo}.products[${indiceProducto}]`;
            const producto = objeto(productoValor, rutaProducto);
            identificador(producto.species_id, `${rutaProducto}.species_id`);
            texto(producto.species, `${rutaProducto}.species`);

            for (const [indiceVariedad, variedadValor] of lista(producto.varieties, `${rutaProducto}.varieties`).entries()) {
                const rutaVariedad = `${rutaProducto}.varieties[${indiceVariedad}]`;
                const variedad = objeto(variedadValor, rutaVariedad);
                texto(variedad.variety, `${rutaVariedad}.variety`);

                for (const [indicePresentacion, presentacionValor] of lista(
                    variedad.presentations,
                    `${rutaVariedad}.presentations`,
                ).entries()) {
                    const rutaPresentacion = `${rutaVariedad}.presentations[${indicePresentacion}]`;
                    const presentacion = objeto(presentacionValor, rutaPresentacion);
                    texto(presentacion.caliber, `${rutaPresentacion}.caliber`);
                    texto(presentacion.country, `${rutaPresentacion}.country`);
                    texto(presentacion.measure_unit, `${rutaPresentacion}.measure_unit`);

                    for (const [indiceBanda, bandaValor] of lista(presentacion.prices, `${rutaPresentacion}.prices`).entries()) {
                        const rutaBanda = `${rutaPresentacion}.prices[${indiceBanda}]`;
                        const banda = objeto(bandaValor, rutaBanda);
                        texto(banda.category, `${rutaBanda}.category`);
                        const minimoKg = precio(banda.min_kg, `${rutaBanda}.min_kg`);
                        const maximoKg = precio(banda.max_kg, `${rutaBanda}.max_kg`);
                        const minimoUnidad = precio(banda.min_un, `${rutaBanda}.min_un`);
                        const maximoUnidad = precio(banda.max_un, `${rutaBanda}.max_un`);

                        if (minimoKg > maximoKg || minimoUnidad > maximoUnidad) {
                            datoInvalido(rutaBanda, "el precio mínimo supera al máximo");
                        }
                        if (typeof banda.is_reference !== "boolean") {
                            datoInvalido(`${rutaBanda}.is_reference`, "se esperaba un booleano");
                        }
                    }
                }
            }
        }
    }

    return valor as ConsultaPreciosReferencia;
}
