import { notFound } from "next/navigation";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerPerfilAdministradorPorUsuario } from "@/modulos/usuarios/administradores/acciones/consultas-perfil-administrador";
import FormularioModificarAdministrador from "@/modulos/usuarios/administradores/componentes/modificar-administrador/FormularioModificarAdministrador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modificar mi perfil | UAM" };

export default async function PaginaModificarMiPerfilAdministrador() {
    const sesion = await requerirAdministrador();
    const administrador = await obtenerPerfilAdministradorPorUsuario(sesion.usuarioId);

    if (!administrador) {
        notFound();
    }

    return (
        <main>
            <FormularioModificarAdministrador administrador={administrador} perfilPropio />
        </main>
    );
}