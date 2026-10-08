import { db } from "@/infraestructura/persistencia/prisma/db";

const CODIGOS_PAIS = ["+598", "+595", "+56", "+55", "+54"];

export type OperadorParaModificar = {
    id: number;
    nombre: string;
    codigoPais: string;
    telefono: string;
    locales: {
        nombre: string;
        naveId: number;
        contrato: string;
    }[];
};

function separarTelefono(whatsApp: string) {
    const codigoPais =
        CODIGOS_PAIS.find((codigo) => whatsApp.startsWith(codigo)) ?? "+598";

    const telefono = whatsApp.startsWith(codigoPais)
        ? whatsApp.slice(codigoPais.length)
        : whatsApp.replace(/^\+/, "");

    return {
        codigoPais,
        telefono,
    };
}

export async function obtenerOperadorParaModificar(
    operadorId: number,
): Promise<OperadorParaModificar | null> {
    if (!Number.isSafeInteger(operadorId) || operadorId <= 0) {
        return null;
    }

    const operador = await db.orm.public.Operador
        .select("id", "nombreFantasia", "whatsApp")
        .include("locales", (locales) =>
            locales.select(
                "numeroLocal",
                "naveId",
                "finContrato",
            ),
        )
        .where({ id: operadorId })
        .first();

    if (!operador) {
        return null;
    }

    const { codigoPais, telefono } = separarTelefono(operador.whatsApp);

    return {
        id: operador.id,
        nombre: operador.nombreFantasia,
        codigoPais,
        telefono,
        locales: operador.locales.map((local) => ({
            nombre: local.numeroLocal,
            naveId: local.naveId,
            contrato: local.finContrato
                ? local.finContrato
                      .toZonedDateTimeISO("America/Montevideo")
                      .toPlainDate()
                      .toString()
                : "",
        })),
    };
}