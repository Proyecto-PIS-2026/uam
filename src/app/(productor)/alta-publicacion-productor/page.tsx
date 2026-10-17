import AltaPublicacionProductor from "@/modulos/publicaciones/productores/AltaPublicacionProductor";
import { notFound, redirect } from "next/navigation";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { requerirProductor } from "@/modulos/identidad-acceso/autorizacion/controles";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";

export const dynamic = "force-dynamic";

export default async function Page() {
    const sesion = await requerirProductor();
    const productor = await db.orm.public.Productor.where({ usuarioId: sesion.usuarioId }).select("id", "usuarioId").first();
    if (!productor) notFound();
    if (!autorizado("productor.publicacion.crear", sesion, productor)) redirect("/inicio");
    return <AltaPublicacionProductor productorId={productor.id} />;
}
