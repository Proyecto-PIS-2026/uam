"use client";

import { RUTA_SESION_FINALIZADA } from "./rutas-sesion";

let redirigiendo = false;

function esSolicitudPropia(entrada: RequestInfo | URL) {
    const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    return new URL(url, window.location.href).origin === window.location.origin;
}

export async function fetchConSesion(entrada: RequestInfo | URL, opciones?: RequestInit): Promise<Response> {
    const respuesta = await (opciones === undefined ? fetch(entrada) : fetch(entrada, opciones));
    opciones?.signal?.throwIfAborted();
    if (respuesta.status === 401 && esSolicitudPropia(entrada)) {
        if (!redirigiendo) {
            redirigiendo = true;
            window.location.replace(RUTA_SESION_FINALIZADA);
        }
        throw new Error("Tu sesión finalizó. Volvé a iniciar sesión.");
    }
    return respuesta;
}
