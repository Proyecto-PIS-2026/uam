"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Pagination from "@mui/material/Pagination";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";

import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import type { UsuarioParaModificar } from "../Tipos";
import styles from "./ListaUsuarios.module.css";

interface ListaUsuariosProps {
    usuarios: UsuarioParaModificar[];
    usuarioSeleccionadoId: number | null;
    onSeleccionar?: (usuario: UsuarioParaModificar) => void;
    onEliminar?: (usuario: UsuarioParaModificar) => void | Promise<void>;
}

function subscribeMediaQuery(callback: () => void) {
    if (typeof window === "undefined") return () => {};
    const matchMedia = window.matchMedia("(max-width: 500px)");
    matchMedia.addEventListener("change", callback);
    return () => matchMedia.removeEventListener("change", callback);
}

function getSnapshotMediaQuery() {
    return window.matchMedia("(max-width: 500px)").matches;
}

function getServerSnapshotMediaQuery() {
    return false;
}

function useEsMobileSSR() {
    return useSyncExternalStore(
        subscribeMediaQuery,
        getSnapshotMediaQuery,
        getServerSnapshotMediaQuery
    );
}

function obtenerNombreRol(rol: UsuarioParaModificar["rol"]) {
    if (rol === "ADMINISTRADOR") return "Administrador";
    if (rol === "OPERADOR") return "Operador";
    return "Productor";
}

function puedeEliminar(usuario: UsuarioParaModificar) {
    return usuario.rol === "OPERADOR" || usuario.rol === "PRODUCTOR";
}

function obtenerInformacion(usuario: UsuarioParaModificar) {
    if (usuario.rol === "ADMINISTRADOR") return usuario.email;
    return usuario.nombreFantasia;
}

export default function ListaUsuarios({ usuarios, usuarioSeleccionadoId, onSeleccionar, onEliminar }: ListaUsuariosProps) {
    const router = useRouter();
    const [idsEliminados, setIdsEliminados] = useState<number[]>([]);
    const [pagina, setPagina] = useState(1);
    const [usuarioAEliminar, setUsuarioAEliminar] = useState<UsuarioParaModificar | null>(null);
    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();
    const [eliminando, setEliminando] = useState(false);

    const esMobile = useEsMobileSSR();

    const usuariosPorPagina = esMobile ? 7 : 8;

    const usuariosVisibles = usuarios.filter((u) => !idsEliminados.includes(u.id));

    const cantidadPaginas = Math.ceil(usuariosVisibles.length / usuariosPorPagina);
    const paginaActual = Math.min(pagina, Math.max(1, cantidadPaginas));
    const indiceInicio = (paginaActual - 1) * usuariosPorPagina;
    const usuariosPagina = usuariosVisibles.slice(indiceInicio, indiceInicio + usuariosPorPagina);

    function cambiarPagina(_: React.ChangeEvent<unknown>, nuevaPagina: number) {
        setPagina(nuevaPagina);
    }

    function manejarSeleccionar(usuario: UsuarioParaModificar) {
        if (onSeleccionar) onSeleccionar(usuario);
        if (usuario.rol === "OPERADOR") {
            router.push(`/gestion-operadores/${usuario.operadorId}`);
        }
        if (usuario.rol === "PRODUCTOR") {
            router.push(`/gestion-productores/${usuario.productorId}`);
        }
    }

    // Roles que ya tienen su página de modificación
    function puedeEditar(usuario: UsuarioParaModificar) {
        return usuario.rol === "OPERADOR" || usuario.rol === "PRODUCTOR";
    }

    function manejarEditar(evento: React.MouseEvent, usuario: UsuarioParaModificar) {
        evento.stopPropagation();
        if (usuario.rol === "OPERADOR") {
            router.push(`/gestion-operadores/${usuario.operadorId}/editar`);
        }
        if (usuario.rol === "PRODUCTOR") {
            router.push(`/gestion-productores/${usuario.productorId}/editar`);
        }
    }

    function manejarAbrirEliminar(evento: React.MouseEvent, usuario: UsuarioParaModificar) {
        evento.stopPropagation();
        if (!puedeEliminar(usuario) || !onEliminar || eliminando) return;
        setUsuarioAEliminar(usuario);
    }

    async function confirmarEliminacion() {
        if (!usuarioAEliminar || !onEliminar || eliminando) return;
        const idAEliminar = usuarioAEliminar.id;
        setEliminando(true);
        try {
            await onEliminar(usuarioAEliminar);
            setIdsEliminados((prev) => [...prev, idAEliminar]);
            notificar(`El usuario ${usuarioAEliminar.username} fue eliminado correctamente.`, "success");
        } catch (error) {
            notificar(error instanceof Error ? error.message : `Ocurrió un error al intentar eliminar a ${usuarioAEliminar.username}.`, "error");
        } finally {
            setUsuarioAEliminar(null);
            setEliminando(false);
        }
    }

    return (
        <div className={styles.contenedor}>
            {usuariosVisibles.some((usuario) => usuario.solicitoRestablecimiento) && (
                <p className={styles.leyendaRestablecimiento}>
                    <WarningAmberIcon fontSize="small" />
                    Solicitaron reestablecimiento
                </p>
            )}
            {usuariosVisibles.length === 0 ? (
                <p className={styles.sinResultados}>No se encontraron usuarios.</p>
            ) : (
                <div className={styles.lista}>
                    <div className={styles.encabezado}>
                        <span>Username</span>
                        <span>Información Extra</span>
                        <span>Rol</span>
                        <span className={styles.columnaAccionesHeader}>Opciones</span>
                    </div>

                    {usuariosPagina.map((usuario) => (
                        <div key={usuario.id} className={`${styles.fila} ${usuario.id === usuarioSeleccionadoId ? styles.seleccionada : ""} ${usuario.solicitoRestablecimiento ? styles.restablecimientoSolicitado : ""}`} onClick={() =>
                            manejarSeleccionar(usuario)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") manejarSeleccionar(usuario) }}
                        >
                            <span className={styles.username}>
                                {usuario.username}
                                {usuario.solicitoRestablecimiento && (
                                    <WarningAmberIcon fontSize="small" className={styles.iconoRestablecimiento} aria-hidden="true" />
                                )}
                                {usuario.solicitoRestablecimiento && (
                                    <span
                                        title="El usuario solicitó restablecer su contraseña"
                                        className={`${styles.indicadorRestablecimiento} ml-2 inline-block rounded bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning`}
                                    >
                                        Restablecimiento solicitado
                                    </span>
                                )}
                            </span>
                            <span className={styles.informacion}>{obtenerInformacion(usuario)}</span>
                            <span className={styles.rol}>{obtenerNombreRol(usuario.rol)}</span>
                            <div className={styles.acciones}>
                                <IconButton size="small" onClick={(e) => manejarEditar(e, usuario)} disabled={eliminando || !puedeEditar(usuario)} title={puedeEditar(usuario) ? "Editar perfil" : "Edición todavía no disponible"} className={styles.botonEditar}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={(e) => manejarAbrirEliminar(e, usuario)} disabled={eliminando || !puedeEliminar(usuario) || !onEliminar} title={puedeEliminar(usuario) && onEliminar ? "Eliminar usuario" : "Baja todavía no disponible"} className={styles.botonEliminar}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {cantidadPaginas > 1 && (
                <div className={styles.paginacion}>
                    <Pagination count={cantidadPaginas} page={paginaActual} onChange={cambiarPagina} color="primary" shape="rounded" size={esMobile ? "small" : "medium"} />
                </div>
            )}

            <Dialog open={Boolean(usuarioAEliminar)} onClose={() => { if (!eliminando) setUsuarioAEliminar(null); }} maxWidth="xs" slotProps={{ paper: { className: styles.modal } }}>
                <DialogTitle className={styles.modalTitulo}>¿Eliminar usuario?</DialogTitle>
                <DialogContent className={styles.modalContenido}>
                    <p className={styles.textoConfirmacion}>
                        ¿Estás seguro de que quieres eliminar al usuario <strong>@{usuarioAEliminar?.username}</strong>?
                    </p>
                </DialogContent>
                <DialogActions className={styles.modalAcciones}>
                    <Button type="button" variant="outlined" onClick={() => setUsuarioAEliminar(null)} disabled={eliminando} className={styles.botonCancelarModal}>
                        Cancelar
                    </Button>
                    <Button type="button" variant="contained" color="error" onClick={confirmarEliminacion} disabled={eliminando} className={styles.botonEliminarModal}>
                        {eliminando ? "Eliminando..." : "Eliminar"}
                    </Button>
                </DialogActions>
            </Dialog>

            <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
        </div>
    );
}
