import { beforeEach, describe, expect, it, vi } from "vitest";
import { altaOperador } from "./altaOperador";
import { bajaOperador } from "./bajaOperador";
import { modificarOperador } from "./acciones/modificarOperador";
import { altaProductor } from "../productores/altaProductor";
import { bajaProductor } from "../productores/bajaProductor";
import { modificarProductor } from "../productores/componentes/modificar-productor-por-admin/modificarProductor";
import { redirect } from "next/navigation";
import { RUTA_INICIO_SESION } from "@/modulos/identidad-acceso/autenticacion/rutas-sesion";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(),
    cerrarSesion: vi.fn(),
    transaction: vi.fn(),
    consulta: vi.fn(),
    hash: vi.fn(),
    revalidatePath: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: mocks.obtenerSesion,
    cerrarSesion: mocks.cerrarSesion,
}));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        transaction: mocks.transaction,
        orm: { public: { Nave: { where: mocks.consulta } } },
    },
}));
vi.mock("argon2", () => ({ default: { hash: mocks.hash, argon2id: 2 } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

const acciones = [
    ["alta de operador", altaOperador],
    ["baja de operador", bajaOperador],
    ["modificación de operador", modificarOperador],
    ["alta de productor", altaProductor],
    ["baja de productor", bajaProductor],
    ["modificación de productor", modificarProductor],
] as const;

describe.each(acciones)("autorización real de %s", (_, accion) => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        { sesion: { usuarioId: 55, rol: "OPERADOR", expiraEn: 2000000000 }, status: 403 },
        { sesion: { usuarioId: 56, rol: "PRODUCTOR", expiraEn: 2000000000 }, status: 403 },
    ])("rechaza con $status antes de acceder a la base o hashear contraseñas", async ({ sesion, status }) => {
        mocks.obtenerSesion.mockResolvedValue(sesion);

        await expect(accion(null)).rejects.toMatchObject({ name: "ErrorAutorizacion", status });
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.consulta).not.toHaveBeenCalled();
        expect(mocks.hash).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
        expect(redirect).not.toHaveBeenCalled();
    });

    it("redirige una sesión inválida sin modificar usuarios", async () => {
        mocks.obtenerSesion.mockResolvedValue(null);

        await expect(accion(null)).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledExactlyOnceWith(RUTA_INICIO_SESION);
        expect(mocks.cerrarSesion).toHaveBeenCalledExactlyOnceWith();
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.consulta).not.toHaveBeenCalled();
        expect(mocks.hash).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
});
