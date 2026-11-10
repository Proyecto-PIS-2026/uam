"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import EditIcon from "@mui/icons-material/Edit";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PasswordOutlinedIcon from "@mui/icons-material/PasswordOutlined";

import HojasDecorativas from "@/compartido/HojasDecorativas";
import BotonVolver from "@/compartido/BotonVolver";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import { restablecerSegundoFactorAdministrador } from "../../restablecerSegundoFactorAdministrador";
import type { PerfilAdministrador as DatosPerfilAdministrador } from "../../acciones/consultas-perfil-administrador";
import { obtenerIniciales } from "@/modulos/usuarios/obtener-iniciales";
import styles from "./PerfilAdministrador.module.css";

// Ruta de Mi Perfil
export const RUTA_MI_PERFIL = "/mi-perfil";

type PerfilAdministradorProps = {
    administrador: DatosPerfilAdministrador;
    esPropiaCuenta: boolean;
};

export default function PerfilAdministrador({ administrador, esPropiaCuenta }: PerfilAdministradorProps) {
    const router = useRouter();
    const { notificar } = useNotificacionToast();
    const [confirmando, setConfirmando] = useState(false);
    const [procesando, setProcesando] = useState(false);
    const restablecimientoEnCurso = useRef(false);
    const iniciales = obtenerIniciales(administrador.nombreUsuario);

    async function restablecer() {
        if (restablecimientoEnCurso.current) return;
        restablecimientoEnCurso.current = true;
        setProcesando(true);
        try {
            const resultado = await restablecerSegundoFactorAdministrador(administrador.id);
            if (!resultado.esValido) {
                notificar(resultado.errores.join(" "), "error");
                return;
            }
            setConfirmando(false);
            notificar(resultado.mensaje, "success");
            router.refresh();
        } catch {
            notificar("No se pudo restablecer el segundo factor. Intentá de nuevo.", "error");
        } finally {
            restablecimientoEnCurso.current = false;
            setProcesando(false);
        }
    }

    // La propia cuenta se edita desde Mi perfil; la de otro, desde la modificación de administradores
    const enlaceEditar = esPropiaCuenta ? RUTA_MI_PERFIL : `/gestion-administradores/${administrador.id}/editar`;

    return (
        <section className={styles.contenedor} aria-labelledby="nombre-administrador">
            <BotonVolver href="/administracion#usuarios" className={styles.volver}>
                Volver al listado de administradores
            </BotonVolver>

            <div className={styles.tarjetaPerfil}>
                <header className={`${styles.encabezado} ${styles.encabezadoConsulta}`}>
                    <HojasDecorativas />
                    <div className={styles.avatar}>
                        <span aria-hidden="true">{iniciales}</span>
                    </div>

                    <div className={styles.identidad}>
                        <p className={styles.tipoPerfil}>Perfil Administrador</p>
                        <h1 id="nombre-administrador" className={styles.nombre}>{administrador.nombreUsuario}</h1>
                    </div>
                </header>

                <div className={`${styles.tarjetaInformacion} ${styles.contenidoConsulta}`}>
                    <div className={styles.contactoConsulta}>
                        <span className={styles.iconoContactoConsulta} aria-hidden="true"><EmailOutlinedIcon /></span>
                        <div className={styles.datosContactoConsulta}>
                            <span className={styles.etiquetaContactoConsulta}>Correo electrónico:</span>
                            <span className={styles.valorContactoConsulta}>{administrador.email || "-"}</span>
                        </div>
                    </div>

                    <div className={styles.seccionesConsulta}>
                        <section className={styles.seccionConsulta} aria-labelledby="segundo-factor-administrador">
                            <h2 id="segundo-factor-administrador" className={styles.tituloConsulta}>
                                <ShieldOutlinedIcon aria-hidden="true" />Segundo factor
                            </h2>
                            <span className={styles.estadoConsulta} data-estado={administrador.segundoFactorActivado ? "activo" : "neutro"}>
                                {administrador.segundoFactorActivado ? "Activado" : "No configurado"}
                            </span>
                            {esPropiaCuenta ? (
                                <Button component={Link} href={RUTA_MI_PERFIL} variant="outlined" color="secondary" className={styles.accionConsulta} startIcon={<ShieldOutlinedIcon aria-hidden="true" />}>
                                    Configurar segundo factor
                                </Button>
                            ) : (
                                <Button type="button" variant="outlined" color="secondary" className={styles.accionConsulta} startIcon={<ShieldOutlinedIcon aria-hidden="true" />} onClick={() => setConfirmando(true)} disabled={procesando}>
                                    Restablecer segundo factor
                                </Button>
                            )}
                        </section>
                        <section className={styles.seccionConsulta} aria-labelledby="restablecimiento-administrador">
                            <h2 id="restablecimiento-administrador" className={styles.tituloConsulta}>
                                <PasswordOutlinedIcon aria-hidden="true" />Restablecimiento de contraseña
                            </h2>
                            <span className={styles.estadoConsulta} data-estado={administrador.solicitoRestablecimiento ? "solicitado" : "neutro"}>
                                {administrador.solicitoRestablecimiento ? "Solicitado" : "No solicitado"}
                            </span>
                        </section>
                    </div>

                    <div className={styles.accionesConsulta}>
                        <Button
                            component={Link}
                            href={enlaceEditar}
                            variant="outlined"
                            color="secondary"
                            className={styles.accionConsulta}
                            startIcon={<EditIcon aria-hidden="true" />}
                            aria-label={esPropiaCuenta ? "Editar mi perfil" : "Editar administrador"}
                            title={esPropiaCuenta ? "Editar mi perfil" : "Editar administrador"}
                        >
                            Editar
                        </Button>
                    </div>
                </div>
            </div>
            <Dialog open={confirmando} onClose={() => { if (!procesando) setConfirmando(false); }} maxWidth="xs" fullWidth aria-labelledby="titulo-restablecer-segundo-factor" aria-describedby="descripcion-restablecer-segundo-factor">
                <DialogTitle id="titulo-restablecer-segundo-factor">Restablecer segundo factor</DialogTitle>
                <DialogContent id="descripcion-restablecer-segundo-factor">
                    Se cerrarán las sesiones de {administrador.nombreUsuario}. Deberá volver a vincular su aplicación al iniciar sesión.
                </DialogContent>
                <DialogActions>
                    <Button type="button" variant="outlined" color="secondary" disabled={procesando} onClick={() => setConfirmando(false)}>Cancelar</Button>
                    <Button type="button" variant="contained" color="secondary" disabled={procesando} onClick={restablecer}>{procesando ? "Restableciendo..." : "Restablecer"}</Button>
                </DialogActions>
            </Dialog>
        </section>
    );
}
