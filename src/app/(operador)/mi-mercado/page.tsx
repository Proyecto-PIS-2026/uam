import { redirect } from "next/navigation";
import { obtenerOperadorActual } from "../../../modulos/usuarios/operadores/operador-actual";

import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";

export const dynamic = "force-dynamic";

export default async function Page() {
    const sesion = await obtenerSesion();
    if (!sesion) redirect("/iniciar-sesion");
    if (!autorizado("operador.mercado.acceder", sesion)) redirect("/inicio");

    const operador = await obtenerOperadorActual();
    redirect(`/mi-mercado/${encodeURIComponent(operador.nombreFantasia)}`);
}
