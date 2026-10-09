// @vitest-environment node

import { createHmac as crearFirmaHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearSesion, obtenerSesion } from "./sesiones";

const cookiesSimuladas = vi.hoisted(() => ({
    get: vi.fn(),
    set: vi.fn(),
}));

vi.mock("next/headers", () => ({
    cookies: vi.fn(async () => cookiesSimuladas),
}));

const secretoPrueba = "secreto-aleatorio-exclusivo-para-las-pruebas";
const fechaPrueba = new Date("2030-01-01T12:00:00Z");
const segundosActuales = Math.floor(fechaPrueba.getTime() / 1000);

function firmarContenido(contenido: string) {
    const firma = crearFirmaHmac("sha256", secretoPrueba)
        .update(contenido)
        .digest("base64url");
    return `${contenido}.${firma}`;
}

function configurarCookie(datos: unknown) {
    const contenido = Buffer.from(JSON.stringify(datos)).toString("base64url");
    cookiesSimuladas.get.mockReturnValue({ value: firmarContenido(contenido) });
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("SESSION_SECRET", secretoPrueba);
    vi.stubEnv("NODE_ENV", "development");
    vi.useFakeTimers();
    vi.setSystemTime(fechaPrueba);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
});

describe("crearSesion", () => {
    it.each(["ADMINISTRADOR", "OPERADOR", "PRODUCTOR"] as const)(
        "crea una cookie firmada de ocho horas para %s",
        async (rol) => {
            await crearSesion(4, rol);

            const [nombre, valor, opciones] = cookiesSimuladas.set.mock.calls[0];
            const datosEsperados = { usuarioId: 4, rol, expiraEn: segundosActuales + 28800 };
            const contenido = Buffer.from(JSON.stringify(datosEsperados)).toString("base64url");

            expect(nombre).toBe("uam_sesion");
            expect(valor).toBe(firmarContenido(contenido));
            expect(opciones).toEqual({
                httpOnly: true,
                sameSite: "lax",
                secure: false,
                path: "/",
                maxAge: 28800,
            });
        },
    );

    it("exige HTTPS para la cookie en produccion", async () => {
        vi.stubEnv("NODE_ENV", "production");

        await crearSesion(4, "PRODUCTOR");

        expect(cookiesSimuladas.set.mock.calls[0][2].secure).toBe(true);
    });

    it("no emite una cookie si falta el secreto de firma", async () => {
        vi.stubEnv("SESSION_SECRET", "");

        await expect(crearSesion(4, "PRODUCTOR"))
            .rejects.toThrow("SESSION_SECRET no está configurado.");
        expect(cookiesSimuladas.set).not.toHaveBeenCalled();
    });
});

describe("obtenerSesion", () => {
    it.each(["ADMINISTRADOR", "OPERADOR", "PRODUCTOR"] as const)(
        "recupera una sesion vigente de %s",
        async (rol) => {
            const datos = { usuarioId: 4, rol, expiraEn: segundosActuales + 60 };
            configurarCookie(datos);

            expect(await obtenerSesion()).toEqual(datos);
            expect(cookiesSimuladas.get).toHaveBeenCalledWith("uam_sesion");
        },
    );

    it("recupera la misma sesion que se emitio para un productor", async () => {
        await crearSesion(4, "PRODUCTOR");
        cookiesSimuladas.get.mockReturnValue({ value: cookiesSimuladas.set.mock.calls[0][1] });

        expect(await obtenerSesion()).toEqual({
            usuarioId: 4,
            rol: "PRODUCTOR",
            expiraEn: segundosActuales + 28800,
        });
    });

    it("devuelve null si no hay cookie", async () => {
        expect(await obtenerSesion()).toBeNull();
    });

    it.each(["", "contenido", ".firma", "contenido."])(
        "rechaza una cookie incompleta: %s",
        async (valor) => {
            cookiesSimuladas.get.mockReturnValue({ value: valor });

            expect(await obtenerSesion()).toBeNull();
        },
    );

    it("rechaza una firma de longitud incorrecta", async () => {
        cookiesSimuladas.get.mockReturnValue({ value: "contenido.firma" });

        expect(await obtenerSesion()).toBeNull();
    });

    it("rechaza una firma incorrecta de la longitud esperada", async () => {
        const firmaFalsa = Buffer.alloc(32).toString("base64url");
        cookiesSimuladas.get.mockReturnValue({ value: `contenido.${firmaFalsa}` });

        expect(await obtenerSesion()).toBeNull();
    });

    it("rechaza el rol alterado sin una nueva firma", async () => {
        const datos = { usuarioId: 4, rol: "PRODUCTOR", expiraEn: segundosActuales + 60 };
        const original = Buffer.from(JSON.stringify(datos)).toString("base64url");
        const alterado = Buffer.from(JSON.stringify({ ...datos, rol: "ADMINISTRADOR" }))
            .toString("base64url");
        const firmaOriginal = firmarContenido(original).split(".")[1];
        cookiesSimuladas.get.mockReturnValue({ value: `${alterado}.${firmaOriginal}` });

        expect(await obtenerSesion()).toBeNull();
    });

    it.each([segundosActuales - 1, segundosActuales])(
        "rechaza una sesion vencida en %s",
        async (expiraEn) => {
            configurarCookie({ usuarioId: 4, rol: "PRODUCTOR", expiraEn });

            expect(await obtenerSesion()).toBeNull();
        },
    );

    it.each(["4", null, 1.5, Number.MAX_SAFE_INTEGER + 1])(
        "rechaza un identificador de usuario invalido: %s",
        async (usuarioId) => {
            configurarCookie({ usuarioId, rol: "PRODUCTOR", expiraEn: segundosActuales + 60 });

            expect(await obtenerSesion()).toBeNull();
        },
    );

    it.each(["DESCONOCIDO", "", null])(
        "rechaza un rol no admitido: %s",
        async (rol) => {
            configurarCookie({ usuarioId: 4, rol, expiraEn: segundosActuales + 60 });

            expect(await obtenerSesion()).toBeNull();
        },
    );

    it("rechaza un contenido firmado que no es JSON", async () => {
        const contenido = Buffer.from("contenido-no-json").toString("base64url");
        cookiesSimuladas.get.mockReturnValue({ value: firmarContenido(contenido) });

        expect(await obtenerSesion()).toBeNull();
    });

    it("rechaza un contenido JSON nulo", async () => {
        configurarCookie(null);

        expect(await obtenerSesion()).toBeNull();
    });
});
