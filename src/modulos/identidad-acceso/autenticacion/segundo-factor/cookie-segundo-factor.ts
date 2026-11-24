import { cookies } from "next/headers";
import { DURACION_SEGUNDO_FACTOR } from "./segundo-factor";
import { usarCookiesSeguras } from "../configuracion-cookies";

const nombreCookie = "uam_segundo_factor";

export async function guardarCookieSegundoFactor(token: string) {
    (await cookies()).set(nombreCookie, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: usarCookiesSeguras(),
        path: "/",
        maxAge: DURACION_SEGUNDO_FACTOR,
    });
}

export async function obtenerTokenSegundoFactor(): Promise<string> {
    return (await cookies()).get(nombreCookie)?.value ?? "";
}

export async function borrarCookieSegundoFactor() {
    (await cookies()).delete(nombreCookie);
}
