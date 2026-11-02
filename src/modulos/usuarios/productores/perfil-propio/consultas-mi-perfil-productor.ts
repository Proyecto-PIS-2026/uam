import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirProductor } from "@/modulos/identidad-acceso/autorizacion/controles";
import { separarTelefono, type ProductorParaModificar } from "../componentes/modificar-productor-por-admin/obtenerProductorParaModificar";

export async function obtenerMiPerfilProductor(): Promise<ProductorParaModificar | null> {
    const sesion = await exigirProductor();
    const productor = await db.orm.public.Productor
        .select("id", "nombreFantasia", "whatsApp", "fotoPerfil")
        .where({ usuarioId: sesion.usuarioId })
        .first();

    if (!productor) return null;
    return {
        id: productor.id,
        nombre: productor.nombreFantasia,
        fotoPerfil: productor.fotoPerfil,
        ...separarTelefono(productor.whatsApp),
    };
}
