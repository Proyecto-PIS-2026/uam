import { redirect } from "next/navigation";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { RUTA_SESION_FINALIZADA } from "@/modulos/identidad-acceso/autenticacion/rutas-sesion";
import { habilitarCambioContrasena } from "@/modulos/identidad-acceso/cambio-contrasena/configuracion";
import FormularioCambioContrasena from "@/modulos/identidad-acceso/cambio-contrasena/FormularioCambioContrasena";
import BotonVolver from "@/compartido/BotonVolver";
import styles from "@/modulos/identidad-acceso/cambio-contrasena/FormularioCambioContrasena.module.css";

export const metadata = { title: "Cambiar contraseña | UAM" };

export default async function PaginaCambioContrasena() {
    const sesion = await obtenerSesion();
    if (!sesion) redirect(RUTA_SESION_FINALIZADA);
    const volver = sesion.rol === "PRODUCTOR" ? "/mi-perfil/productor" : "/mi-perfil";
    return <main className={styles.pagina}><div className={styles.contenedor}>
        <BotonVolver href={volver} className={styles.volver}>Volver a mi perfil</BotonVolver>
        <header className={styles.encabezado}><h1 className="titulo-pagina-plano">Cambiar contraseña</h1></header>
        {habilitarCambioContrasena ? <FormularioCambioContrasena volver={volver} /> : <p role="status">El cambio de contraseña no está habilitado por el administrador.</p>}
    </div></main>;
}
