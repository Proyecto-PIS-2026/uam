import { beforeEach, describe, expect, it, vi } from "vitest";
import { modificarPerfilPropio } from "./modificarPerfilPropio";

const mocks = vi.hoisted(() => ({
    exigirOperador: vi.fn(),
    guardarOperadorAtomico: vi.fn(),
    validarCambioFotoPerfil: vi.fn(),
    guardarCambioFotoPerfil: vi.fn(),
    controlarErrorFotoPerfil: vi.fn(),
    revalidatePath: vi.fn(),
    operador: {
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        first: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirOperador: mocks.exigirOperador }));
vi.mock("@/modulos/identidad-acceso/autorizacion/control-acciones", () => ({
    controlarSesionEnAccion: (exigir: () => Promise<unknown>) => exigir(),
}));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { orm: { public: { Operador: mocks.operador } } } }));
vi.mock("../guardar-operador-atomico", () => ({ guardarOperadorAtomico: mocks.guardarOperadorAtomico }));
vi.mock("../../fotos-perfil", () => ({
    validarCambioFotoPerfil: mocks.validarCambioFotoPerfil,
    guardarCambioFotoPerfil: mocks.guardarCambioFotoPerfil,
    controlarErrorFotoPerfil: mocks.controlarErrorFotoPerfil,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const datos = {
    nombre: "Frutas del Norte",
    codigoPais: "+598",
    telefono: "099 123-456",
    enLicencia: false,
};

describe("modificarPerfilPropio", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.exigirOperador.mockResolvedValue({ usuarioId: 10 });
        mocks.validarCambioFotoPerfil.mockReturnValue({ esValido: true, cambio: { accion: "conservar" } });
        mocks.controlarErrorFotoPerfil.mockImplementation((operacion: () => unknown) => operacion());
        mocks.guardarCambioFotoPerfil.mockResolvedValue(undefined);
        mocks.operador.first
            .mockResolvedValueOnce({ id: 7, fotoPerfil: "/anterior.webp" })
            .mockResolvedValueOnce(null);
        mocks.guardarOperadorAtomico.mockImplementation((operacion: (tx: unknown) => unknown) => operacion({
            orm: { public: { Operador: mocks.operador } },
        }));
    });

    it("devuelve errores de entrada antes de tocar la persistencia", async () => {
        await expect(modificarPerfilPropio({ ...datos, nombre: "" })).resolves.toEqual({
            esValido: false,
            errores: ["El nombre es obligatorio."],
        });
        expect(mocks.guardarOperadorAtomico).not.toHaveBeenCalled();
    });

    it.each(["", "   ", "---", null, undefined])("rechaza WhatsApp vacío o inválido: %j", async (telefono) => {
        await expect(modificarPerfilPropio({ ...datos, telefono })).resolves.toEqual({
            esValido: false, errores: ["El número de contacto no es válido."],
        });
        expect(mocks.guardarOperadorAtomico).not.toHaveBeenCalled();
    });

    it.each([".", ".."])("rechaza el nombre %s que cambiaría el destino del enlace", async (nombre) => {
        await expect(modificarPerfilPropio({ ...datos, nombre })).resolves.toEqual({
            esValido: false, errores: ['El nombre no puede ser "." ni "..".'],
        });
        expect(mocks.guardarOperadorAtomico).not.toHaveBeenCalled();
    });

    it("devuelve errores de foto antes de abrir la transacción", async () => {
        mocks.validarCambioFotoPerfil.mockReturnValue({ esValido: false, errores: ["La imagen no es válida."] });

        await expect(modificarPerfilPropio(datos, new FormData())).resolves.toEqual({
            esValido: false,
            errores: ["La imagen no es válida."],
        });
        expect(mocks.guardarOperadorAtomico).not.toHaveBeenCalled();
    });

    it("actualiza el perfil, normaliza el teléfono y revalida las rutas", async () => {
        await expect(modificarPerfilPropio(datos)).resolves.toEqual({
            esValido: true,
            mensaje: "Perfil actualizado correctamente.",
        });
        expect(mocks.operador.update).toHaveBeenCalledWith({
            nombreFantasia: "Frutas del Norte",
            whatsApp: "+59899123456",
            enLicencia: false,
            comentario: null,
        });
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/mi-perfil");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/operadores");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/inicio");
    });

    it.each(["2000-11-02", "2000-11-12", "2999-11-12"])("guarda el perfil con inicio de licencia pasado y fin %s", async (finLicencia) => {
        await expect(modificarPerfilPropio({
            ...datos, enLicencia: true, inicioLicencia: "2000-11-02", finLicencia,
            comentario: "Consultar disponibilidad.",
        })).resolves.toMatchObject({ esValido: true });

        expect(mocks.operador.update).toHaveBeenCalledWith(expect.objectContaining({
            enLicencia: true,
            comentario: `Licencia: 2000-11-02 - ${finLicencia}\n\nConsultar disponibilidad.`,
        }));
    });

    it.each([
        { inicioLicencia: "2000-11-12", finLicencia: "2000-11-05", error: "La fecha de inicio no puede ser posterior a la fecha de fin." },
        { inicioLicencia: "2000-02-30", finLicencia: "2000-03-12", error: "Las fechas de licencia no son válidas." },
        { inicioLicencia: "2000-11-02", finLicencia: "", error: "Ingresá las fechas de inicio y fin de la licencia." },
    ])("rechaza una licencia inválida: $error", async ({ inicioLicencia, finLicencia, error }) => {
        await expect(modificarPerfilPropio({ ...datos, enLicencia: true, inicioLicencia, finLicencia }))
            .resolves.toEqual({ esValido: false, errores: [error] });
        expect(mocks.guardarOperadorAtomico).not.toHaveBeenCalled();
    });

    it("devuelve el conflicto de nombre sin actualizar", async () => {
        mocks.operador.first
            .mockReset()
            .mockResolvedValueOnce({ id: 7, fotoPerfil: null })
            .mockResolvedValueOnce({ id: 8 });

        await expect(modificarPerfilPropio(datos)).resolves.toEqual({
            esValido: false,
            errores: ["Ya existe un operador con ese nombre."],
        });
        expect(mocks.operador.update).not.toHaveBeenCalled();
    });

    it("informa cuando el operador autenticado ya no existe", async () => {
        mocks.operador.first.mockReset().mockResolvedValue(null);

        await expect(modificarPerfilPropio(datos)).resolves.toEqual({
            esValido: false,
            errores: ["No se encontró el operador autenticado."],
        });
    });
});
