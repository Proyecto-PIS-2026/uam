import { redirect } from "next/navigation";
import { obtenerOperadorActual } from "../../../modulos/usuarios/operadores/operador-actual";
import { requerirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";
import VistaMiMercado from "@/modulos/publicaciones/mi-mercado/componentes/VistaMiMercado";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { leerPublicacionInicialId, type ParametrosMiMercado } from "@/modulos/publicaciones/mi-mercado/parametro-publicacion";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<ParametrosMiMercado> } = {}) {
    const sesion = await requerirOperador();
    if (!autorizado("operador.mercado.acceder", sesion)) redirect("/inicio");
    const operador = await obtenerOperadorActual();
    const publicacionInicialId = leerPublicacionInicialId((await searchParams)?.publicacion);
    if (operador.nombreFantasia === "productor") {
        return <VistaMiMercado publicacionInicialId={publicacionInicialId} />;
    }
    const consulta = publicacionInicialId === null ? "" : `?publicacion=${publicacionInicialId}`;
    redirect(`/mi-mercado/${encodeURIComponent(operador.nombreFantasia)}${consulta}`);
}
