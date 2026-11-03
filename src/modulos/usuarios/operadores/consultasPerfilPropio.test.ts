import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPerfilPropioOperador } from "./consultasPerfilPropio";

const mocks = vi.hoisted(() => ({
    obtenerOperadorActual: vi.fn(),
    operador: {
        select: vi.fn().mockReturnThis(),
        include: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        first: vi.fn(),
    },
}));

vi.mock("./operador-actual", () => ({ obtenerOperadorActual: mocks.obtenerOperadorActual }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: { Operador: mocks.operador } } },
}));

describe("obtenerPerfilPropioOperador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerOperadorActual.mockResolvedValue({ id: 7 });
    });

    it("devuelve el perfil normalizado, ordena locales y convierte fechas", async () => {
        mocks.operador.first.mockResolvedValue({
            id: 7,
            nombreFantasia: "Frutas del Norte",
            whatsApp: " ",
            fotoPerfil: "/foto.webp",
            comentario: "Licencia: 2999-11-05 - 2999-11-12",
            enLicencia: true,
            usuario: { username: "frutas" },
            locales: [
                { numeroLocal: "20", finContrato: null, nave: { nombreNave: "B" } },
                { numeroLocal: "2", finContrato: Temporal.Instant.from("2999-11-12T12:00:00Z"), nave: { nombreNave: "A" } },
                { numeroLocal: "10", finContrato: null, nave: { nombreNave: "A" } },
            ],
        });

        await expect(obtenerPerfilPropioOperador()).resolves.toEqual({
            id: 7,
            nombre: "Frutas del Norte",
            nombreUsuario: "frutas",
            contacto: null,
            fotoPerfil: "/foto.webp",
            comentario: "Licencia: 2999-11-05 - 2999-11-12",
            enLicencia: true,
            locales: [
                { nave: "A", local: "2", finContrato: "2999-11-12" },
                { nave: "A", local: "10", finContrato: null },
                { nave: "B", local: "20", finContrato: null },
            ],
        });
        expect(mocks.operador.where).toHaveBeenCalledWith({ id: 7 });
    });

    it("informa cuando el perfil dejó de existir", async () => {
        mocks.operador.first.mockResolvedValue(null);
        await expect(obtenerPerfilPropioOperador()).rejects.toThrow("No se encontró el perfil");
    });
});
