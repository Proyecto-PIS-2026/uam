"use client";

import { useState } from "react";
import type { TipoUsuario } from "../Compartidos/Tipos";
import SelectorTipoUsuario from "../Compartidos/SelectorTipoUsuario";
import AltaAdministrador from "./AltaAdministrador";
import AltaProductor from "./AltaProductor";
import AltaOperador from "./AltaOperador";

export default function AltaUsuario() {
    const [tipoUsuario, setTipoUsuario] =
        useState<TipoUsuario>("ADMINISTRADOR");

    return (
        <div>
            <SelectorTipoUsuario value={tipoUsuario} onChange={setTipoUsuario}/>

            {tipoUsuario === "ADMINISTRADOR" && <AltaAdministrador />}

            {tipoUsuario === "OPERADOR" && <AltaOperador />}

            {tipoUsuario === "PRODUCTOR" && <AltaProductor />}
        </div>
    );
}