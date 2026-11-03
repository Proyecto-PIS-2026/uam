// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cifrarSecreto, descifrarSecreto, generarSecreto, obtenerUriVinculacion, verificarCodigo } from "./segundo-factor-criptografia";

// RFC 6238, apéndice B: secreto SHA1 "12345678901234567890" en Base32.
const secreto = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

beforeEach(() => vi.stubEnv("TWO_FACTOR_ENCRYPTION_KEY", "ab".repeat(32)));
afterEach(() => vi.unstubAllEnvs());

describe("cifrado del segundo factor", () => {
    it("cifra con un IV nuevo y permite recuperar el secreto de la misma cuenta", () => {
        const primero = cifrarSecreto(secreto, 1);
        const segundo = cifrarSecreto(secreto, 1);
        expect(primero).not.toContain(secreto);
        expect(primero).not.toBe(segundo);
        expect(descifrarSecreto(primero, 1)).toBe(secreto);
        expect(() => descifrarSecreto(primero, 2)).toThrow();
    });

    it("rechaza contenido alterado, secretos sin cifrar y una clave distinta", () => {
        const cifrado = cifrarSecreto(secreto, 1);
        const partes = cifrado.split(".");
        partes[2] = Buffer.alloc(16).toString("base64url");
        expect(() => descifrarSecreto(partes.join("."), 1)).toThrow();
        expect(() => descifrarSecreto(secreto, 1)).toThrow();
        vi.stubEnv("TWO_FACTOR_ENCRYPTION_KEY", "cd".repeat(32));
        expect(() => descifrarSecreto(cifrado, 1)).toThrow();
    });

    it.each(["", "abc", "x".repeat(64)])("exige una clave de cifrado de 32 bytes: %s", (clave) => {
        vi.stubEnv("TWO_FACTOR_ENCRYPTION_KEY", clave);
        expect(() => cifrarSecreto(secreto, 1)).toThrow("TWO_FACTOR_ENCRYPTION_KEY");
    });
});

describe("códigos temporales compatibles con Google Authenticator", () => {
    it.each([[59, "287082"], [1111111109, "081804"], [1111111111, "050471"], [1234567890, "005924"], [2000000000, "279037"]] as const)("valida el vector RFC en el segundo %s", (ahora, codigo) => {
        expect(verificarCodigo(secreto, codigo, ahora, null)).toBe(Math.floor(ahora / 30));
    });

    it("tolera el período anterior pero rechaza códigos vencidos y reutilizados", () => {
        expect(verificarCodigo(secreto, "287082", 60, null)).toBe(1);
        expect(verificarCodigo(secreto, "287082", 90, null)).toBeNull();
        expect(verificarCodigo(secreto, "287082", 59, 1)).toBeNull();
        expect(verificarCodigo(secreto, "287082", 59, 2)).toBeNull();
        expect(verificarCodigo(secreto, "12345", 59, null)).toBeNull();
    });

    it("genera claves aleatorias y un URI con emisor, cuenta y parámetros compatibles", () => {
        expect(generarSecreto()).toMatch(/^[A-Z2-7]{32}$/);
        expect(generarSecreto()).not.toBe(generarSecreto());
        const uri = new URL(obtenerUriVinculacion(secreto, "admin@example.com"));
        expect(uri.protocol).toBe("otpauth:");
        expect(uri.hostname).toBe("totp");
        expect(decodeURIComponent(uri.pathname)).toBe("/UAM:admin@example.com");
        expect(Object.fromEntries(uri.searchParams)).toMatchObject({ secret: secreto, issuer: "UAM", algorithm: "SHA1", digits: "6", period: "30" });
    });
});
