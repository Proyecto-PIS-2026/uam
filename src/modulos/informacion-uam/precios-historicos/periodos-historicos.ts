import { Temporal } from "temporal-polyfill";
import { validarParametrosConsulta, type ConsultaHistorica } from "./parametros-consulta";

const ANIOS_MAXIMOS_POR_PEDIDO = 2;

function cabeEnUnPedido(desde: string, hasta: string): boolean {
    const limite = Temporal.PlainDate.from(desde).add({ years: ANIOS_MAXIMOS_POR_PEDIDO });
    return Temporal.PlainDate.compare(Temporal.PlainDate.from(hasta), limite) <= 0;
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

    while (!cabeEnUnPedido(consulta.desde, hasta)) {
        const corte = Temporal.PlainDate.from(hasta).subtract({ years: ANIOS_MAXIMOS_POR_PEDIDO }).toString();
        // Los límites son inclusivos; el día siguiente evita superponer tramos y exceder dos años un 29 de febrero.
        periodos.push({ ...consulta, desde: diaSiguiente(corte), hasta });
        hasta = corte;
    }
    periodos.push({ ...consulta, hasta });
    return periodos.reverse();
}
