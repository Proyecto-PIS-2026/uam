import { NextResponse } from "next/server";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { Temporal } from "temporal-polyfill";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const sesion = await obtenerSesion();
        
        if (sesion?.rol === "ADMINISTRADOR") {
            return NextResponse.json({ ok: true });
        }

        const body = await request.json();
        const { tipo, entidadId } = body;

        if (!tipo || !entidadId) {
            return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
        }

        let usuarioId: number | null = null;

        if (tipo === "OPERADOR") {
            const operador = await db.orm.public.Operador.where({ id: entidadId }).select("usuarioId").first();
            usuarioId = operador?.usuarioId ?? null;
        } else if (tipo === "PRODUCTOR") {
            const productor = await db.orm.public.Productor.where({ id: entidadId }).select("usuarioId").first();
            usuarioId = productor?.usuarioId ?? null;
        }

        if (!usuarioId) {
            return NextResponse.json({ error: "Entidad no encontrada" }, { status: 404 });
        }

        const usuarioVinculado = await db.orm.public.Usuario.select("username").where({ id: usuarioId }).first();
        if (usuarioVinculado?.username) {
            const ahora = new Date();
            const anio = ahora.getFullYear();
            const mes = String(ahora.getMonth() + 1).padStart(2, "0");
            const dia = String(ahora.getDate()).padStart(2, "0");
            const fechaStr = `${anio}-${mes}-${dia}`;
            const fechaInstant = Temporal.Instant.from(`${fechaStr}T00:00:00Z`);
            const username = usuarioVinculado.username;

            const existente = await db.orm.public.EstadisticaContacto
                .where({ fecha: fechaInstant, username })
                .first();

            if (existente) {
                await db.orm.public.EstadisticaContacto
                    .where({ id: existente.id })
                    .update({ cantidad: existente.cantidad + 1 });
            } else {
                await db.orm.public.EstadisticaContacto.create({
                    fecha: fechaInstant,
                    username: username,
                    cantidad: 1,
                });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error al registrar estadística de contacto de WhatsApp:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}