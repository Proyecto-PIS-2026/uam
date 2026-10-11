import { beforeEach, describe, expect, it, vi } from "vitest";

import obtenerConfiguraciones, { obtenerConfiguracion, actualizarConfiguracion,} from "./ConsultaConfiguracion";

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
        it("consulta sólo las configuraciones solicitadas", async () => {
            const configuraciones = [{nombreConfiguracion: "url_lista_inteligente", valorConfiguracion: "https://uam.com.uy/lista.pdf"}, {nombreConfiguracion: "incremento_precio", valorConfiguracion: "10"}];
            mocks.all.mockResolvedValue(configuraciones);
            const nombres = ["url_lista_inteligente", "incremento_precio"];
            const resultado = await obtenerConfiguraciones(nombres);
            expect(mocks.where).toHaveBeenCalledOnce();
            const incluir = vi.fn();
            mocks.where.mock.calls[0][0]({ nombreConfiguracion: { in: incluir } });
            expect(incluir).toHaveBeenCalledExactlyOnceWith(nombres);
            expect(mocks.select).toHaveBeenCalledExactlyOnceWith("nombreConfiguracion", "valorConfiguracion");
            expect(mocks.all).toHaveBeenCalledOnce();
            expect(resultado).toEqual(configuraciones);
        });

        it("devuelve un arreglo vacío cuando no existen configuraciones", async () => {
            mocks.all.mockResolvedValue([]);
            const resultado = await obtenerConfiguraciones(["incremento_precio"]);
            expect(resultado).toEqual([]);
            expect(mocks.all).toHaveBeenCalledOnce();
        });

        it("propaga el error cuando falla la consulta", async () => {
            mocks.all.mockRejectedValue(new Error("Error al consultar configuraciones"));
            await expect(obtenerConfiguraciones(["incremento_precio"])).rejects.toThrow("Error al consultar configuraciones");
        });

        it("no consulta la tabla si no se solicita ninguna configuración", async () => {
            expect(await obtenerConfiguraciones([])).toEqual([]);
            expect(mocks.where).not.toHaveBeenCalled();
            expect(mocks.all).not.toHaveBeenCalled();
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