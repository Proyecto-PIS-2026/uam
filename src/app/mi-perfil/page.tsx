import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { RUTA_SESION_FINALIZADA } from "@/modulos/identidad-acceso/autenticacion/rutas-sesion";
import { estaHabilitadoCambioContrasena } from "@/modulos/identidad-acceso/cambio-contrasena/configuracion";
import { obtenerPerfilPropioOperador } from "@/modulos/usuarios/operadores/consultasPerfilPropio";
import PerfilPropioOperador from "@/modulos/usuarios/operadores/componentes/perfil-propio-operador/PerfilPropioOperador";
import { consultarMiPerfilAdministrador } from "@/modulos/usuarios/administradores/consultar-mi-perfil";
import BotonVolver from "@/compartido/BotonVolver";
import HojasDecorativas from "@/compartido/HojasDecorativas";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import { obtenerIniciales } from "@/modulos/usuarios/obtener-iniciales";
import styles from "@/modulos/usuarios/administradores/componentes/perfil-administrador/PerfilAdministrador.module.css";
import estilosFormulario from "@/modulos/usuarios/administradores/componentes/modificar-administrador/FormularioModificarAdministrador.module.css";

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
        <main className={styles.contenedor}>
            <BotonVolver href="/administracion" className={styles.volver}>
                Volver al panel administrativo
            </BotonVolver>
            {!perfil ? (
                <div className="secciones-pagina">
                    <EncabezadoPagina titulo="Mi perfil" subtitulo="Administrador" />
                    <section className={`${styles.tarjetaPerfil} ${styles.tarjetaInformacion}`} role="alert">
                        No se pudieron encontrar los datos de tu perfil. Volvé a intentarlo más tarde.
                    </section>
                </div>
            ) : (
                <>
                    <section className={styles.tarjetaPerfil} aria-label="Datos de mi cuenta">
                        <header className={styles.encabezado}>
                            <HojasDecorativas />
                            <div className={styles.avatar} aria-hidden="true">
                                {obtenerIniciales(perfil.nombre)}
                            </div>
                            <div className={styles.identidad}>
                                <p className={styles.tipoPerfil}>Mi perfil</p>
                                <h1 className={styles.nombre}>{perfil.nombre}</h1>
                            </div>
                        </header>
                        <div className={`${styles.tarjetaInformacion} ${styles.datosCuenta}`}>
                            <h2 className={styles.tituloDatosCuenta}>Datos de mi cuenta</h2>
                            <dl className={styles.rejillaDatosCuenta}>
                                <div className={styles.datoCuenta}>
                                    <dt className={styles.etiquetaCuenta}>
                                        <span className={styles.iconoDatoCuenta} aria-hidden="true"><EmailOutlinedIcon /></span>
                                        Correo electrónico
                                    </dt>
                                    <dd className={styles.valorCuenta}>
                                        <span>{perfil.correo}</span>
                                    </dd>
                                </div>
                                <div className={styles.datoCuenta}>
                                    <dt className={styles.etiquetaCuenta}>
                                        <span className={styles.iconoDatoCuenta} aria-hidden="true"><AdminPanelSettingsOutlinedIcon /></span>
                                        Rol
                                    </dt>
                                    <dd className={styles.valorCuenta}>
                                        <span className={styles.insigniaRol}>Administrador</span>
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </section>
                    <div className={`${estilosFormulario.acciones} ${styles.accionesCuenta}`}>
                        <Link href="/mi-perfil/editar" className={`${estilosFormulario.cancelar} ${styles.accionCuenta}`} aria-label="Editar mi perfil">
                            Editar
                        </Link>
                        {habilitarCambioContrasena && (
                            <Link href="/mi-perfil/cambiar-contrasena" className={`${estilosFormulario.guardar} ${styles.accionCuenta}`}>
                                Cambiar contraseña
                            </Link>
                        )}
                    </div>
                </>
            )}
        </main>
    );
}
