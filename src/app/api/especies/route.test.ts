import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(),
    obtenerEspecies: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: mocks.obtenerSesion,
}));
vi.mock("@/modulos/consulta-mercado/inicio/consultas-inicio", () => ({
    obtenerEspeciesConPublicacionesActivas: mocks.obtenerEspecies,
}));

import { GET } from "./route";

describe("GET /api/especies", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerSesion.mockResolvedValue(null);
        mocks.obtenerEspecies.mockResolvedValue([]);
    });

    it.each([null, "ADMINISTRADOR", "PRODUCTOR"] as const)("devuelve las especies del mercado para %s", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue(rol ? { usuarioId: 10, rol, expiraEn: 2000000000 } : null);
        const especies = [{ id: 1, nombre: "Manzana", cantidadOperadores: 2 }];
        mocks.obtenerEspecies.mockResolvedValue(especies);

        const respuesta = await GET();

        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual(especies);
        expect(mocks.obtenerEspecies).toHaveBeenCalledOnce();
    });

    it("devuelve 403 para operadores sin consultar datos del mercado ajeno", async () => {
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });

        const respuesta = await GET();

        expect(respuesta.status).toBe(403);
        expect(await respuesta.json()).toEqual({ error: "Los operadores sólo pueden consultar su propio mercado." });
        expect(mocks.obtenerEspecies).not.toHaveBeenCalled();
    });

    it("devuelve 500 si falla la consulta del mercado", async () => {
        const error = new Error("No se pudieron consultar las especies");
        mocks.obtenerEspecies.mockRejectedValue(error);
        const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            const respuesta = await GET();

            expect(respuesta.status).toBe(500);
            expect(await respuesta.json()).toEqual({ error: "Ocurrió un error al procesar la solicitud." });
            expect(registrarError).toHaveBeenCalledWith("ERROR REAL:", error);
        } finally {
            registrarError.mockRestore();
        }
    });
});