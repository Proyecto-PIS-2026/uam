
import { NextResponse } from "next/server";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { Temporal } from "temporal-polyfill";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const sesion = await obtenerSesion();
        if (sesion?.rol === "ADMINISTRADOR") return NextResponse.json({ ok: true });      
        const body = await request.json();
        const { tipo, entidadId, publicacionId } = body;
        if ((tipo !== "OPERADOR" && tipo !== "PRODUCTOR") || !Number.isSafeInteger(entidadId) || entidadId <= 0 || (publicacionId !== undefined && (!Number.isSafeInteger(publicacionId) || publicacionId <= 0))) {
            return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
        }
        let usuarioId: number | null = null;
        if (tipo === "OPERADOR") {
            const operador = await db.orm.public.Operador.where({ id: entidadId }).select("usuarioId").first();
            usuarioId = operador?.usuarioId ?? null;
        } else {
            const productor = await db.orm.public.Productor.where({ id: entidadId }).select("usuarioId").first();
            usuarioId = productor?.usuarioId ?? null;
        }
        if (!usuarioId) return NextResponse.json({ error: "Entidad no encontrada" }, { status: 404 });  
        const usuarioVinculado = await db.orm.public.Usuario.select("username").where({ id: usuarioId }).first();
        if (usuarioVinculado?.username) {
            const ahora = new Date();
            const anio = ahora.getFullYear();
            const mes = String(ahora.getMonth() + 1).padStart(2, "0");
            const dia = String(ahora.getDate()).padStart(2, "0");
            const fechaStr = `${anio}-${mes}-${dia}`;
            const fechaInstant = Temporal.Instant.from(`${fechaStr}T00:00:00Z`);
            const username = usuarioVinculado.username;
            if (publicacionId !== undefined) {
                let pertenece = false;
                if (tipo === "OPERADOR") {
                    const vinculo = await db.orm.public.PublicacionOperador.where({ operadorId: entidadId, publicacionId }).first();
                    pertenece = Boolean(vinculo);
                } else {
                    const vinculo = await db.orm.public.PublicacionProductor.where({ publicacionId }).where((pp) => pp.productor.some((productor) => productor.id.eq(entidadId))).first();
                    pertenece = Boolean(vinculo);
                }
                if (!pertenece) {
                    return NextResponse.json(
                        { error: "La publicación no pertenece a la entidad seleccionada" },
                        { status: 404 },
                    );
                }
                const publicacion = await db.orm.public.Publicacion.where({ id: publicacionId }).include("especie", (especie) => especie.select("nombreEspecie")).first();
                const nombreEspecie = publicacion?.especie?.nombreEspecie;
                if (!nombreEspecie) {
                    return NextResponse.json(
                        { error: "No se encontró la especie de la publicación" },
                        { status: 404 },
                    );
                }
                const existente = await db.orm.public.EstadisticaContactoPublicacion.where({ fecha: fechaInstant, username, especie: nombreEspecie }).first();
                if (existente) {
                    await db.orm.public.EstadisticaContactoPublicacion.where({ id: existente.id }).update({ cantidad: existente.cantidad + 1 });
                } else {
                    await db.orm.public.EstadisticaContactoPublicacion.create({
                        fecha: fechaInstant,
                        username,
                        especie: nombreEspecie,
                        cantidad: 1,
                    });
                }
            } else {
                const existente = await db.orm.public.EstadisticaContacto.where({ fecha: fechaInstant, username }).first();
                if (existente) {
                    await db.orm.public.EstadisticaContacto.where({ id: existente.id }).update({ cantidad: existente.cantidad + 1 });
                } else {
                    await db.orm.public.EstadisticaContacto.create({
                        fecha: fechaInstant,
                        username,
                        cantidad: 1,
                    });
                }
            }
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error al registrar estadística de contacto de WhatsApp:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
