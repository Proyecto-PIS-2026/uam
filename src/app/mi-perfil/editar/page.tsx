import BotonVolver from "@/compartido/BotonVolver";
import HojasDecorativas from "@/compartido/HojasDecorativas";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { consultarMiPerfilAdministrador } from "@/modulos/usuarios/administradores/consultar-mi-perfil";
import FormularioEditarMiPerfil from "./FormularioEditarMiPerfil";
import styles from "@/modulos/usuarios/administradores/componentes/modificar-administrador/FormularioModificarAdministrador.module.css";

export const metadata = { title: "Editar mi perfil | UAM" };
export const dynamic = "force-dynamic";

export default async function PaginaEditarMiPerfilAdministrador() {
    const sesion = await requerirAdministrador();
    const perfil = await consultarMiPerfilAdministrador(sesion.usuarioId);
    return (
        <main className={styles.pagina}>
            <BotonVolver href="/mi-perfil" className={styles.volver}>Volver a mi perfil</BotonVolver>
            <header className={styles.encabezado}>
                <HojasDecorativas />
                <h1 className={styles.titulo}>Editar mi perfil</h1>
            </header>
            {perfil ? <FormularioEditarMiPerfil perfil={perfil} /> : (
                <p className={styles.error} role="alert">No se pudieron encontrar los datos de tu perfil. Intentá nuevamente.</p>
            )}
        </main>
    );
}
