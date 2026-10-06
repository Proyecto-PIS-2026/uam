"use client";

import { useEffect, useMemo, useState } from "react";

import type {
    DatosModificarUsuarios,
    TipoUsuario,
    UsuarioParaModificar,
} from "../Compartidos/Tipos";

import BuscadorUsuarios from "./Compartido/BuscadorUsuario";
import ListaUsuarios from "./Compartido/ListaUsuarios";
import RestablecerContrasena from "./Compartido/RestablecerContrasena";

import ModificarOperador from "./Operador/ModificarOperador";
import ModificarProductor from "./Productor/ModificarProductor";

interface ModificarUsuarioProps {
    datos: DatosModificarUsuarios;
}

export default function ModificarUsuario({ datos }: ModificarUsuarioProps) {
    const [busqueda, setBusqueda] = useState("");
    const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario | "TODOS">("TODOS");
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioParaModificar | null>(null);

    useEffect(() => {
        /*
         * TODO: cargar datos iniciales.
         *
         * Consulta:
         * obtenerDatosModificarUsuarios()
         *
         * La consulta debe devolver todos los usuarios,
         * sus datos específicos, los locales de los operadores
         * y las naves disponibles.
         */

        // Ejemplo futuro:
        //
        // obtenerDatosModificarUsuarios().then(setDatos);
    }, []);

    const usuariosFiltrados = useMemo(() => {
        if (!datos) {
            return [];
        }

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

    function seleccionarUsuario(usuario: UsuarioParaModificar) { setUsuarioSeleccionado(usuario) }

    function cambiarBusqueda(nuevaBusqueda: string) {
        setBusqueda(nuevaBusqueda);
        setUsuarioSeleccionado(null);
    }

    function cambiarTipoUsuario(nuevoTipo: TipoUsuario | "TODOS") {
        setTipoUsuario(nuevoTipo);
        setBusqueda("");
        setUsuarioSeleccionado(null);
    }

    return (
        <div>
            <BuscadorUsuarios busqueda={busqueda} tipoUsuario={tipoUsuario} onBusquedaChange={cambiarBusqueda} onTipoUsuarioChange={cambiarTipoUsuario}/>

            <ListaUsuarios usuarios={usuariosFiltrados} usuarioSeleccionadoId={usuarioSeleccionado?.id ?? null} onSeleccionar={seleccionarUsuario}/>

            {usuarioSeleccionado?.rol === "ADMINISTRADOR" && (<RestablecerContrasena usuarioId={usuarioSeleccionado.id}/>)}

            {usuarioSeleccionado?.rol === "OPERADOR" && (<ModificarOperador key={usuarioSeleccionado.id} usuario={usuarioSeleccionado}/>)}

            {usuarioSeleccionado?.rol === "PRODUCTOR" && <ModificarProductor key={usuarioSeleccionado.id} usuario={usuarioSeleccionado}/>}
        </div>
    );
}