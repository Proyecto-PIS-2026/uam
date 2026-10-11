import { beforeEach, describe, expect, it, vi } from "vitest";
import { altaOperador } from "./altaOperador";
import { bajaOperador } from "./bajaOperador";
import { modificarOperador } from "./componentes/modificar-operador-por-admin/modificarOperador";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(),
    transaction: vi.fn(),
    consulta: vi.fn(),
    hash: vi.fn(),
    revalidatePath: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: mocks.obtenerSesion,
}));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        transaction: mocks.transaction,
        orm: { public: { Nave: { where: mocks.consulta } } },
    },
}));
vi.mock("argon2", () => ({ default: { hash: mocks.hash, argon2id: 2 } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const acciones = [
    ["alta", altaOperador],
    ["baja", bajaOperador],
    ["modificación activa", modificarOperador],
] as const;

describe.each(acciones)("autorización real de %s de operador", (_, accion) => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        { sesion: null, status: 401 },
        { sesion: { usuarioId: 55, rol: "OPERADOR", expiraEn: 2000000000 }, status: 403 },
        { sesion: { usuarioId: 56, rol: "PRODUCTOR", expiraEn: 2000000000 }, status: 403 },
    ])("rechaza con $status antes de acceder a la base o hashear contraseñas", async ({ sesion, status }) => {
        mocks.obtenerSesion.mockResolvedValue(sesion);

        await expect(accion(null)).rejects.toMatchObject({ name: "ErrorAutorizacion", status });
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.consulta).not.toHaveBeenCalled();
        expect(mocks.hash).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
});