import { beforeEach, describe, expect, it, vi } from "vitest";
import obtenerConfiguraciones, { actualizarConfiguracion, obtenerConfiguracion } from "./consultas-configuracion";

const mocks = vi.hoisted(() => ({
    where: vi.fn(),
    select: vi.fn(),
    all: vi.fn(),
    first: vi.fn(),
    update: vi.fn(),
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Configuracion: {
                    where: mocks.where,
                },
            },
        },
    },
}));

beforeEach(() => {
    vi.resetAllMocks();

    const consulta = {
        where: mocks.where,
        select: mocks.select,
        all: mocks.all,
        first: mocks.first,
        update: mocks.update,
    };

    mocks.where.mockReturnValue(consulta);
    mocks.select.mockReturnValue(consulta);
});

describe("obtenerConfiguraciones", () => {
    it("consulta únicamente los nombres solicitados", async () => {
        const nombres = ["url_lista_inteligente", "incremento_precio"];
        const filas = [
            { nombreConfiguracion: "url_lista_inteligente", valorConfiguracion: "https://uam.com.uy/lista.pdf" },
            { nombreConfiguracion: "incremento_precio", valorConfiguracion: "25" },
        ];
        mocks.all.mockResolvedValue(filas);

        const resultado = await obtenerConfiguraciones(nombres);

        expect(mocks.where).toHaveBeenCalledOnce();

        const incluir = vi.fn();
        const filtrar = mocks.where.mock.calls[0][0];
        filtrar({ nombreConfiguracion: { in: incluir } });

        expect(incluir).toHaveBeenCalledExactlyOnceWith(nombres);
        expect(mocks.select).toHaveBeenCalledExactlyOnceWith("nombreConfiguracion", "valorConfiguracion");
        expect(mocks.all).toHaveBeenCalledOnce();
        expect(resultado).toEqual(filas);
    });

    it("no consulta la base cuando la lista de nombres está vacía", async () => {
        await expect(obtenerConfiguraciones([])).resolves.toEqual([]);

        expect(mocks.where).not.toHaveBeenCalled();
        expect(mocks.all).not.toHaveBeenCalled();
    });

    it("devuelve un arreglo vacío si no encuentra configuraciones", async () => {
        mocks.all.mockResolvedValue([]);

        await expect(obtenerConfiguraciones(["inexistente"])).resolves.toEqual([]);
    });

    it("conserva los valores vacíos y booleanos almacenados como texto", async () => {
        const filas = [
            { nombreConfiguracion: "vigencia_fotos", valorConfiguracion: "" },
            { nombreConfiguracion: "aging_fotos_habilitado", valorConfiguracion: "false" },
        ];
        mocks.all.mockResolvedValue(filas);

        await expect(obtenerConfiguraciones(["vigencia_fotos", "aging_fotos_habilitado"])).resolves.toEqual(filas);
    });

    it("propaga los errores de consulta", async () => {
        const error = new Error("Error al consultar configuraciones");
        mocks.all.mockRejectedValue(error);

        await expect(obtenerConfiguraciones(["incremento_precio"])).rejects.toBe(error);
    });
});

describe("obtenerConfiguracion", () => {
    it("devuelve el valor de la configuración solicitada", async () => {
        mocks.first.mockResolvedValue({ valorConfiguracion: "25" });

        const resultado = await obtenerConfiguracion("incremento_precio");

        expect(mocks.where).toHaveBeenCalledExactlyOnceWith({ nombreConfiguracion: "incremento_precio" });
        expect(mocks.select).toHaveBeenCalledExactlyOnceWith("valorConfiguracion");
        expect(mocks.first).toHaveBeenCalledOnce();
        expect(resultado).toBe("25");
    });

    it("devuelve null si la configuración no existe", async () => {
        mocks.first.mockResolvedValue(null);

        await expect(obtenerConfiguracion("inexistente")).resolves.toBeNull();
    });

    it("conserva una cadena vacía como valor válido", async () => {
        mocks.first.mockResolvedValue({ valorConfiguracion: "" });

        await expect(obtenerConfiguracion("url_lista_inteligente")).resolves.toBe("");
    });

    it("conserva el booleano falso almacenado como texto", async () => {
        mocks.first.mockResolvedValue({ valorConfiguracion: "false" });

        await expect(obtenerConfiguracion("restablecimiento_contrasena_habilitado")).resolves.toBe("false");
    });

    it("propaga los errores de consulta", async () => {
        const error = new Error("Error de conexión");
        mocks.first.mockRejectedValue(error);

        await expect(obtenerConfiguracion("incremento_precio")).rejects.toBe(error);
    });
});

describe("actualizarConfiguracion", () => {
    it("actualiza la configuración indicada y devuelve el valor guardado", async () => {
        mocks.update.mockResolvedValue({ valorConfiguracion: "50" });

        const resultado = await actualizarConfiguracion("incremento_precio", "50");

        expect(mocks.where).toHaveBeenCalledExactlyOnceWith({ nombreConfiguracion: "incremento_precio" });
        expect(mocks.select).toHaveBeenCalledExactlyOnceWith("valorConfiguracion");
        expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ valorConfiguracion: "50" });
        expect(resultado).toBe("50");
    });

    it("permite guardar una cadena vacía", async () => {
        mocks.update.mockResolvedValue({ valorConfiguracion: "" });

        await expect(actualizarConfiguracion("url_lista_inteligente", "")).resolves.toBe("");
        expect(mocks.update).toHaveBeenCalledWith({ valorConfiguracion: "" });
    });

    it("informa cuando la configuración no existe", async () => {
        mocks.update.mockResolvedValue(null);

        await expect(actualizarConfiguracion("inexistente", "10")).rejects.toThrow("No existe la configuración inexistente.");
    });

    it("propaga los errores de actualización", async () => {
        const error = new Error("No se pudo actualizar");
        mocks.update.mockRejectedValue(error);

        await expect(actualizarConfiguracion("incremento_precio", "50")).rejects.toBe(error);
    });
});