import { beforeEach, describe, expect, it, vi } from "vitest";
import { modificarAdministrador } from "./modificarAdministrador";

const autorizacion = vi.hoisted(() => ({ exigirAdministrador: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => autorizacion);

const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);

const mockDb = vi.hoisted(() => ({
    administrador: {
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        first: vi.fn(),
        update: vi.fn(),
    },
    usuario: {
        where: vi.fn().mockReturnThis(),
        first: vi.fn(),
        update: vi.fn(),
    },
    transaction: vi.fn(),
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: { public: { Administrador: mockDb.administrador, Usuario: mockDb.usuario } },
        transaction: mockDb.transaction,
    },
}));

type EstadoBase = {
    administrador: { id: number; usuarioId: number } | null; // El administrador a modificar
    administradorConEseCorreo: { id: number } | null; // Un administrador que ya usa el correo nuevo
    usuarioConEseNombre: { id: number } | null; // Un usuario que ya usa el nombre nuevo
};

const estadoPorDefecto: EstadoBase = {
    administrador: { id: 102, usuarioId: 2 },
    administradorConEseCorreo: null,
    usuarioConEseNombre: null,
};

function prepararBase(cambios: Partial<EstadoBase> = {}) {
    const estado = { ...estadoPorDefecto, ...cambios };

    mockDb.administrador.first
        .mockReset()
        .mockResolvedValueOnce(estado.administrador)
        .mockResolvedValueOnce(estado.administradorConEseCorreo);
    mockDb.usuario.first.mockReset().mockResolvedValue(estado.usuarioConEseNombre);
}

const datosValidos = {
    administradorId: 102,
    nombreUsuario: "beto.admin",
    email: "beto@example.com",
};

describe("modificarAdministrador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        autorizacion.exigirAdministrador.mockResolvedValue({ usuarioId: 7, rol: "ADMINISTRADOR" });
        prepararBase();
        mockDb.transaction.mockImplementation(async (operaciones: (tx: unknown) => unknown) =>
            operaciones({ orm: { public: { Administrador: mockDb.administrador, Usuario: mockDb.usuario } } }),
        );
    });

    it("rechaza usuarios sin permiso antes de consultar o actualizar datos", async () => {
        autorizacion.exigirAdministrador.mockRejectedValueOnce(new Error("No autorizado"));

        await expect(modificarAdministrador(datosValidos)).rejects.toThrow("No autorizado");
        expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("devuelve los errores de validación sin tocar la base", async () => {
        expect(await modificarAdministrador({ ...datosValidos, email: "" })).toEqual({
            esValido: false,
            errores: ["El correo electrónico es obligatorio."],
        });
        expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("rechaza la modificación si el administrador ya no existe", async () => {
        prepararBase({ administrador: null });

        expect(await modificarAdministrador(datosValidos)).toEqual({ esValido: false, errores: ["El administrador ya no existe."] });
        expect(mockDb.administrador.update).not.toHaveBeenCalled();
    });

    it("no permite modificar la propia cuenta", async () => {
        autorizacion.exigirAdministrador.mockResolvedValue({ usuarioId: 2, rol: "ADMINISTRADOR" });

        expect(await modificarAdministrador(datosValidos)).toEqual({
            esValido: false,
            errores: ["Tus propios datos se modifican desde Mi Perfil."],
        });
        expect(mockDb.administrador.update).not.toHaveBeenCalled();
    });

    it("rechaza un correo que ya usa otro administrador", async () => {
        prepararBase({ administradorConEseCorreo: { id: 103 } });

        expect(await modificarAdministrador(datosValidos)).toEqual({
            esValido: false,
            errores: ["Ya existe un administrador con ese correo electrónico."],
        });
        expect(mockDb.administrador.update).not.toHaveBeenCalled();
    });

    it("rechaza un nombre que ya usa otro usuario", async () => {
        prepararBase({ usuarioConEseNombre: { id: 30 } });

        expect(await modificarAdministrador(datosValidos)).toEqual({
            esValido: false,
            errores: ["Ya existe un usuario con ese nombre."],
        });
        expect(mockDb.usuario.update).not.toHaveBeenCalled();
    });

    it("permite guardar sin cambiar el correo ni el nombre", async () => {
        prepararBase({ administradorConEseCorreo: { id: 102 }, usuarioConEseNombre: { id: 2 } });

        expect(await modificarAdministrador(datosValidos)).toEqual({
            esValido: true,
            id: 102,
            mensaje: "Administrador modificado correctamente.",
        });
    });

    it("guarda el correo y el nombre sin tocar el segundo factor", async () => {
        expect(await modificarAdministrador(datosValidos)).toEqual({
            esValido: true,
            id: 102,
            mensaje: "Administrador modificado correctamente.",
        });

        expect(mockDb.administrador.update).toHaveBeenCalledWith({ email: "beto@example.com" });
        expect(mockDb.usuario.where).toHaveBeenLastCalledWith({ id: 2 });
        expect(mockDb.usuario.update).toHaveBeenCalledWith({ username: "beto.admin" });
    });

    it("refresca el panel y el perfil después de guardar", async () => {
        await modificarAdministrador(datosValidos);

        expect(cache.revalidatePath).toHaveBeenCalledWith("/administracion");
        expect(cache.revalidatePath).toHaveBeenCalledWith("/gestion-administradores/[id]", "page");
    });
});