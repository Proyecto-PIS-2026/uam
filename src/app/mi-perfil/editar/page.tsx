import Link from "next/link";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { consultarMiPerfilAdministrador } from "@/modulos/usuarios/administradores/consultar-mi-perfil";
import FormularioEditarMiPerfil from "./FormularioEditarMiPerfil";

export const metadata = { title: "Editar mi perfil | UAM" };
export const dynamic = "force-dynamic";

export default async function PaginaEditarMiPerfilAdministrador() {
    const sesion = await requerirAdministrador();
    const perfil = await consultarMiPerfilAdministrador(sesion.usuarioId);
    return (
        <main className="contenedor-pagina secciones-pagina">
            <Link href="/mi-perfil" className="boton-secundario">Volver a mi perfil</Link>
            <h1 className="titulo-pagina-plano">Editar mi perfil</h1>
            {perfil ? <FormularioEditarMiPerfil perfil={perfil} /> : (
                <p role="alert">No se pudieron encontrar los datos de tu perfil. Intentá nuevamente.</p>
            )}
        </main>
    );
}
