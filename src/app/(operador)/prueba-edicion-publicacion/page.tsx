import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

import PruebaEdicionPublicacion from "../../../modulos/publicaciones/operadores/componentes/PruebaEdicionPublicacion";
import { obtenerOpcionesEdicionPublicacion } from "../../../modulos/publicaciones/operadores/consultas-edicion-publicacion";

export default async function Page() {
    const sesion = await obtenerSesion();
    if (!sesion) redirect("/iniciar-sesion");
    if (!autorizado("operador.mercado.acceder", sesion)) redirect("/inicio");

    const opciones = await obtenerOpcionesEdicionPublicacion();
    return <PruebaEdicionPublicacion opciones={opciones} />;
}
