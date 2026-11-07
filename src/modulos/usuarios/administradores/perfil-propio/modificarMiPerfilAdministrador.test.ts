import { beforeEach, describe, expect, it, vi } from "vitest";
import { modificarMiPerfilAdministrador } from "./modificarMiPerfilAdministrador";

const autorizacion = vi.hoisted(() => ({ exigirAdministrador: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => autorizacion);

vi.mock("@/modulos/identidad-acceso/autorizacion/control-acciones", () => ({
    controlarSesionEnAccion: (control: () => Promise<unknown>) => control(),
}));

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
    propio: { id: number; usuarioId: number } | null;
    usuarioConEseNombre: { id: number } | null;
};

const estadoPorDefecto: EstadoBase = {
    propio: { id: 101, usuarioId: 7 },
    usuarioConEseNombre: null,
};

function prepararBase(cambios: Partial<EstadoBase> = {}) {
    const estado = { ...estadoPorDefecto, ...cambios };

    mockDb.administrador.first
        .mockReset()
        .mockResolvedValue(estado.propio);
    mockDb.usuario.first.mockReset().mockResolvedValue(estado.usuarioConEseNombre);
}

const datosValidos = { nombreUsuario: "ana.admin" };

describe("modificarMiPerfilAdministrador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        autorizacion.exigirAdministrador.mockResolvedValue({ usuarioId: 7, rol: "ADMINISTRADOR" });
        prepararBase();
        mockDb.transaction.mockImplementation(async (operaciones: (tx: unknown) => unknown) =>
            operaciones({ orm: { public: { Administrador: mockDb.administrador, Usuario: mockDb.usuario } } }),
        );
    });

    it("rechaza usuarios sin permiso antes de consultar la base", async () => {
        autorizacion.exigirAdministrador.mockRejectedValueOnce(new Error("No autorizado"));

        await expect(modificarMiPerfilAdministrador(datosValidos)).rejects.toThrow("No autorizado");
        expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("rechaza datos que no son un objeto", async () => {
        expect(await modificarMiPerfilAdministrador(null)).toEqual({
            esValido: false,
            errores: ["Los datos del administrador no son válidos."],
        });
        expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("modifica la cuenta de la sesión aunque el formulario mande otro id", async () => {
        await modificarMiPerfilAdministrador({ ...datosValidos, administradorId: 999 });

        expect(mockDb.administrador.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 7 });
        expect(mockDb.administrador.update).not.toHaveBeenCalled();
        expect(mockDb.usuario.where).toHaveBeenLastCalledWith({ id: 7 });
    });

    it("informa si no encuentra el perfil del administrador", async () => {
        prepararBase({ propio: null });

        expect(await modificarMiPerfilAdministrador(datosValidos)).toEqual({
            esValido: false,
            errores: ["No se encontró tu perfil de administrador."],
        });
        expect(mockDb.administrador.update).not.toHaveBeenCalled();
    });

    it("devuelve los errores de validación sin guardar", async () => {
        expect(await modificarMiPerfilAdministrador({ ...datosValidos, nombreUsuario: "a" })).toEqual({
            esValido: false,
            errores: ["El nombre de usuario debe tener al menos 3 caracteres."],
        });
        expect(mockDb.administrador.update).not.toHaveBeenCalled();
        expect(mockDb.usuario.update).not.toHaveBeenCalled();
    });

    it.each(["otro@uam.com", "", "correo-invalido", null])("no modifica el correo aunque se inyecte %j", async (email) => {
        expect(await modificarMiPerfilAdministrador({ ...datosValidos, email, correo: email })).toEqual({
            esValido: true,
            id: 101,
            mensaje: "Tu perfil se actualizó correctamente.",
        });
        expect(mockDb.administrador.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 7 });
        expect(mockDb.administrador.update).not.toHaveBeenCalled();
        expect(mockDb.usuario.update).toHaveBeenCalledExactlyOnceWith({ username: "ana.admin" });
    });

    it("rechaza un nombre que ya usa otro usuario", async () => {
        prepararBase({ usuarioConEseNombre: { id: 30 } });

        expect(await modificarMiPerfilAdministrador(datosValidos)).toEqual({
            esValido: false,
            errores: ["Ya existe un usuario con ese nombre."],
        });
        expect(mockDb.usuario.update).not.toHaveBeenCalled();
    });

    it("permite guardar sin cambiar el nombre", async () => {
        prepararBase({ usuarioConEseNombre: { id: 7 } });

        expect(await modificarMiPerfilAdministrador(datosValidos)).toEqual({
            esValido: true,
            id: 101,
            mensaje: "Tu perfil se actualizó correctamente.",
        });
    });

    it("guarda solo el nombre aunque se envíe una contraseña", async () => {
        await modificarMiPerfilAdministrador({
            ...datosValidos,
            contraseña: "nueva12345",
            confirmacionContraseña: "nueva12345",
        });

        expect(mockDb.administrador.update).not.toHaveBeenCalled();
        expect(mockDb.usuario.update).toHaveBeenCalledWith({ username: "ana.admin" });
    });

    it("refresca las páginas solo si se guardó", async () => {
        await modificarMiPerfilAdministrador(datosValidos);
        expect(cache.revalidatePath).toHaveBeenCalledWith("/", "layout");

        vi.clearAllMocks();
        prepararBase({ usuarioConEseNombre: { id: 30 } });
        await modificarMiPerfilAdministrador(datosValidos);
        expect(cache.revalidatePath).not.toHaveBeenCalled();
    });
});
