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
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";

import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";

import type { UsuarioParaModificar } from "../Tipos";
import styles from "./ListaUsuarios.module.css";

interface ListaUsuariosProps {
    usuarios: UsuarioParaModificar[];
    usuarioSeleccionadoId: number | null;
    usuarioActualId?: number;
    hayFiltrosActivos?: boolean;
    onSeleccionar?: (usuario: UsuarioParaModificar) => void;
    onEliminar?: (usuario: UsuarioParaModificar) => void | Promise<void>;
    onCambiarHabilitacion?: (usuario: UsuarioParaModificar) => Promise<void>;
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

function obtenerInformacion(usuario: UsuarioParaModificar) {
    if (usuario.rol === "ADMINISTRADOR") return usuario.email;
    return usuario.nombreFantasia;
}

export default function ListaUsuarios({ usuarios, usuarioSeleccionadoId, usuarioActualId, hayFiltrosActivos = false, onSeleccionar, onEliminar, onCambiarHabilitacion }: ListaUsuariosProps) {
    const router = useRouter();
    const [idsEliminados, setIdsEliminados] = useState<number[]>([]);
    const [pagina, setPagina] = useState(1);
    const [usuarioAEliminar, setUsuarioAEliminar] = useState<UsuarioParaModificar | null>(null);
    const { notificar } = useNotificacionToast();
    const [eliminando, setEliminando] = useState(false);
    const [usuarioACambiar, setUsuarioACambiar] = useState<UsuarioParaModificar | null>(null);
    const [cambiandoHabilitacion, setCambiandoHabilitacion] = useState(false);
    const ocupado = eliminando || cambiandoHabilitacion;
    const vaAHabilitar = usuarioACambiar?.habilitado === false;

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
        if (usuario.rol === "ADMINISTRADOR") {
            router.push(`/gestion-administradores/${usuario.administradorId}`);
        }
    }

    // Roles que ya tienen su página de modificación
    function puedeEditar(usuario: UsuarioParaModificar) {
        return usuario.rol === "OPERADOR" || usuario.rol === "PRODUCTOR" || usuario.rol == "ADMINISTRADOR";
    }

    function manejarEditar(evento: React.MouseEvent, usuario: UsuarioParaModificar) {
        evento.stopPropagation();
        if (usuario.rol === "OPERADOR") {
            router.push(`/gestion-operadores/${usuario.operadorId}/editar`);
        }
        if (usuario.rol === "PRODUCTOR") {
            router.push(`/gestion-productores/${usuario.productorId}/editar`);
        }
        if (usuario.rol === "ADMINISTRADOR") {
            router.push(`/gestion-administradores/${usuario.administradorId}/editar`);
        }
    }

    function manejarAbrirEliminar(evento: React.MouseEvent, usuario: UsuarioParaModificar) {
        evento.stopPropagation();
        if (!onEliminar || ocupado) return;
        setUsuarioAEliminar(usuario);
    }

    async function confirmarEliminacion() {
        if (!usuarioAEliminar || !onEliminar || ocupado) return;
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

    function manejarAbrirHabilitacion(evento: React.MouseEvent, usuario: UsuarioParaModificar,) {
        evento.stopPropagation();
        if (ocupado || !onCambiarHabilitacion) {
            return;
        }
        if (usuario.id === usuarioActualId) {
            notificar("No podés deshabilitarte a vos mismo.", "error");
            return;
        }
        setUsuarioACambiar(usuario);
    }

    async function confirmarHabilitacion() {
        if (!usuarioACambiar || !onCambiarHabilitacion || ocupado) return;
        setCambiandoHabilitacion(true);
        try {
            await onCambiarHabilitacion(usuarioACambiar);
            notificar(`El usuario ${usuarioACambiar.username} fue ${vaAHabilitar ? "habilitado" : "deshabilitado"} correctamente.`, "success");
            setUsuarioACambiar(null);
        } catch (error) {
            notificar(error instanceof Error ? error.message : "No se pudo cambiar el estado del usuario. Intentá nuevamente.", "error");
        } finally {
            setCambiandoHabilitacion(false);
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
                <EstadoVacio
                    titulo="No se encontraron usuarios."
                    descripcion={hayFiltrosActivos
                        ? "Probá con otra búsqueda o cambiá los filtros para encontrar usuarios."
                        : "Los usuarios registrados aparecerán en este listado."}
                    icono={hayFiltrosActivos ? <SearchOffOutlinedIcon /> : <GroupsOutlinedIcon />}
                    anunciar={false}
                />
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
                            manejarSeleccionar(usuario)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) manejarSeleccionar(usuario) }}
                        >
                            <span className={styles.username}>
                                {usuario.username}
                                <span className={styles.estadoUsuario} data-habilitado={usuario.habilitado !== false}>
                                    {usuario.habilitado === false ? "Deshabilitado" : "Habilitado"}
                                </span>
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
                            <div className={styles.acciones} onClick={(evento) => evento.stopPropagation()}>
                                <IconButton size="small" onClick={(e) => manejarEditar(e, usuario)} disabled={ocupado || !puedeEditar(usuario)} title={puedeEditar(usuario) ? "Editar perfil" : "Edición todavía no disponible"} className={styles.botonEditar}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={(e) => manejarAbrirHabilitacion(e, usuario)} disabled={ocupado || !onCambiarHabilitacion || usuario.id === usuarioActualId} title={usuario.id === usuarioActualId ? "No podés deshabilitarte a vos mismo" : usuario.habilitado === false ? "Habilitar usuario" : "Deshabilitar usuario"} aria-label={usuario.habilitado === false ? "Habilitar usuario" : "Deshabilitar usuario"} className={styles.botonHabilitacion}>
                                    {usuario.habilitado === false ? <CheckCircleOutlinedIcon fontSize="small" /> : <BlockIcon fontSize="small" />}
                                </IconButton>
                                <IconButton size="small" onClick={(e) => manejarAbrirEliminar(e, usuario)} disabled={ocupado || !onEliminar} title={onEliminar ? "Eliminar usuario" : "Baja todavía no disponible"} className={styles.botonEliminar}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {cantidadPaginas > 1 && (
                <div className={styles.paginacion}>
                    <Pagination count={cantidadPaginas} page={paginaActual} onChange={cambiarPagina} color="secondary" shape="rounded" size={esMobile ? "small" : "medium"} />
                </div>
            )}

            <Dialog open={Boolean(usuarioACambiar)} onClose={() => { if (!cambiandoHabilitacion) setUsuarioACambiar(null); }} maxWidth="xs" aria-labelledby="titulo-habilitacion-usuario" slotProps={{ paper: { className: styles.modal } }}>
                <DialogTitle id="titulo-habilitacion-usuario" className={styles.modalTitulo}>¿{vaAHabilitar ? "Habilitar" : "Deshabilitar"} usuario?</DialogTitle>
                <DialogContent className={styles.modalContenido}>
                    <p className={styles.textoConfirmacion}>
                        ¿Estás seguro de que querés {vaAHabilitar ? "habilitar" : "deshabilitar"} al usuario <strong>@{usuarioACambiar?.username}</strong>?
                        {vaAHabilitar
                            ? " Podrá volver a iniciar sesión y sus publicaciones volverán a mostrarse según su disponibilidad."
                            : " Perderá el acceso a su sesión y su perfil y publicaciones quedarán ocultos en los listados."}
                    </p>
                </DialogContent>
                <DialogActions className={styles.modalAcciones}>
                    <Button type="button" variant="outlined" onClick={() => setUsuarioACambiar(null)} disabled={cambiandoHabilitacion} className={styles.botonCancelarModal}>
                        Cancelar
                    </Button>
                    <Button type="button" variant="contained" color={vaAHabilitar ? "secondary" : "error"} onClick={confirmarHabilitacion} disabled={cambiandoHabilitacion} className={styles.botonEliminarModal}>
                        {cambiandoHabilitacion ? "Guardando..." : vaAHabilitar ? "Habilitar" : "Deshabilitar"}
                    </Button>
                </DialogActions>
            </Dialog>

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

        </div>
    );
}
