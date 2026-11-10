import { randomUUID } from "node:crypto";
import { Temporal } from "temporal-polyfill";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { registrarContacto, registrarPublicacion, registrarVisita } from "./registrar-estadisticas";

const fecha = "2026-11-06";
const instante = Temporal.Instant.from(`${fecha}T00:00:00Z`);
const claves: string[] = [];

afterAll(async () => {
    for (const clave of claves) {
        await db.orm.public.EstadisticaVisita.where({ tipoVisitante: clave }).deleteAll();
        await db.orm.public.EstadisticaContacto.where({ username: clave }).deleteAll();
        await db.orm.public.EstadisticaPublicacion.where({ username: clave }).deleteAll();
    }
    await db.close();
});

describe("contadores diarios con operaciones concurrentes", () => {
    it.each(["visita", "contacto", "publicacion"] as const)("conserva todos los incrementos de %s, incluidos los primeros simultáneos", async (tipo) => {
        const clave = `estadistica-${randomUUID()}`;
        claves.push(clave);
        const registrar = tipo === "visita" ? registrarVisita : tipo === "contacto" ? registrarContacto : registrarPublicacion;
        await Promise.all(Array.from({ length: 20 }, () => registrar(clave, fecha)));
        await Promise.all(Array.from({ length: 10 }, () => registrar(clave, fecha)));

        const filas = tipo === "visita"
            ? await db.orm.public.EstadisticaVisita.where({ fecha: instante, tipoVisitante: clave }).all()
            : tipo === "contacto"
                ? await db.orm.public.EstadisticaContacto.where({ fecha: instante, username: clave }).all()
                : await db.orm.public.EstadisticaPublicacion.where({ fecha: instante, username: clave }).all();
        expect(filas).toHaveLength(1);
        expect(filas[0].cantidad).toBe(30);
    });
});
