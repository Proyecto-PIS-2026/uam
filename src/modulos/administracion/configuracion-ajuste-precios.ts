import { db } from "../../infraestructura/persistencia/prisma/db";
import { validarImporteAjuste } from "./validar-importe-ajuste";

const NOMBRE_CONFIGURACION = "incremento_precio";

export async function consultarImporteAjuste(): Promise<number> {
    const registro = await db.orm.public.Configuracion
        .where({ nombreConfiguracion: NOMBRE_CONFIGURACION })
        .first();

    if (!registro) {
        throw new Error("No se encontró el importe configurado para el ajuste rápido de precios.");
    }

    return validarImporteAjuste(registro.valorConfiguracion);
}

export async function guardarImporteAjuste(valor: string): Promise<string> {
    const importe = String(validarImporteAjuste(valor));

    await db.transaction(async (tx) => {
        await tx.execute(
            db.raw.sql`
                INSERT INTO public.configuracion ("nombreConfiguracion", "valorConfiguracion")
                VALUES (${NOMBRE_CONFIGURACION}, ${importe})
                ON CONFLICT ("nombreConfiguracion")
                DO UPDATE SET "valorConfiguracion" = EXCLUDED."valorConfiguracion"
            `.affectedCount().build(),
        );
    });

    return importe;
}
