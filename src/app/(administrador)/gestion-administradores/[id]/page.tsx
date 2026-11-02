import { notFound } from "next/navigation";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerPerfilAdministrador } from "@/modulos/usuarios/administradores/acciones/consultas-perfil-administrador";
import PerfilAdministrador from "@/modulos/usuarios/administradores/componentes/perfil-administrador/PerfilAdministrador";

export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
    const sesion = await requerirAdministrador();

    const { id } = await params;
    const administrador = await obtenerPerfilAdministrador(Number(id));

    if (!administrador) {
        notFound();
    }

    return (
        <main>
            {/* Su propia cuenta se modifica desde Mi Perfil, no desde acá */}
            <PerfilAdministrador administrador={administrador} esPropiaCuenta={administrador.usuarioId === sesion.usuarioId} />
        </main>
    );
}