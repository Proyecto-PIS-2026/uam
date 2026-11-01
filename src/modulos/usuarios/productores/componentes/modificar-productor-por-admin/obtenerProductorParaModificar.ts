import { db } from "@/infraestructura/persistencia/prisma/db";

const CODIGOS_PAIS = ["+598", "+595", "+56", "+55", "+54"];

export type ProductorParaModificar = {
    id: number;
    nombre: string;
    fotoPerfil?: string | null;
    codigoPais: string;
    telefono: string;
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

export async function obtenerProductorParaModificar(
    productorId: number,
): Promise<ProductorParaModificar | null> {
    if (!Number.isSafeInteger(productorId) || productorId <= 0) {
        return null;
    }

    const productor = await db.orm.public.Productor
        .select("id", "nombreFantasia", "whatsApp", "fotoPerfil")
        .where({ id: productorId })
        .first();

    if (!productor) {
        return null;
    }

    const { codigoPais, telefono } = separarTelefono(productor.whatsApp);

    return {
        id: productor.id,
        nombre: productor.nombreFantasia,
        fotoPerfil: productor.fotoPerfil,
        codigoPais,
        telefono,
    };
}
