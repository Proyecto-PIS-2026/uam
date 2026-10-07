"use client";

import { useState } from "react";
import Pagination from "@mui/material/Pagination";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { UsuarioParaModificar } from "../../Compartidos/Tipos";
import styles from "./ListaUsuarios.module.css";

interface ListaUsuariosProps {
    usuarios: UsuarioParaModificar[];
    usuarioSeleccionadoId: number | null;
    onSeleccionar: (usuario: UsuarioParaModificar) => void;
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

export default function ListaUsuarios({ usuarios, usuarioSeleccionadoId, onSeleccionar }: ListaUsuariosProps) {
    const [pagina, setPagina] = useState(1);
    const esMobile = useMediaQuery("(max-width: 600px)", { noSsr: true });
    const usuariosPorPagina = esMobile ? 7 : 12;

    const cantidadPaginas = Math.ceil(usuarios.length / usuariosPorPagina);
    const paginaActual = Math.min(pagina, Math.max(1, cantidadPaginas));
    const indiceInicio = (paginaActual - 1) * usuariosPorPagina;
    const usuariosPagina = usuarios.slice(indiceInicio, indiceInicio + usuariosPorPagina);

    function cambiarPagina(_: React.ChangeEvent<unknown>, nuevaPagina: number) {
        setPagina(nuevaPagina);
    }

    if (usuarios.length === 0) return <p className={styles.sinResultados}>No se encontraron usuarios.</p>;

    return (
        <div className={styles.contenedor}>
            <div className={styles.lista}>
                <div className={styles.encabezado}>
                    <span>Username</span>
                    <span>Información Extra</span>
                    <span>Rol</span>
                </div>

                {usuariosPagina.map((usuario) => (
                    <button key={usuario.id} type="button" className={`${styles.fila} ${usuario.id === usuarioSeleccionadoId ? styles.seleccionada : ""}`} onClick={() => onSeleccionar(usuario)}>
                        <span className={styles.username}>{usuario.username}</span>
                        <span className={styles.informacion}>{obtenerInformacion(usuario)}</span>
                        <span className={styles.rol}>{obtenerNombreRol(usuario.rol)}</span>
                    </button>
                ))}
            </div>

            {cantidadPaginas > 1 && (
                <div className={styles.paginacion}>
                    <Pagination count={cantidadPaginas} page={paginaActual} onChange={cambiarPagina} color="primary" shape="rounded" size={esMobile ? "small" : "medium"}/>
                </div>
            )}
        </div>
    );
}