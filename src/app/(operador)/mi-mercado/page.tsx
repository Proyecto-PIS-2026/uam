import { redirect } from "next/navigation";
import { obtenerOperadorActual } from "../../../modulos/usuarios/operadores/operador-actual";
import { requerirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";
import VistaMiMercado from "@/modulos/publicaciones/mi-mercado/componentes/VistaMiMercado";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";

export const dynamic = "force-dynamic";

export default async function Page() {
    const sesion = await requerirOperador();
    if (!autorizado("operador.mercado.acceder", sesion)) redirect("/inicio");
    const operador = await obtenerOperadorActual();
    if (operador.nombreFantasia === "productor") {
        return <VistaMiMercado />;
    }
    redirect(`/mi-mercado/${encodeURIComponent(operador.nombreFantasia)}`);
}