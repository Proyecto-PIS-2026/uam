"use server";

import { redirect } from "next/navigation";
import { cerrarSesion } from "./sesiones";

export async function cerrarSesionYVolverAlInicio() {
    await cerrarSesion();
    redirect("/inicio");
}