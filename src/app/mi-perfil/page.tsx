import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { RUTA_SESION_FINALIZADA } from "@/modulos/identidad-acceso/autenticacion/rutas-sesion";
import { habilitarCambioContrasena } from "@/modulos/identidad-acceso/cambio-contrasena/configuracion";
import { obtenerRutaPrincipal } from "@/modulos/identidad-acceso/autorizacion/rutas";
import styles from "@/modulos/usuarios/productores/componentes/modificar-productor-por-admin/FormularioModificarProductor.module.css";

export const metadata = { title: "Mi perfil | UAM" };

export default async function PaginaMiPerfil() {
    const sesion = await obtenerSesion();
    if (!sesion) redirect(RUTA_SESION_FINALIZADA);
    if (sesion.rol === "PRODUCTOR") redirect("/mi-perfil/productor");
    const usuario = await db.orm.public.Usuario.where({ id: sesion.usuarioId, rol: sesion.rol }).select("username").first();
    if (!usuario) notFound();
    return <main className={styles.pagina}><div className={styles.contenedor}>
        <Link href={obtenerRutaPrincipal(sesion.rol)}>Volver</Link>
        <header className={styles.encabezado}><h1 className={styles.titulo}>Mi perfil</h1></header>
        <section className={styles.seccion} aria-label="Mi cuenta">
            <p><strong>Usuario:</strong> {usuario.username}</p>
            {habilitarCambioContrasena && <Link href="/mi-perfil/cambiar-contrasena" className="boton-secundario">Cambiar contraseña</Link>}
        </section>
    </div></main>;
}
