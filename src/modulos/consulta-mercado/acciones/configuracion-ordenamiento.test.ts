import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerConfiguracionOrdenamiento } from "./configuracion-ordenamiento";

const mocks = vi.hoisted(() => ({
    obtenerConfiguraciones: vi.fn(),
}));

vi.mock("@/modulos/administracion/acciones/consultas-configuracion", () => ({
    default: mocks.obtenerConfiguraciones,
}));

function crearFilas(cambios: Record<string, string | null> = {}) {
    const valores = {
        ordenamiento_habilitado: "true",
        orden_landing_page_default: "nombre_asc",
        orden_mercado_virtual_default: "menor_precio",
        orden_mercado_produccion_default: "mayor_precio",
        ...cambios,
    };

    return Object.entries(valores).map(([nombreConfiguracion, valorConfiguracion]) => ({ nombreConfiguracion, valorConfiguracion }));
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.obtenerConfiguraciones.mockResolvedValue(crearFilas());
});

describe("obtenerConfiguracionOrdenamiento", () => {
    it("consulta las cuatro claves de ordenamiento", async () => {
        await obtenerConfiguracionOrdenamiento();
        expect(mocks.obtenerConfiguraciones).toHaveBeenCalledExactlyOnceWith([
            "ordenamiento_habilitado",
            "orden_landing_page_default",
            "orden_mercado_virtual_default",
            "orden_mercado_produccion_default",
        ]);
    });

    it("devuelve el estado y los tres órdenes por separado", async () => {
        await expect(obtenerConfiguracionOrdenamiento()).resolves.toEqual({
            habilitado: true,
            ordenLanding: "nombre_asc",
            ordenMercadoVirtual: "menor_precio",
            ordenMercadoProduccion: "mayor_precio",
        });
    });

    it.each([{ valor: "true", esperado: true }, { valor: "false", esperado: false }, { valor: "", esperado: false }, { valor: "TRUE", esperado: false }, { valor: null, esperado: false }])("interpreta el estado $valor como $esperado", async ({ valor, esperado }) => {
        mocks.obtenerConfiguraciones.mockResolvedValue(crearFilas({ ordenamiento_habilitado: valor }));
        const resultado = await obtenerConfiguracionOrdenamiento();
        expect(resultado.habilitado).toBe(esperado);
    });

    it.each(["nombre_asc", "nombre_desc", "mas_vendidas"])("conserva el orden válido de Inicio %s", async (orden) => {
        mocks.obtenerConfiguraciones.mockResolvedValue(crearFilas({ orden_landing_page_default: orden }));
        const resultado = await obtenerConfiguracionOrdenamiento();
        expect(resultado.ordenLanding).toBe(orden);
        expect(resultado.ordenMercadoVirtual).toBe("menor_precio");
        expect(resultado.ordenMercadoProduccion).toBe("mayor_precio");
    });

    it.each(["menor_precio", "mayor_precio", "desconocido", "", null])("usa Más vendidas si el orden de Inicio es inválido: %j", async (orden) => {
        mocks.obtenerConfiguraciones.mockResolvedValue(crearFilas({ orden_landing_page_default: orden }));
        const resultado = await obtenerConfiguracionOrdenamiento();
        expect(resultado.ordenLanding).toBe("mas_vendidas");
    });

    describe.each([{ nombre: "Mercado Virtual", clave: "orden_mercado_virtual_default", campo: "ordenMercadoVirtual" }, { nombre: "Mercado Producción", clave: "orden_mercado_produccion_default", campo: "ordenMercadoProduccion" }] as const)("$nombre", ({ clave, campo }) => {
        it.each(["nombre_asc", "nombre_desc", "mas_vendidas", "menor_precio", "mayor_precio"])("conserva el orden válido %s sin modificar las otras secciones", async (orden) => {
            mocks.obtenerConfiguraciones.mockResolvedValue(crearFilas({ [clave]: orden }));
            const resultado = await obtenerConfiguracionOrdenamiento();
            expect(resultado[campo]).toBe(orden);
            expect(resultado.ordenLanding).toBe("nombre_asc");
            const otroCampo = campo === "ordenMercadoVirtual" ? "ordenMercadoProduccion" : "ordenMercadoVirtual";
            const otroOrden = campo === "ordenMercadoVirtual" ? "mayor_precio" : "menor_precio";
            expect(resultado[otroCampo]).toBe(otroOrden);
        });
        it.each(["desconocido", "", null])("usa Más vendidas si el orden es inválido: %j", async (orden) => {
            mocks.obtenerConfiguraciones.mockResolvedValue(crearFilas({ [clave]: orden }));
            const resultado = await obtenerConfiguracionOrdenamiento();
            expect(resultado[campo]).toBe("mas_vendidas");
        });
    });

    it("mantiene los tres órdenes configurados aunque el switch esté apagado", async () => {
        mocks.obtenerConfiguraciones.mockResolvedValue(crearFilas({
            ordenamiento_habilitado: "false",
            orden_landing_page_default: "nombre_desc",
            orden_mercado_virtual_default: "mayor_precio",
            orden_mercado_produccion_default: "menor_precio",
        }));
        await expect(obtenerConfiguracionOrdenamiento()).resolves.toEqual({
            habilitado: false,
            ordenLanding: "nombre_desc",
            ordenMercadoVirtual: "mayor_precio",
            ordenMercadoProduccion: "menor_precio",
        });
    });

    it("usa valores predeterminados si no existen configuraciones", async () => {
        mocks.obtenerConfiguraciones.mockResolvedValue([]);
        await expect(obtenerConfiguracionOrdenamiento()).resolves.toEqual({
            habilitado: false,
            ordenLanding: "mas_vendidas",
            ordenMercadoVirtual: "mas_vendidas",
            ordenMercadoProduccion: "mas_vendidas",
        });
    });

    it.each([{ clave: "orden_landing_page_default", campo: "ordenLanding", valor: "nombre_desc" }, { clave: "orden_mercado_virtual_default", campo: "ordenMercadoVirtual", valor: "menor_precio" }, { clave: "orden_mercado_produccion_default", campo: "ordenMercadoProduccion", valor: "mayor_precio" }] as const)("conserva $clave cuando faltan las otras configuraciones", async ({ clave, campo, valor }) => {
        mocks.obtenerConfiguraciones.mockResolvedValue([{ nombreConfiguracion: clave, valorConfiguracion: valor }]);
        await expect(obtenerConfiguracionOrdenamiento()).resolves.toEqual({
            habilitado: false,
            ordenLanding: "mas_vendidas",
            ordenMercadoVirtual: "mas_vendidas",
            ordenMercadoProduccion: "mas_vendidas",
            [campo]: valor,
        });
    });

    it("propaga los errores de consulta", async () => {
        const error = new Error("No se pudieron consultar las configuraciones");
        mocks.obtenerConfiguraciones.mockRejectedValue(error);
        await expect(obtenerConfiguracionOrdenamiento()).rejects.toBe(error);
    });
});