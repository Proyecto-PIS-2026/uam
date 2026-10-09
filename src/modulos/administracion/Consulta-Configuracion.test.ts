import { beforeEach, describe, expect, it, vi } from "vitest";

import obtenerConfiguraciones, { obtenerConfiguracion, actualizarConfiguracion,} from "./Consulta-Configuracion";

const mocks = vi.hoisted(() => ({
    select: vi.fn(),
    where: vi.fn(),
    all: vi.fn(),
    first: vi.fn(),
    update: vi.fn(),
}));

vi.mock("../../infraestructura/persistencia/prisma/db", () => {
    const consulta = {
        select: mocks.select,
        where: mocks.where,
        all: mocks.all,
        first: mocks.first,
        update: mocks.update,
    };
    return {
        db: {
            orm: {
                public: {
                    Configuracion: consulta,
                },
            },
        },
    };
});

describe("consulta-configuracion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const consulta = {
            select: mocks.select,
            where: mocks.where,
            all: mocks.all,
            first: mocks.first,
            update: mocks.update,
        };
        mocks.select.mockReturnValue(consulta);
        mocks.where.mockReturnValue(consulta);
    });

    describe("obtenerConfiguraciones", () => {
        it("obtiene todas las configuraciones", async () => {
            const configuraciones = [{nombreConfiguracion: "url_lista_inteligente", valorConfiguracion: "https://uam.com.uy/lista.pdf"}, {nombreConfiguracion: "incremento_precio", valorConfiguracion: "10"}];
            mocks.all.mockResolvedValue(configuraciones);
            const resultado = await obtenerConfiguraciones();
            expect(mocks.select).toHaveBeenCalledExactlyOnceWith("nombreConfiguracion", "valorConfiguracion");
            expect(mocks.all).toHaveBeenCalledOnce();
            expect(resultado).toEqual(configuraciones);
        });

        it("devuelve un arreglo vacío cuando no existen configuraciones", async () => {
            mocks.all.mockResolvedValue([]);
            const resultado = await obtenerConfiguraciones();
            expect(resultado).toEqual([]);
            expect(mocks.all).toHaveBeenCalledOnce();
        });

        it("propaga el error cuando falla la consulta", async () => {
            mocks.all.mockRejectedValue(new Error("Error al consultar configuraciones"));
            await expect(obtenerConfiguraciones()).rejects.toThrow("Error al consultar configuraciones");
        });
    });

    describe("obtenerConfiguracion", () => {
        it("obtiene el valor de una configuración existente", async () => {
            mocks.first.mockResolvedValue({valorConfiguracion: "25"});
            const resultado = await obtenerConfiguracion("incremento_precio");
            expect(mocks.where).toHaveBeenCalledExactlyOnceWith({nombreConfiguracion: "incremento_precio"});
            expect(mocks.select).toHaveBeenCalledExactlyOnceWith("valorConfiguracion");
            expect(mocks.first).toHaveBeenCalledOnce();
            expect(resultado).toBe("25");
        });

        it("devuelve null cuando la configuración no existe", async () => {
            mocks.first.mockResolvedValue(null);
            const resultado = await obtenerConfiguracion("configuracion_inexistente");
            expect(mocks.where).toHaveBeenCalledExactlyOnceWith({nombreConfiguracion: "configuracion_inexistente"});
            expect(resultado).toBeNull();
        });

        it("devuelve null cuando el resultado es undefined", async () => {
            mocks.first.mockResolvedValue(undefined);
            const resultado = await obtenerConfiguracion("incremento_precio");
            expect(resultado).toBeNull();
        });

        it("propaga el error cuando falla la consulta", async () => {
            mocks.first.mockRejectedValue(new Error("Error al obtener configuración"));
            await expect(obtenerConfiguracion("incremento_precio")).rejects.toThrow("Error al obtener configuración");
        });
    });

    describe("actualizarConfiguracion", () => {
        it("actualiza correctamente una configuración existente", async () => {
            mocks.update.mockResolvedValue({valorConfiguracion: "25"});
            const resultado = await actualizarConfiguracion("incremento_precio", "25");
            expect(mocks.where).toHaveBeenCalledExactlyOnceWith({nombreConfiguracion: "incremento_precio"});
            expect(mocks.select).toHaveBeenCalledExactlyOnceWith("valorConfiguracion");
            expect(mocks.update).toHaveBeenCalledExactlyOnceWith({valorConfiguracion: "25"});
            expect(resultado).toBe("25");
        });

        it("permite actualizar la URL de la Lista Inteligente", async () => {
            const nuevaUrl = "https://uam.com.uy/nueva-lista.pdf";
            mocks.update.mockResolvedValue({valorConfiguracion: nuevaUrl});
            const resultado = await actualizarConfiguracion("url_lista_inteligente", nuevaUrl);
            expect(mocks.where).toHaveBeenCalledExactlyOnceWith({nombreConfiguracion: "url_lista_inteligente",});
            expect(mocks.update).toHaveBeenCalledExactlyOnceWith({valorConfiguracion: nuevaUrl});
            expect(resultado).toBe(nuevaUrl);
        });

        it("permite restablecer una configuración a su valor por defecto", async () => {
            mocks.update.mockResolvedValue({valorConfiguracion: "10"});
            const resultado = await actualizarConfiguracion("incremento_precio", "10");
            expect(mocks.update).toHaveBeenCalledExactlyOnceWith({valorConfiguracion: "10"});
            expect(resultado).toBe("10");
        });

        it("lanza un error cuando la configuración no existe", async () => {
            mocks.update.mockResolvedValue(null);
            await expect(actualizarConfiguracion("configuracion_inexistente", "25")).rejects.toThrow("No existe la configuración configuracion_inexistente.");
        });

        it("propaga el error cuando falla la actualización", async () => {
            mocks.update.mockRejectedValue(new Error("Error de base de datos"));
            await expect(actualizarConfiguracion("incremento_precio", "25")).rejects.toThrow("Error de base de datos");
        });
    });
});
