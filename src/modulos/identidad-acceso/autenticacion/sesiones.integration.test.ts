import { createHash, createHmac, randomUUID } from "node:crypto";
import { Temporal } from "temporal-polyfill";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { cerrarSesion, crearSesion, obtenerSesion } from "./sesiones";

const cookiesSimuladas = vi.hoisted(() => {
    const valores = new Map<string, string>();
    return {
        valores,
        get: vi.fn((nombre: string) => {
            const value = valores.get(nombre);
            return value === undefined ? undefined : { value };
        }),
        set: vi.fn((nombre: string, valor: string) => { valores.set(nombre, valor); }),
        delete: vi.fn((nombre: string) => { valores.delete(nombre); }),
    };
});

vi.mock("next/headers", () => ({ cookies: async () => cookiesSimuladas }));

const nombreCookie = "uam_sesion";
const secretoPrueba = "secreto-exclusivo-de-integracion-de-sesiones";

describe.sequential("revocación de sesiones persistida en PostgreSQL", { timeout: 15000 }, () => {
    let usuarioId: number | undefined;
    const hashesPropios = new Set<string>();

    beforeAll(() => {
        if (!process.env.DATABASE_URL_TEST || process.env.DATABASE_URL !== process.env.DATABASE_URL_TEST.trim()) {
            throw new Error("Estas pruebas requieren DATABASE_URL_TEST como base activa.");
        }
    });

    beforeEach(async () => {
        usuarioId = undefined;
        hashesPropios.clear();
        cookiesSimuladas.valores.clear();
        vi.clearAllMocks();
        vi.stubEnv("SESSION_SECRET", secretoPrueba);
        const usuario = await db.orm.public.Usuario.create({
            username: `test-sesion-${randomUUID()}`,
            passwordHash: "hash-no-utilizable-de-integracion",
            rol: "PRODUCTOR",
            habilitado: true,
        });
        usuarioId = usuario.id;
    });

    afterEach(async () => {
        try {
            await Promise.all([...hashesPropios].map((tokenHash) =>
                db.orm.public.SesionRevocada.where({ tokenHash }).delete(),
            ));
        } finally {
            try {
                if (usuarioId !== undefined) await db.orm.public.Usuario.where({ id: usuarioId }).delete();
            } finally {
                cookiesSimuladas.valores.clear();
                vi.restoreAllMocks();
                vi.unstubAllEnvs();
            }
        }
    });

    function guardarToken(token: string) {
        const tokenHash = createHash("sha256").update(token.split(".")[0]).digest("hex");
        hashesPropios.add(tokenHash);
        cookiesSimuladas.valores.set(nombreCookie, token);
        return tokenHash;
    }

    async function iniciar() {
        await crearSesion(usuarioId!, "PRODUCTOR");
        const token = cookiesSimuladas.valores.get(nombreCookie);
        if (!token) throw new Error("No se creó la cookie de sesión.");
        const tokenHash = guardarToken(token);
        return { token, tokenHash };
    }

    it("persiste el cierre y rechaza una copia restaurada de la cookie", async () => {
        const { token, tokenHash } = await iniciar();
        const sesion = await obtenerSesion();
        expect(sesion).toMatchObject({ usuarioId, rol: "PRODUCTOR", idSesion: expect.any(String) });
        expect(await db.orm.public.SesionRevocada.where({ tokenHash }).first()).toBeNull();

        await cerrarSesion();

        expect(cookiesSimuladas.valores.has(nombreCookie)).toBe(false);
        const revocacion = await db.orm.public.SesionRevocada.where({ tokenHash }).first();
        expect(revocacion?.tokenHash).toBe(tokenHash);
        expect(revocacion?.expiraEn.epochMilliseconds).toBe(sesion!.expiraEn * 1000);
        guardarToken(token);
        expect(await obtenerSesion()).toBeNull();
    });

    it("mantiene válida una segunda sesión del mismo usuario emitida en el mismo segundo", async () => {
        vi.spyOn(Date, "now").mockReturnValue(Date.now());
        const primera = await iniciar();
        const segunda = await iniciar();
        expect(segunda.token).not.toBe(primera.token);

        guardarToken(primera.token);
        await cerrarSesion();
        guardarToken(primera.token);
        expect(await obtenerSesion()).toBeNull();

        guardarToken(segunda.token);
        expect(await obtenerSesion()).toMatchObject({ usuarioId, rol: "PRODUCTOR" });
        expect(await db.orm.public.SesionRevocada.where({ tokenHash: segunda.tokenHash }).first()).toBeNull();
    });

    it("cerrar concurrentemente la misma sesión es idempotente", async () => {
        const { token, tokenHash } = await iniciar();

        await Promise.all([cerrarSesion(), cerrarSesion()]);

        expect(await db.orm.public.SesionRevocada.where({ tokenHash }).all()).toHaveLength(1);
        guardarToken(token);
        expect(await obtenerSesion()).toBeNull();
    });

    it("revoca también una cookie anterior a la incorporación de idSesion", async () => {
        const contenido = Buffer.from(JSON.stringify({
            usuarioId,
            rol: "PRODUCTOR",
            expiraEn: Math.floor(Date.now() / 1000) + 3600,
        })).toString("base64url");
        const firma = createHmac("sha256", secretoPrueba).update(contenido).digest("base64url");
        const token = `${contenido}.${firma}`;
        const tokenHash = guardarToken(token);
        expect(await obtenerSesion()).toMatchObject({ usuarioId, rol: "PRODUCTOR" });

        await cerrarSesion();

        expect(await db.orm.public.SesionRevocada.where({ tokenHash }).first()).not.toBeNull();
        guardarToken(token);
        expect(await obtenerSesion()).toBeNull();
    });

    it("al cerrar elimina revocaciones vencidas y conserva las que siguen vigentes", async () => {
        const vencida = createHash("sha256").update(randomUUID()).digest("hex");
        const vigente = createHash("sha256").update(randomUUID()).digest("hex");
        hashesPropios.add(vencida);
        hashesPropios.add(vigente);
        await db.orm.public.SesionRevocada.create({
            tokenHash: vencida,
            expiraEn: Temporal.Instant.fromEpochMilliseconds(Date.now() - 60000),
        });
        await db.orm.public.SesionRevocada.create({
            tokenHash: vigente,
            expiraEn: Temporal.Instant.fromEpochMilliseconds(Date.now() + 3600000),
        });
        const { tokenHash } = await iniciar();

        await cerrarSesion();

        expect(await db.orm.public.SesionRevocada.where({ tokenHash: vencida }).first()).toBeNull();
        expect(await db.orm.public.SesionRevocada.where({ tokenHash: vigente }).first()).not.toBeNull();
        expect(await db.orm.public.SesionRevocada.where({ tokenHash }).first()).not.toBeNull();
    });
});
