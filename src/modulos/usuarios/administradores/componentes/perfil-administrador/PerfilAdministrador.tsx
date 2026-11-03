"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import EditIcon from "@mui/icons-material/Edit";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";

import HojasDecorativas from "@/compartido/HojasDecorativas";
import BotonVolver from "@/compartido/BotonVolver";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import { restablecerSegundoFactorAdministrador } from "../../restablecerSegundoFactorAdministrador";
import type { PerfilAdministrador as DatosPerfilAdministrador } from "../../acciones/consultas-perfil-administrador";
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
    const inicial = administrador.nombreUsuario.trim()[0]?.toUpperCase();

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
                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <div className={styles.avatar}>
                        <span aria-hidden="true">{inicial}</span>
                    </div>

                    <div className={styles.identidad}>
                        <p className={styles.tipoPerfil}>Perfil Administrador</p>
                        <h1 id="nombre-administrador" className={styles.nombre}>{administrador.nombreUsuario}</h1>
                    </div>

                    <Link
                        href={enlaceEditar}
                        className={styles.botonEditar}
                        aria-label={esPropiaCuenta ? "Editar mi perfil" : "Editar administrador"}
                        title={esPropiaCuenta ? "Editar mi perfil" : "Editar administrador"}
                    >
                        <EditIcon aria-hidden="true" className={styles.iconoEditar} />
                        <span>Editar</span>
                    </Link>
                </header>

                <div className={`${styles.tarjetaInformacion} flex flex-col gap-2`}>
                    <p className={styles.dato}>
                        <span className={styles.etiqueta}>Correo electrónico:</span> {administrador.email}
                    </p>

                    <p className={`${styles.dato} flex items-center gap-2`}>
                        <span className={styles.etiqueta}>Segundo factor:</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${administrador.segundoFactorActivado ? "bg-primary-soft text-secondary" : "bg-gray-100 text-muted"}`}>
                            {administrador.segundoFactorActivado ? "Activado" : "No configurado"}
                        </span>
                    </p>

                    <p className={`${styles.dato} flex items-center gap-2`}>
                        <span className={styles.etiqueta}>Restablecimiento de contraseña:</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${administrador.solicitoRestablecimiento ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-muted"}`}>
                            {administrador.solicitoRestablecimiento ? "Solicitado" : "No solicitado"}
                        </span>
                    </p>

                    <div className="mt-2 flex justify-end">
                        {esPropiaCuenta ? (
                            <Link
                                href={RUTA_MI_PERFIL}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-secondary px-4 py-2 text-sm font-semibold text-secondary hover:bg-primary-soft sm:w-auto"
                            >
                                <ShieldOutlinedIcon fontSize="small" aria-hidden="true" />
                                Configurar segundo factor
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setConfirmando(true)}
                                disabled={procesando}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-secondary px-4 py-2 text-sm font-semibold text-secondary hover:bg-primary-soft sm:w-auto"
                            >
                                <ShieldOutlinedIcon fontSize="small" aria-hidden="true" />
                                Restablecer segundo factor
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <Dialog open={confirmando} onClose={() => { if (!procesando) setConfirmando(false); }} maxWidth="xs" fullWidth aria-labelledby="titulo-restablecer-segundo-factor" aria-describedby="descripcion-restablecer-segundo-factor">
                <DialogTitle id="titulo-restablecer-segundo-factor">Restablecer segundo factor</DialogTitle>
                <DialogContent id="descripcion-restablecer-segundo-factor">
                    Se cerrarán las sesiones de {administrador.nombreUsuario}. Deberá volver a vincular su aplicación al iniciar sesión.
                </DialogContent>
                <DialogActions>
                    <button type="button" className="boton-secundario" disabled={procesando} onClick={() => setConfirmando(false)}>Cancelar</button>
                    <button type="button" className="boton-primario" disabled={procesando} onClick={restablecer}>{procesando ? "Restableciendo..." : "Restablecer"}</button>
                </DialogActions>
            </Dialog>
        </section>
    );
}
