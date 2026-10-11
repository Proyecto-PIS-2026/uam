import { redirect } from "next/navigation";
import { obtenerOperadorActual } from "../../../modulos/usuarios/operadores/operador-actual";
import { requerirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";
import VistaMiMercado from "@/modulos/publicaciones/mi-mercado/componentes/VistaMiMercado";

export const dynamic = "force-dynamic";

export default async function Page() {
    await requerirOperador();
    const operador = await obtenerOperadorActual();
    if (operador.nombreFantasia === "productor") {
        return <VistaMiMercado />;
    }
    redirect(`/mi-mercado/${encodeURIComponent(operador.nombreFantasia)}`);
}