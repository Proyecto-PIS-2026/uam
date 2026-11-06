import { NextResponse } from "next/server";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { registrarContacto } from "@/modulos/administracion/estadisticas/registrar-estadisticas";

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
            await registrarContacto(usuarioVinculado.username);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error al registrar estadística de contacto de WhatsApp:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}