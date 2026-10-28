import { eliminarFotosVencidas } from "../../modulos/publicaciones/eliminar-fotos-vencidas";
import { obtenerVigenciaFotosDias } from "../../modulos/publicaciones/vigencia-fotos";
import type { TareaDiaria } from "./tipos";

export function obtenerTareasDiarias(): readonly TareaDiaria[] {
    obtenerVigenciaFotosDias();
    return [{
        nombre: "publicaciones.eliminar-fotos-vencidas",
        ejecutar: (contexto) => eliminarFotosVencidas(contexto, obtenerVigenciaFotosDias()),
    }];
}
