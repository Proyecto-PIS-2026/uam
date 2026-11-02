
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { Temporal } from "temporal-polyfill";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";

export const runtime = "nodejs";

export async function GET() {
    if (process.env.DISABLE_VISIT_TRACKING === "true") {
        return NextResponse.json({ ok: true, omitido: true });
    }

    try {
        const sesion = await obtenerSesion();

        if (sesion) return NextResponse.json({ ok: true, omitido: true });

        const ahora = new Date();
        const anio = ahora.getFullYear();
        const mes = String(ahora.getMonth() + 1).padStart(2, "0");
        const dia = String(ahora.getDate()).padStart(2, "0");
        const fechaStr = `${anio}-${mes}-${dia}`;
        const nombreCookie = `uam_visita_${fechaStr}`;

        const cookieStore = await cookies();
        const visitaRegistrada = cookieStore.get(nombreCookie);

        if (visitaRegistrada) return NextResponse.json({ ok: true, registrado: false });

        const fechaInstant = Temporal.Instant.from(`${fechaStr}T00:00:00Z`);
        const tipoVisitante = "comprador";

        const existente = await db.orm.public.EstadisticaVisita.where({ fecha: fechaInstant, tipoVisitante }).first();

        if (existente) {
            await db.orm.public.EstadisticaVisita.where({ id: existente.id }).update({ cantidad: existente.cantidad + 1 });
        } else {
            await db.orm.public.EstadisticaVisita.create({
                fecha: fechaInstant,
                tipoVisitante,
                cantidad: 1,
            });
        }

        const response = NextResponse.json({ ok: true, registrado: true });

        response.cookies.set(nombreCookie, "1", {
            path: "/",
            maxAge: 60 * 60 * 24,
            httpOnly: true,
            sameSite: "lax",
        });

        return response;
    } catch (error) {
        console.error("Error al registrar visita de comprador:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
