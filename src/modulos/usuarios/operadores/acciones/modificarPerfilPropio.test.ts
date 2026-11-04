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
        await expect(modificarPerfilPropio({ nombre: "" })).resolves.toEqual({
            esValido: false,
            errores: ["El nombre es obligatorio."],
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
