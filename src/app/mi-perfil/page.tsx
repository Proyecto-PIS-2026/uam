import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { RUTA_SESION_FINALIZADA } from "@/modulos/identidad-acceso/autenticacion/rutas-sesion";
import { estaHabilitadoCambioContrasena } from "@/modulos/identidad-acceso/cambio-contrasena/configuracion";
import { obtenerPerfilPropioOperador } from "@/modulos/usuarios/operadores/consultasPerfilPropio";
import PerfilPropioOperador from "@/modulos/usuarios/operadores/componentes/perfil-propio-operador/PerfilPropioOperador";
import { consultarMiPerfilAdministrador } from "@/modulos/usuarios/administradores/consultar-mi-perfil";
import styles from "@/modulos/usuarios/productores/componentes/modificar-productor-por-admin/FormularioModificarProductor.module.css";

export const metadata = { title: "Mi perfil | UAM" };
export const dynamic = "force-dynamic";

export default async function PaginaMiPerfil() {
    const sesion = await obtenerSesion();
    if (!sesion) redirect(RUTA_SESION_FINALIZADA);

    // Mantener intactas las funcionalidades de otros roles ya fusionadas en develop.
    if (sesion.rol === "PRODUCTOR") redirect("/mi-perfil/productor");
    const habilitarCambioContrasena = await estaHabilitadoCambioContrasena();
    if (sesion.rol === "OPERADOR") {
        const perfil = await obtenerPerfilPropioOperador();
        return <PerfilPropioOperador perfil={perfil} cambioContrasenaHabilitado={habilitarCambioContrasena} />;
    }

    const perfil = await consultarMiPerfilAdministrador(sesion.usuarioId);

    return (
        <main className={styles.pagina}>
            <div className={styles.contenedor}>
                <Link href="/administracion">Volver al panel administrativo</Link>
                <header className={styles.encabezado}>
                    <h1 className={styles.titulo}>Mi perfil</h1>
                    <p>Información de mi cuenta de Administrador</p>
                </header>

                {!perfil ? (
                    <section className={styles.seccion} role="alert">
                        No se pudieron encontrar los datos de tu perfil. Volvé a intentarlo más tarde.
                    </section>
                ) : (
                    <section className={styles.seccion} aria-label="Datos de mi cuenta">
                        <h2 className="mb-4 text-xl font-semibold">Datos de mi cuenta</h2>
                        <p className="mb-3"><strong>Nombre de usuario:</strong> {perfil.nombre}</p>
                        <p className="mb-6"><strong>Correo electrónico:</strong> {perfil.correo}</p>
                        <div className="flex flex-wrap gap-3">
                            <Link href="/mi-perfil/editar" className="boton-secundario">Editar mi perfil</Link>
                            {habilitarCambioContrasena && (
                                <Link href="/mi-perfil/cambiar-contrasena" className="boton-secundario">Cambiar contraseña</Link>
                            )}
                            {/* CA-7: botón visible; la configuración propia de 2FA no está habilitada aquí. */}
                            <button type="button" className="boton-secundario" disabled>
                                Configurar segundo factor
                            </button>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
