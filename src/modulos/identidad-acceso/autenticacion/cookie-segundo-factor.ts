import { cookies } from "next/headers";
import { DURACION_SEGUNDO_FACTOR } from "./segundo-factor";

const nombreCookie = "uam_segundo_factor";

export async function guardarCookieSegundoFactor(token: string) {
    (await cookies()).set(nombreCookie, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
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
