// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { borrarCookieSegundoFactor, guardarCookieSegundoFactor, obtenerTokenSegundoFactor } from "./cookie-segundo-factor";

const almacen = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => almacen) }));
vi.mock("./segundo-factor", () => ({ DURACION_SEGUNDO_FACTOR: 600 }));

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_COOKIE_SECURE", undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("cookie del segundo factor", () => {
    it.each([
        [undefined, true],
        ["true", true],
        ["false", false],
    ] as const)("usa el transporte configurado %j sin cambiar la protección ni el plazo de diez minutos", async (valor, secure) => {
        vi.stubEnv("AUTH_COOKIE_SECURE", valor);

        await guardarCookieSegundoFactor("intento-de-prueba");

        expect(almacen.set).toHaveBeenCalledWith("uam_segundo_factor", "intento-de-prueba", {
            httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 600,
        });
    });

    it("no emite la cookie con una configuración inválida", async () => {
        vi.stubEnv("AUTH_COOKIE_SECURE", "flase");
        await expect(guardarCookieSegundoFactor("intento-de-prueba")).rejects.toThrow("AUTH_COOKIE_SECURE");
        expect(almacen.set).not.toHaveBeenCalled();
    });

    it("recupera el intento recibido y devuelve vacío cuando falta la cookie", async () => {
        almacen.get.mockReturnValueOnce({ value: "intento-de-prueba" }).mockReturnValueOnce(undefined);
        expect(await obtenerTokenSegundoFactor()).toBe("intento-de-prueba");
        expect(await obtenerTokenSegundoFactor()).toBe("");
        expect(almacen.get).toHaveBeenCalledWith("uam_segundo_factor");
    });

    it("elimina la cookie al terminar o cancelar el intento", async () => {
        await borrarCookieSegundoFactor();
        expect(almacen.delete).toHaveBeenCalledWith("uam_segundo_factor");
    });
});
