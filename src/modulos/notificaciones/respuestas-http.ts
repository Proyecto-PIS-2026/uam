import { NextResponse } from "next/server";
import { ErrorNotificaciones } from "./notificaciones";

const cabeceras = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export function respuestaNotificaciones<T>(datos: T) {
    return NextResponse.json(datos, { headers: cabeceras });
}

export function respuestaErrorNotificaciones(error: unknown) {
    if (error instanceof ErrorNotificaciones) {
        return NextResponse.json({ errores: [error.message] }, { status: error.status, headers: cabeceras });
    }
    console.error("No se pudo procesar la notificación:", error);
    return NextResponse.json({ errores: ["No se pudieron procesar las notificaciones."] }, { status: 500, headers: cabeceras });
}
