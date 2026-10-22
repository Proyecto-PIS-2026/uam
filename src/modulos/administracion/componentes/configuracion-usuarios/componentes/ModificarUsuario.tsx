"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import type { DatosModificarUsuarios, TipoUsuario, UsuarioParaModificar } from "../Tipos";
import BuscadorUsuarios, { type FiltroRestablecimiento } from "./BuscadorUsuario";
import ListaUsuarios from "./ListaUsuarios";
import styles from "./ModificarUsuario.module.css";
import { bajaOperador } from "@/modulos/usuarios/operadores/bajaOperador";

interface ModificarUsuarioProps {
    datos: DatosModificarUsuarios;
}

export default function ModificarUsuario({ datos }: ModificarUsuarioProps) {
    const router = useRouter();
    const [busqueda, setBusqueda] = useState("");
    const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario | "TODOS">("TODOS");
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioParaModificar | null>(null);
    const [restablecimiento, setRestablecimiento] = useState<FiltroRestablecimiento>("TODOS");
    const usuariosFiltrados = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();

        return datos.usuarios.filter((usuario) => {
            if (tipoUsuario !== "TODOS" && usuario.rol !== tipoUsuario) return false;
            if (restablecimiento === "SOLICITADO" && !usuario.solicitoRestablecimiento) return false;
            if (!texto) return true;
            if (usuario.username.toLowerCase().includes(texto)) return true;
            if (usuario.rol === "ADMINISTRADOR" && usuario.email.toLowerCase().includes(texto)) return true;
            if (usuario.rol !== "ADMINISTRADOR" && usuario.nombreFantasia.toLowerCase().includes(texto)) return true;
            return false;
        });
    }, [datos, busqueda, tipoUsuario, restablecimiento]);

    function cambiarBusqueda(nuevaBusqueda: string) {
        setBusqueda(nuevaBusqueda);
        setUsuarioSeleccionado(null);
    }

    function cambiarTipoUsuario(nuevoTipo: TipoUsuario | "TODOS") {
        setTipoUsuario(nuevoTipo);
        setBusqueda("");
        setUsuarioSeleccionado(null);
    }

    function cambiarRestablecimiento(nuevoValor: FiltroRestablecimiento) {
        setRestablecimiento(nuevoValor);
        setUsuarioSeleccionado(null);
    }   

    async function eliminarUsuario(usuario: UsuarioParaModificar) {
        if (usuario.rol !== "OPERADOR") {
            throw new Error("La baja de este tipo de usuario todavía no está disponible.");
        }

        const resultado = await bajaOperador({ operadorId: usuario.operadorId });
        if (!resultado.esValido) {
            throw new Error(resultado.errores.join(" "));
        }

        setUsuarioSeleccionado(null);
        router.refresh();
    }

    const linkAlta = tipoUsuario !== "TODOS"
        ? `/alta-usuario?rol=${tipoUsuario.toLowerCase()}`
        : "/alta-usuario";

    return (
        <section className={styles.tarjeta}>
            <div className={styles.encabezado}>
                <h2 className={styles.titulo}>Gestión de Usuarios</h2>
                <Button component={Link} href={linkAlta} variant="contained" startIcon={<AddIcon className={styles.iconoBoton}/>} title="Alta de usuario" className={styles.botonAlta}>
                    <span className={styles.textoBoton}>Nuevo Usuario</span>
                </Button>
            </div>
            <div className={styles.contenido}>
                <BuscadorUsuarios busqueda={busqueda} tipoUsuario={tipoUsuario} onBusquedaChange={cambiarBusqueda} onTipoUsuarioChange={cambiarTipoUsuario} restablecimiento={restablecimiento} onRestablecimientoChange={cambiarRestablecimiento}/>
                <ListaUsuarios usuarios={usuariosFiltrados} usuarioSeleccionadoId={usuarioSeleccionado?.id ?? null} onSeleccionar={setUsuarioSeleccionado} onEliminar={eliminarUsuario}/>
            </div>
        </section>
    );
}