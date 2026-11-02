import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerMiPerfilProductor } from "./consultas-mi-perfil-productor";

const mocks = vi.hoisted(() => ({ exigirProductor: vi.fn(), select: vi.fn(), where: vi.fn(), first: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirProductor: mocks.exigirProductor }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { orm: { public: { Productor: mocks } } } }));

const productor = { id: 5, nombreFantasia: "Granja Norte", whatsApp: "+59899123456", fotoPerfil: "/api/imagenes/foto" };

describe("obtenerMiPerfilProductor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.exigirProductor.mockResolvedValue({ usuarioId: 42 });
        mocks.select.mockReturnValue(mocks);
        mocks.where.mockReturnValue(mocks);
        mocks.first.mockResolvedValue(productor);
    });

    it("consulta los datos actuales del productor de la sesión", async () => {
        expect(await obtenerMiPerfilProductor()).toEqual({ id: 5, nombre: "Granja Norte", codigoPais: "+598", telefono: "99123456", fotoPerfil: "/api/imagenes/foto" });
        expect(mocks.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 42 });
    });

    it("conserva el contacto vacío para un perfil sin número", async () => {
        mocks.first.mockResolvedValue({ ...productor, whatsApp: "", fotoPerfil: null });
        expect(await obtenerMiPerfilProductor()).toMatchObject({ telefono: "", fotoPerfil: null });
    });

    it("separa el código de otro país", async () => {
        mocks.first.mockResolvedValue({ ...productor, whatsApp: "+595912345678" });
        expect(await obtenerMiPerfilProductor()).toMatchObject({ codigoPais: "+595", telefono: "912345678" });
    });

    it("devuelve null si el usuario ya no tiene perfil", async () => {
        mocks.first.mockResolvedValue(null);
        expect(await obtenerMiPerfilProductor()).toBeNull();
    });

    it.each(["Sin sesión", "Rol incorrecto"])("no consulta datos cuando se rechaza el acceso: %s", async (mensaje) => {
        mocks.exigirProductor.mockRejectedValueOnce(new Error(mensaje));
        await expect(obtenerMiPerfilProductor()).rejects.toThrow(mensaje);
        expect(mocks.select).not.toHaveBeenCalled();
    });
});
