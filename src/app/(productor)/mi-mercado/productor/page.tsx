import { redirect } from "next/navigation";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { RUTA_SESION_FINALIZADA } from "@/modulos/identidad-acceso/autenticacion/rutas-sesion";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { obtenerPublicacionesMiMercadoProductor } from "@/modulos/publicaciones/mi-mercado/consultas-mi-mercado-productor";
import MiMercadoProductor from "@/modulos/publicaciones/mi-mercado/componentes/MiMercadoProductor";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Mi mercado de productor | UAM",
};

export default async function PaginaMiMercadoProductor() {
    const sesion = await obtenerSesion();
    if (!sesion) redirect(RUTA_SESION_FINALIZADA);
    if (!autorizado("productor.mercado.acceder", sesion)) redirect("/inicio");

    const { productor, publicaciones } = await obtenerPublicacionesMiMercadoProductor();
    return <MiMercadoProductor key={productor.id} publicaciones={publicaciones} nombreProductor={productor.nombreFantasia} productorId={productor.id} />;
}
