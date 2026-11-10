import { describe, expect, it } from "vitest";
import { obtenerDatabaseUrlTest } from "./configuracion-db-test";

const principal = "postgresql://usuario:clave@localhost:5432/uam";
const pruebas = "postgresql://usuario:clave@localhost:5432/uam_pruebas";

describe("configuración de la base de pruebas", () => {
    it("exige una URL de pruebas explícita aunque exista la principal", () => {
        expect(() => obtenerDatabaseUrlTest({ DATABASE_URL: principal })).toThrow("Se requiere DATABASE_URL_TEST");
    });

    it.each([
        principal,
        "postgres://otro:secreto@127.0.0.1/uam?sslmode=require",
        "postgresql://otro:secreto@[::1]:5432/uam?schema=pruebas",
    ])("rechaza la misma base aunque cambien credenciales o parámetros, %s", (urlTest) => {
        expect(() => obtenerDatabaseUrlTest({ DATABASE_URL: principal, DATABASE_URL_TEST: urlTest }))
            .toThrow("una base distinta");
    });

    it.each(["sin-url", "https://localhost/uam_pruebas", "postgresql://localhost/"])(
        "rechaza una URL inválida, %s", (urlTest) => {
            expect(() => obtenerDatabaseUrlTest({ DATABASE_URL_TEST: urlTest })).toThrow();
        },
    );

    it("acepta una base distinta en el mismo servidor", () => {
        expect(obtenerDatabaseUrlTest({ DATABASE_URL: principal, DATABASE_URL_TEST: pruebas })).toBe(pruebas);
    });

    it("permite entornos de pruebas que no configuran una base principal", () => {
        expect(obtenerDatabaseUrlTest({ DATABASE_URL_TEST: pruebas })).toBe(pruebas);
    });
});
