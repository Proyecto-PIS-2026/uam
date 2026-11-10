import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificarCambioCatalogoOperador, notificarCambioPublicacion } from "./publicaciones";

const { sql, ejecutar } = vi.hoisted(() => ({
    sql: vi.fn((partes: TemplateStringsArray, ...valores: unknown[]) => ({
        returnsRow: () => ({ build: () => ({ texto: partes.join("?"), valores }) }),
    })),
    ejecutar: vi.fn(),
}));

vi.mock("../persistencia/prisma/db", () => ({ db: { raw: { sql } } }));

const transaccion = { execute: ejecutar } as unknown as Parameters<typeof notificarCambioPublicacion>[0];

beforeEach(() => {
    vi.clearAllMocks();
    ejecutar.mockResolvedValue(undefined);
});

describe("notificaciones transaccionales de publicaciones", () => {
    it("notifica la publicación mediante la transacción recibida y un payload parametrizado", async () => {
        await notificarCambioPublicacion(transaccion, { operadorId: 7, publicacionId: 43 });

        expect(ejecutar).toHaveBeenCalledExactlyOnceWith({
            texto: "SELECT pg_notify('uam_publicaciones', ?)::text AS notificado",
            valores: ['{"operadorId":7,"publicacionId":43}'],
        });
    });

    it("notifica el catálogo del operador sin inventar una publicación", async () => {
        await notificarCambioCatalogoOperador(transaccion, 7);

        expect(ejecutar).toHaveBeenCalledExactlyOnceWith({
            texto: "SELECT pg_notify('uam_publicaciones', ?)::text AS notificado",
            valores: ['{"operadorId":7}'],
        });
    });

    it("propaga el fallo para que la transacción no confirme sin notificar", async () => {
        const error = new Error("Falló PostgreSQL");
        ejecutar.mockRejectedValue(error);

        await expect(notificarCambioCatalogoOperador(transaccion, 7)).rejects.toBe(error);
    });
});
