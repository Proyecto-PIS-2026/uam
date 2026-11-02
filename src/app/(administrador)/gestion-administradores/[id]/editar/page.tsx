import { notFound, redirect } from "next/navigation";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";

import FormularioModificarAdministrador from "@/modulos/usuarios/administradores/componentes/modificar-administrador/FormularioModificarAdministrador";
import { obtenerAdministradorParaModificar } from "@/modulos/usuarios/administradores/componentes/modificar-administrador/obtenerAdministradorParaModificar";

export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
    const sesion = await requerirAdministrador();

    const { id } = await params;
    const administrador = await obtenerAdministradorParaModificar(Number(id));

    if (!administrador) {
        notFound();
    }

    // Criterio 1: desde acá se modifica otro administrador; la propia cuenta, desde Mi perfil (BP-11.1, ruta provisoria)
    if (administrador.usuarioId === sesion.usuarioId) {
        redirect("/mi-perfil");
    }

    return (
        <main>
            <FormularioModificarAdministrador administrador={administrador} />
        </main>
    );
}