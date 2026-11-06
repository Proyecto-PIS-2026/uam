import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { modificarMiPerfilProductor } from "./modificarMiPerfilProductor";

const mocks = vi.hoisted(() => ({
    exigirProductor: vi.fn(), cerrarSesion: vi.fn(), redirect: vi.fn(),
    productor: { select: vi.fn(), where: vi.fn(), first: vi.fn(), update: vi.fn() },
    usuario: { where: vi.fn(), update: vi.fn() },
    transaction: vi.fn(), execute: vi.fn(), revalidatePath: vi.fn(),
    guardarFoto: vi.fn(),
}));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", async (original) => ({
    ...await original<typeof import("@/modulos/identidad-acceso/autorizacion/controles")>(), exigirProductor: mocks.exigirProductor,
}));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ cerrarSesion: mocks.cerrarSesion }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/modulos/usuarios/fotos-perfil", async (original) => ({
    ...await original<typeof import("@/modulos/usuarios/fotos-perfil")>(), guardarCambioFotoPerfil: mocks.guardarFoto,
}));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: {
    transaction: mocks.transaction,
    raw: { sql: () => ({ returnsRow: () => ({ build: () => ({}) }) }) },
} }));

const productor = { id: 5, usuarioId: 42, fotoPerfil: "/api/imagenes/anterior" };
const datos = { nombre: "Granja Norte", codigoPais: "+598", telefono: "99123456" };
const tx = { execute: mocks.execute, orm: { public: { Productor: mocks.productor, Usuario: mocks.usuario } } };

describe("modificarMiPerfilProductor", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.exigirProductor.mockResolvedValue({ usuarioId: 42, rol: "PRODUCTOR" });
        mocks.productor.select.mockReturnValue(mocks.productor);
        mocks.productor.where.mockReturnValue(mocks.productor);
        mocks.usuario.where.mockReturnValue(mocks.usuario);
        mocks.productor.first.mockResolvedValueOnce(productor).mockResolvedValueOnce(productor).mockResolvedValue(null);
        mocks.transaction.mockImplementation(async (guardar) => guardar(tx));
        mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    });

    it("guarda únicamente el perfil propio e invalida las vistas", async () => {
        expect(await modificarMiPerfilProductor(datos)).toMatchObject({ esValido: true, id: 5 });
        expect(mocks.productor.where).toHaveBeenCalledWith({ usuarioId: 42 });
        expect(mocks.productor.where).toHaveBeenCalledWith({ id: 5, usuarioId: 42 });
        expect(mocks.productor.update).toHaveBeenCalledExactlyOnceWith({ nombreFantasia: "Granja Norte", whatsApp: "+59899123456" });
        expect(mocks.usuario.update).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
    });

    it("ignora identificadores y campos administrativos enviados por el cliente", async () => {
        await modificarMiPerfilProductor({ ...datos, productorId: 99, usuarioId: 99, rol: "ADMINISTRADOR", passwordHash: "manipulado" });
        expect(mocks.productor.where).not.toHaveBeenCalledWith({ id: 99 });
        expect(mocks.productor.update).toHaveBeenCalledExactlyOnceWith({ nombreFantasia: datos.nombre, whatsApp: "+59899123456" });
        expect(mocks.usuario.update).not.toHaveBeenCalled();
    });

    it.each(["", "   "])("impide eliminar el WhatsApp obligatorio con %j", async (telefono) => {
        expect(await modificarMiPerfilProductor({ ...datos, telefono })).toMatchObject({ esValido: false });
        expect(mocks.productor.update).not.toHaveBeenCalled();
    });

    it.each(["99abc456", "123", "000", "---", null, 99123456])("rechaza un contacto inválido %j sin guardar", async (telefono) => {
        expect(await modificarMiPerfilProductor({ ...datos, telefono })).toMatchObject({ esValido: false });
        expect(mocks.productor.update).not.toHaveBeenCalled();
        expect(mocks.guardarFoto).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([null, [], "texto", undefined])("rechaza datos que no son un objeto: %j", async (entrada) => {
        expect(await modificarMiPerfilProductor(entrada)).toMatchObject({ esValido: false });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rechaza una foto inválida antes de abrir la transacción", async () => {
        const foto = new FormData();
        foto.set("fotoPerfil", "no es un archivo");
        expect(await modificarMiPerfilProductor(datos, foto)).toMatchObject({ esValido: false });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("no guarda si el perfil fue eliminado", async () => {
        mocks.productor.first.mockReset().mockResolvedValue(null);
        expect(await modificarMiPerfilProductor(datos)).toEqual({ esValido: false, errores: ["No se encontró tu perfil de productor."] });
        expect(mocks.productor.update).not.toHaveBeenCalled();
    });

    it("no guarda si una baja elimina el perfil antes de obtener el bloqueo", async () => {
        mocks.productor.first.mockReset().mockResolvedValueOnce({ id: 5 }).mockResolvedValueOnce(null);
        expect(await modificarMiPerfilProductor(datos)).toMatchObject({ esValido: false });
        expect(mocks.productor.update).not.toHaveBeenCalled();
        expect(mocks.guardarFoto).not.toHaveBeenCalled();
    });

    it("rechaza el nombre de otro productor", async () => {
        mocks.productor.first.mockReset().mockResolvedValueOnce(productor).mockResolvedValueOnce(productor).mockResolvedValueOnce({ id: 9 });
        expect(await modificarMiPerfilProductor(datos)).toMatchObject({ esValido: false, errores: ["Ya existe un productor con ese nombre."] });
        expect(mocks.productor.update).not.toHaveBeenCalled();
    });

    it("permite conservar el nombre del mismo productor", async () => {
        mocks.productor.first.mockReset().mockResolvedValue(productor);
        expect(await modificarMiPerfilProductor(datos)).toMatchObject({ esValido: true });
    });

    it("reutiliza las validaciones administrativas de nombre", async () => {
        expect(await modificarMiPerfilProductor({ ...datos, nombre: ".." })).toMatchObject({ esValido: false });
        expect(mocks.productor.update).not.toHaveBeenCalled();
    });

    it("ignora intentos de cambiar la contraseña desde el guardado del perfil", async () => {
        const resultado = await modificarMiPerfilProductor({ ...datos, contraseña: "nueva1234", confirmacionContraseña: "distinta", passwordHash: "manipulado" });
        expect(resultado).toMatchObject({ esValido: true });
        expect(mocks.usuario.where).not.toHaveBeenCalled();
        expect(mocks.usuario.update).not.toHaveBeenCalled();
        expect(mocks.productor.update).toHaveBeenCalledExactlyOnceWith({ nombreFantasia: datos.nombre, whatsApp: "+59899123456" });
    });

    it("reutiliza la carga de fotografía para el perfil propio", async () => {
        const foto = new FormData();
        const archivo = new File(["foto"], "perfil.png", { type: "image/png" });
        foto.set("fotoPerfil", archivo);
        mocks.guardarFoto.mockResolvedValue("/api/imagenes/nueva");
        await modificarMiPerfilProductor(datos, foto);
        expect(mocks.guardarFoto).toHaveBeenCalledWith(tx, "productores", 5, productor.fotoPerfil, expect.objectContaining({ accion: "reemplazar" }));
        expect(mocks.productor.update).toHaveBeenCalledWith(expect.objectContaining({ fotoPerfil: "/api/imagenes/nueva" }));
    });

    it("permite eliminar la fotografía", async () => {
        const foto = new FormData(); foto.set("eliminarFoto", "true");
        mocks.guardarFoto.mockResolvedValue(null);
        await modificarMiPerfilProductor(datos, foto);
        expect(mocks.productor.update).toHaveBeenCalledWith(expect.objectContaining({ fotoPerfil: null }));
    });

    it("devuelve los conflictos de persistencia sin anunciar éxito", async () => {
        mocks.transaction.mockRejectedValue({ code: "23505", constraint: "productor_nombreFantasia_key" });
        expect(await modificarMiPerfilProductor(datos)).toMatchObject({ esValido: false, errores: ["Ya existe un productor con ese nombre."] });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("propaga un fallo inesperado de persistencia", async () => {
        mocks.productor.update.mockRejectedValue(new Error("Sin conexión"));
        await expect(modificarMiPerfilProductor(datos)).rejects.toThrow("Sin conexión");
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each(["ADMINISTRADOR", "OPERADOR"])("impide guardar con el rol %s", async () => {
        mocks.exigirProductor.mockRejectedValue(new ErrorAutorizacion(403, "No autorizado"));
        await expect(modificarMiPerfilProductor(datos)).rejects.toThrow("No autorizado");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("redirige al inicio de sesión cuando no hay sesión", async () => {
        mocks.exigirProductor.mockRejectedValue(new ErrorAutorizacion(401, "Sin sesión"));
        await expect(modificarMiPerfilProductor(datos)).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.cerrarSesion).toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
});
