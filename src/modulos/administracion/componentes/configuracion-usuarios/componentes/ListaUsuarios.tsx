"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Pagination from "@mui/material/Pagination";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import type { UsuarioParaModificar } from "../Tipos";
import styles from "./ListaUsuarios.module.css";

interface ListaUsuariosProps {
    usuarios: UsuarioParaModificar[];
    usuarioSeleccionadoId: number | null;
    onSeleccionar?: (usuario: UsuarioParaModificar) => void;
    onEditar?: (usuario: UsuarioParaModificar) => void;
    onEliminar?: (usuario: UsuarioParaModificar) => void;
}

interface Notificacion {
    mensaje: string;
    tipo: "error" | "success";
    key: number;
}

function subscribeMediaQuery(callback: () => void) {
    if (typeof window === "undefined") return () => {};
    const matchMedia = window.matchMedia("(max-width: 600px)");
    matchMedia.addEventListener("change", callback);
    return () => matchMedia.removeEventListener("change", callback);
}

function getSnapshotMediaQuery() {
    return window.matchMedia("(max-width: 600px)").matches;
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
    if (usuario.rol === "OPERADOR") return usuario.nombreFantasia;
    return "-";
}

export default function ListaUsuarios({ usuarios, usuarioSeleccionadoId, onSeleccionar, onEditar, onEliminar }: ListaUsuariosProps) {
    const router = useRouter();
    const [idsEliminados, setIdsEliminados] = useState<number[]>([]);
    const [pagina, setPagina] = useState(1);
    const [usuarioAEliminar, setUsuarioAEliminar] = useState<UsuarioParaModificar | null>(null);
    const [notificacion, setNotificacion] = useState<Notificacion | null>(null);

    const contadorNotificacion = useRef(0);
    const esMobile = useEsMobileSSR();

    const usuariosPorPagina = esMobile ? 7 : 10;

    const usuariosVisibles = usuarios.filter((u) => !idsEliminados.includes(u.id));

    const cantidadPaginas = Math.ceil(usuariosVisibles.length / usuariosPorPagina);
    const paginaActual = Math.min(pagina, Math.max(1, cantidadPaginas));
    const indiceInicio = (paginaActual - 1) * usuariosPorPagina;
    const usuariosPagina = usuariosVisibles.slice(indiceInicio, indiceInicio + usuariosPorPagina);

    function mostrarNotificacion(mensaje: string, tipo: "error" | "success") {
        contadorNotificacion.current += 1;
        setNotificacion({ mensaje, tipo, key: contadorNotificacion.current });
    }

    function cambiarPagina(_: React.ChangeEvent<unknown>, nuevaPagina: number) {
        setPagina(nuevaPagina);
    }

    function manejarSeleccionar(usuario: UsuarioParaModificar) {
        if (onSeleccionar) onSeleccionar(usuario);
        if (usuario.rol === "ADMINISTRADOR") {
            const targetId = usuario.administradorId;
            router.push(`/gestion-de-administradores/${targetId}`);
        } else if (usuario.rol === "OPERADOR") {
            const targetId = usuario.operadorId;
            router.push(`/gestion-de-opradores/${targetId}`);
        } else {
            const targetId = usuario.productorId;
            router.push(`/gestion-de-productores/${targetId}`);
        }
    }

    function manejarEditar(evento: React.MouseEvent, usuario: UsuarioParaModificar) {
        evento.stopPropagation();
        if (onEditar) {
            onEditar(usuario);
            return;
        }
        
        if (usuario.rol === "ADMINISTRADOR") {
            const targetId = usuario.administradorId;
            router.push(`/gestion-de-administradores/${targetId}/editar`);
        } else if (usuario.rol === "OPERADOR") {
            const targetId = usuario.operadorId;
            router.push(`/gestion-de-opradores/${targetId}/editar`);
        } else {
            const targetId = usuario.productorId;
            router.push(`/gestion-de-productores/${targetId}/editar`);
        }
    }

    function manejarAbrirEliminar(evento: React.MouseEvent, usuario: UsuarioParaModificar) {
        evento.stopPropagation();
        setUsuarioAEliminar(usuario);
    }

    async function confirmarEliminacion() {
        if (!usuarioAEliminar) return;
        const idAEliminar = usuarioAEliminar.id;
        try {
            if (onEliminar) {
                await onEliminar(usuarioAEliminar);
            }
            setIdsEliminados((prev) => [...prev, idAEliminar]);
            mostrarNotificacion(`El usuario ${usuarioAEliminar.username} fue eliminado correctamente.`, "success");
        } catch {
            mostrarNotificacion(`Ocurrió un error al intentar eliminar a ${usuarioAEliminar.username}.`, "error");
        } finally {
            setUsuarioAEliminar(null);
        }
    }

    return (
        <div className={styles.contenedor}>
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
                        <div key={usuario.id} className={`${styles.fila} ${usuario.id === usuarioSeleccionadoId ? styles.seleccionada : ""}`} onClick={() => 
                            manejarSeleccionar(usuario)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") manejarSeleccionar(usuario) }}
                        >
                            <span className={styles.username}>{usuario.username}</span>
                            <span className={styles.informacion}>{obtenerInformacion(usuario)}</span>
                            <span className={styles.rol}>{obtenerNombreRol(usuario.rol)}</span>
                            <div className={styles.acciones}>
                                <IconButton size="small" onClick={(e) => manejarEditar(e, usuario)} title="Editar perfil" className={styles.botonEditar}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={(e) => manejarAbrirEliminar(e, usuario)} title="Eliminar usuario" className={styles.botonEliminar}>
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

            <Dialog open={Boolean(usuarioAEliminar)} onClose={() => setUsuarioAEliminar(null)} maxWidth="xs">
                <DialogTitle className={styles.modalTitulo}>¿Eliminar usuario?</DialogTitle>
                <DialogContent>
                    <p className={styles.textoConfirmacion}>
                        ¿Estás seguro de que quieres eliminar al usuario <strong>@{usuarioAEliminar?.username}</strong>?
                    </p>
                </DialogContent>
                <DialogActions className={styles.modalAcciones}>
                    <Button type="button" variant="outlined" onClick={() => setUsuarioAEliminar(null)} className={styles.botonCancelarModal}>
                        Cancelar
                    </Button>
                    <Button type="button" variant="contained" color="error" onClick={confirmarEliminacion} className={styles.botonEliminarModal}>
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar key={notificacion?.key} open={Boolean(notificacion)} autoHideDuration={4000} onClose={() => setNotificacion(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                {notificacion ? (
                    <Alert onClose={() => setNotificacion(null)} severity={notificacion.tipo} variant="filled" sx={{ width: "100%" }}>
                        {notificacion.mensaje}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </div>
    );
}