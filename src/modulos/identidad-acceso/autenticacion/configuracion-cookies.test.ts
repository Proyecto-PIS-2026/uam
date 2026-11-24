// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { usarCookiesSeguras } from "./configuracion-cookies";

afterEach(() => vi.unstubAllEnvs());

describe("configuración de cookies de autenticación", () => {
    it.each([undefined, "", "   "])("mantiene HTTPS en producción sin una configuración explícita: %j", (valor) => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("AUTH_COOKIE_SECURE", valor);
        expect(usarCookiesSeguras()).toBe(true);
    });

    it.each(["development", "test"] as const)("conserva el acceso HTTP predeterminado en %s", (entorno) => {
        vi.stubEnv("NODE_ENV", entorno);
        vi.stubEnv("AUTH_COOKIE_SECURE", undefined);
        expect(usarCookiesSeguras()).toBe(false);
    });

    it.each(["false", " FALSE "])("permite HTTP en producción solo al indicarlo explícitamente: %s", (valor) => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("AUTH_COOKIE_SECURE", valor);
        expect(usarCookiesSeguras()).toBe(false);
    });

    it.each(["production", "development", "test"] as const)("permite exigir HTTPS explícitamente en %s", (entorno) => {
        vi.stubEnv("NODE_ENV", entorno);
        vi.stubEnv("AUTH_COOKIE_SECURE", " TRUE ");
        expect(usarCookiesSeguras()).toBe(true);
    });

    it.each(["0", "1", "no", "off", "flase", '"false"'])("rechaza un valor inválido sin permitir HTTP silenciosamente: %s", (valor) => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("AUTH_COOKIE_SECURE", valor);
        expect(() => usarCookiesSeguras()).toThrow("AUTH_COOKIE_SECURE debe ser true o false.");
    });
});
