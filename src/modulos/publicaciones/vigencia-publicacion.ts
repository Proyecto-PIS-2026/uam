export type ResultadoValidacionVigencia =
    | { esValido: true; fechaVigencia: string | null }
    | { esValido: false; error: string };

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function validarFechaVigencia(valor: unknown): ResultadoValidacionVigencia {
    if (valor === undefined || valor === null || valor === "") {
        return { esValido: true, fechaVigencia: null };
    }

    if (typeof valor !== "string" || !REGEX_FECHA.test(valor)) {
        return { esValido: false, error: "La fecha de vigencia debe tener el formato AAAA-MM-DD." };
    }

    let plainDate: Temporal.PlainDate;
    try {
        plainDate = Temporal.PlainDate.from(valor);
    } catch {
        return { esValido: false, error: "La fecha de vigencia no es una fecha válida." };
    }

    const hoy = Temporal.Now.plainDateISO("America/Montevideo");
    if (Temporal.PlainDate.compare(plainDate, hoy) < 0) {
        return { esValido: false, error: "La fecha de vigencia no puede ser anterior a la fecha actual." };
    }

    return { esValido: true, fechaVigencia: valor };
}

export function convertirFechaVigenciaAInstant(fechaVigencia: string | null | undefined): Temporal.Instant | null {
    if (!fechaVigencia) return null;
    try {
        return Temporal.PlainDate.from(fechaVigencia)
            .toPlainDateTime({ hour: 23, minute: 59, second: 59 })
            .toZonedDateTime("America/Montevideo")
            .toInstant();
    } catch {
        return null;
    }
}

export function convertirInstantAFechaVigencia(
    instant: { readonly epochNanoseconds: bigint } | null | undefined
): string | null {
    if (!instant) return null;

    try {
        return Temporal.Instant
            .fromEpochNanoseconds(instant.epochNanoseconds)
            .toZonedDateTimeISO("America/Montevideo")
            .toPlainDate()
            .toString();
    } catch {
        return null;
    }
}

export function esPublicacionVencida(
    fechaVigencia: { readonly epochNanoseconds: bigint } | null | undefined
): boolean {
    if (!fechaVigencia) return false;

    const instant = Temporal.Instant.fromEpochNanoseconds(
        fechaVigencia.epochNanoseconds
    );

    return Temporal.Instant.compare(instant, Temporal.Now.instant()) < 0;
}