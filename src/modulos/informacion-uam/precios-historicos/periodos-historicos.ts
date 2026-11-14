import { fechaHaceTresAnios, validarParametrosConsulta, type ConsultaHistorica } from "./parametros-consulta";

function cabeEnTresAnios(desde: string, hasta: string): boolean {
    const diferencia = Number(hasta.slice(0, 4)) - Number(desde.slice(0, 4));
    if (diferencia !== 3) return diferencia < 3;
    const aniversario = desde.slice(5) === "02-29" ? "02-28" : desde.slice(5);
    return hasta.slice(5) <= aniversario;
}

function diaSiguiente(fecha: string): string {
    const siguiente = new Date(`${fecha}T00:00:00.000Z`);
    siguiente.setUTCDate(siguiente.getUTCDate() + 1);
    return siguiente.toISOString().slice(0, 10);
}

export function dividirPeriodoHistorico(consulta: ConsultaHistorica): ConsultaHistorica[] {
    validarParametrosConsulta(consulta);
    const periodos: ConsultaHistorica[] = [];
    let hasta = consulta.hasta;

    while (!cabeEnTresAnios(consulta.desde, hasta)) {
        const corte = fechaHaceTresAnios(hasta);
        // Los límites son inclusivos; el día siguiente evita superponer tramos y exceder tres años un 29 de febrero.
        periodos.push({ ...consulta, desde: diaSiguiente(corte), hasta });
        hasta = corte;
    }
    periodos.push({ ...consulta, hasta });
    return periodos.reverse();
}
