"use client";

import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { compararPaisesPorPrioridad } from "../../../../compartido/prioridad-paises";
import { compararEspeciesPorPrioridad } from "../../../../compartido/prioridad-especies";
import { ordenarOpcionesPorNombre } from "../../catalogos/ordenar-opciones";
import estilosAcciones from "./formulario-publicacion.module.css";

export default function CampoCatalogoPublicacion({ nombre, valor, opciones, nombreActual, cambiar, deshabilitado = false, enConsulta = false, priorizarUruguay = false, priorizarEspecies = false }: {
    nombre: string;
    valor: number;
    opciones: { id: number; nombre: string }[];
    nombreActual: string;
    cambiar?: (id: number) => void;
    deshabilitado?: boolean;
    enConsulta?: boolean;
    priorizarUruguay?: boolean;
    priorizarEspecies?: boolean;
}) {
    const ordenadas = priorizarEspecies
        ? [...opciones].sort((a, b) => compararEspeciesPorPrioridad(a.nombre, b.nombre))
        : priorizarUruguay
            ? [...opciones].sort((a, b) => compararPaisesPorPrioridad(a.nombre, b.nombre))
            : ordenarOpcionesPorNombre(opciones);
    return <TextField select label={nombre} value={nombre === "Especie" && valor === 0 ? "" : valor} onChange={(evento) => cambiar?.(Number(evento.target.value))}
        size="small" fullWidth required={nombre === "Especie"} disabled={deshabilitado} className={estilosAcciones.selectMui}
        slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } }}>
        <MenuItem value={nombre === "Especie" ? "" : 0} disabled={nombre === "Especie"} className={estilosAcciones.opcionSelect}>{nombre === "Especie" ? "Seleccioná especie" : enConsulta ? "-" : "Sin especificar"}</MenuItem>
        {valor !== 0 && !opciones.some((opcion) => opcion.id === valor) && <MenuItem value={valor} disabled className={estilosAcciones.opcionSelect}>{nombreActual?.trim() || "-"}</MenuItem>}
        {ordenadas.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={estilosAcciones.opcionSelect}>{opcion.nombre}</MenuItem>)}
    </TextField>;
}

