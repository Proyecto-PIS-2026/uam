"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import type { DatosModificarUsuarios, TipoUsuario, UsuarioParaModificar } from "../Tipos";
import BuscadorUsuarios from "./BuscadorUsuario";
import ListaUsuarios from "./ListaUsuarios";
import styles from "./ModificarUsuario.module.css";

interface ModificarUsuarioProps {
    datos: DatosModificarUsuarios;
}

export default function ModificarUsuario({ datos }: ModificarUsuarioProps) {
    const [busqueda, setBusqueda] = useState("");
    const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario | "TODOS">("TODOS");
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioParaModificar | null>(null);

    const usuariosFiltrados = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();

        return datos.usuarios.filter((usuario) => {
            if (tipoUsuario !== "TODOS" && usuario.rol !== tipoUsuario) return false;
            if (!texto) return true;
            if (usuario.username.toLowerCase().includes(texto)) return true;
            if (usuario.rol === "ADMINISTRADOR" && usuario.email.toLowerCase().includes(texto)) return true;
            if (usuario.rol === "OPERADOR" && usuario.nombreFantasia.toLowerCase().includes(texto)) return true;
            return false;
        });
    }, [datos, busqueda, tipoUsuario]);

    function cambiarBusqueda(nuevaBusqueda: string) {
        setBusqueda(nuevaBusqueda);
        setUsuarioSeleccionado(null);
    }

    function cambiarTipoUsuario(nuevoTipo: TipoUsuario | "TODOS") {
        setTipoUsuario(nuevoTipo);
        setBusqueda("");
        setUsuarioSeleccionado(null);
    }

    const rolParam = tipoUsuario !== "TODOS" ? tipoUsuario.toLowerCase() : "operador";
    const linkAlta = `/alta-usuario?rol=${rolParam}`;

    return (
        <section className={styles.tarjeta}>
            <div className={styles.encabezado}>
                <h2 className={styles.titulo}>Gestión de Usuarios</h2>
                <Button component={Link} href={linkAlta} variant="contained" startIcon={<AddIcon className={styles.iconoBoton}/>} title="Alta de usuario" className={styles.botonAlta}>
                    <span className={styles.textoBoton}>Nuevo Usuario</span>
                </Button>
            </div>
            <div className={styles.contenido}>
                <BuscadorUsuarios busqueda={busqueda} tipoUsuario={tipoUsuario} onBusquedaChange={cambiarBusqueda} onTipoUsuarioChange={cambiarTipoUsuario}/>
                <ListaUsuarios usuarios={usuariosFiltrados} usuarioSeleccionadoId={usuarioSeleccionado?.id ?? null} onSeleccionar={setUsuarioSeleccionado}/>
            </div>
        </section>
    );
}