import { redirect } from "next/navigation";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";

export const metadata = {
    title: "Mi mercado de productor | UAM",
};

export default async function PaginaMiMercadoProductor() {
    const sesion = await obtenerSesion();
    if (!sesion) redirect("/iniciar-sesion");
    if (!autorizado("productor.mercado.acceder", sesion)) redirect("/inicio");

    return (
        <main className="contenedor-pagina secciones-pagina flex-1">
            <h1 className="text-3xl font-bold">Mi mercado</h1>
            <p>Mi mercado de productor aún no está implementado.</p>
        </main>
    );
}
