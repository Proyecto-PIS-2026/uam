export type ConsultaHistorica = {
    speciesId: number;
    desde: string;
    hasta: string;
};

export function esFechaISO(valor: unknown): valor is string {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return false;
    }

    const instante = Date.parse(`${valor}T00:00:00.000Z`);
    return Number.isFinite(instante) && new Date(instante).toISOString().slice(0, 10) === valor;
}

export function fechaActualMontevideo(fecha = new Date()): string {
    const partes = new Intl.DateTimeFormat("en", {
        timeZone: "America/Montevideo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(fecha);

    const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((valor) => valor.type === tipo)!.value;
    return `${parte("year").padStart(4, "0")}-${parte("month")}-${parte("day")}`;
}

export function fechaHaceTresAnios(fecha: string): string {
    if (!esFechaISO(fecha)) {
        throw new Error("La fecha debe ser una fecha real en formato AAAA-MM-DD.");
    }

    const [anio, mes, dia] = fecha.split("-").map(Number);
    const anioHistorico = anio - 3;
    if (anioHistorico < 0) {
        throw new Error("La fecha de hace tres años debe poder expresarse en formato AAAA-MM-DD.");
    }

    const bisiesto = anioHistorico % 4 === 0 && (anioHistorico % 100 !== 0 || anioHistorico % 400 === 0);
    const diasPorMes = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return `${String(anioHistorico).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, diasPorMes[mes - 1])).padStart(2, "0")}`;
}

export function validarParametrosConsulta(consulta: ConsultaHistorica): void {
    if (!Number.isSafeInteger(consulta.speciesId) || consulta.speciesId <= 0) {
        throw new Error("El parámetro speciesId debe ser un identificador entero positivo.");
    }

    for (const campo of ["desde", "hasta"] as const) {
        if (!esFechaISO(consulta[campo])) {
            throw new Error(`El parámetro ${campo} debe ser una fecha real en formato AAAA-MM-DD.`);
        }
    }

    if (consulta.desde > consulta.hasta) {
        throw new Error("La fecha desde no puede ser posterior a la fecha hasta.");
    }
}
