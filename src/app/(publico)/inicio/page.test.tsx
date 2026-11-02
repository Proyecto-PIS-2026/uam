import type { ComponentProps } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaginaInicio, { dynamic, metadata } from "./page";
import type { ConfiguracionOrdenamiento } from "@/modulos/consulta-mercado/acciones/configuracion-ordenamiento";

type PropsInicio = ComponentProps<typeof import("@/modulos/consulta-mercado/inicio/inicio").default>;

const mocks = vi.hoisted(() => ({
    redirigirProductor: vi.fn(),
    obtenerEspecies: vi.fn(),
    obtenerUrlLista: vi.fn(),
    obtenerConfiguracion: vi.fn(),
    inicio: vi.fn<(props: PropsInicio) => null>(() => null),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    redirigirProductorAMiMercado: mocks.redirigirProductor,
}));

vi.mock("@/modulos/consulta-mercado/inicio/consultas-inicio", () => ({
    obtenerEspeciesInicio: mocks.obtenerEspecies,
    obtenerUrlListaInteligente: mocks.obtenerUrlLista,
}));

vi.mock("@/modulos/consulta-mercado/acciones/configuracion-ordenamiento", () => ({
    obtenerConfiguracionOrdenamiento: mocks.obtenerConfiguracion,
}));

vi.mock("@/modulos/consulta-mercado/inicio/inicio", () => ({
    default: mocks.inicio,
}));

const especies = [
    { nombreEspecie: "Acelga", fotoGenerica: "/acelga.webp", cantidadOperadores: 3 },
    { nombreEspecie: "Tomate", fotoGenerica: null, cantidadOperadores: 5 },
];

function configurar(cambios: Partial<ConfiguracionOrdenamiento> = {}) {
    const configuracion: ConfiguracionOrdenamiento = {
        habilitado: true,
        ordenLanding: "nombre_asc",
        ordenMercadoVirtual: "menor_precio",
        ordenMercadoProduccion: "mayor_precio",
        ...cambios,
    };
    mocks.obtenerConfiguracion.mockResolvedValue(configuracion);
}

function propsInicio(): PropsInicio {
    return mocks.inicio.mock.calls.at(-1)![0];
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.redirigirProductor.mockResolvedValue(null);
    mocks.obtenerEspecies.mockResolvedValue(especies);
    mocks.obtenerUrlLista.mockResolvedValue("https://uam.com.uy/lista.pdf");
    mocks.inicio.mockImplementation(() => null);
    configurar();
});

afterEach(cleanup);

describe("PaginaInicio", () => {
    it("configura renderizado dinámico y el título de la página", () => {
        expect(dynamic).toBe("force-dynamic");
        expect(metadata.title).toBe("Mercado de hoy | UAM");
    });

    it("entrega las especies y el enlace de la Lista Inteligente", async () => {
        render(await PaginaInicio());
        expect(propsInicio().especies).toEqual(especies);
        expect(propsInicio().urlListaInteligente).toBe("https://uam.com.uy/lista.pdf");
        expect(mocks.obtenerEspecies).toHaveBeenCalledExactlyOnceWith();
        expect(mocks.obtenerUrlLista).toHaveBeenCalledExactlyOnceWith();
    });

    it("utiliza el orden de Inicio y no los configurados para los mercados", async () => {
        configurar({
            ordenLanding: "nombre_desc",
            ordenMercadoVirtual: "menor_precio",
            ordenMercadoProduccion: "mayor_precio",
        });
        render(await PaginaInicio());
        expect(propsInicio().ordenPredeterminado).toBe("nombre_desc");
    });

    it.each(["nombre_asc", "nombre_desc", "mas_vendidas"] as const)("entrega el orden predeterminado %s", async (orden) => {
        configurar({ ordenLanding: orden });
        render(await PaginaInicio());
        expect(propsInicio().ordenPredeterminado).toBe(orden);
    });

    it.each([true, false])("entrega el estado del switch %s", async (habilitado) => {
        configurar({ habilitado });
        render(await PaginaInicio());
        expect(propsInicio().ordenamientoHabilitado).toBe(habilitado);
    });

    it("conserva el orden predeterminado cuando el switch está apagado", async () => {
        configurar({ habilitado: false, ordenLanding: "nombre_desc" });
        render(await PaginaInicio());
        expect(propsInicio()).toMatchObject({
            ordenamientoHabilitado: false,
            ordenPredeterminado: "nombre_desc",
        });
    });

    it("permite una lista vacía de especies", async () => {
        mocks.obtenerEspecies.mockResolvedValue([]);
        render(await PaginaInicio());
        expect(propsInicio().especies).toEqual([]);
    });

    it("permite que la Lista Inteligente no esté configurada", async () => {
        mocks.obtenerUrlLista.mockResolvedValue(null);
        render(await PaginaInicio());
        expect(propsInicio().urlListaInteligente).toBeNull();
    });

    it("incluye el estado y el orden en la key del componente", async () => {
        configurar({ habilitado: false, ordenLanding: "nombre_desc" });
        const resultado = await PaginaInicio();
        expect(resultado.key).toBe("false-nombre_desc");
    });

    it("comprueba la redirección antes de consultar datos", async () => {
        mocks.obtenerEspecies.mockImplementation(async () => {
            expect(mocks.redirigirProductor).toHaveBeenCalledOnce();
            return especies;
        });
        await PaginaInicio();
        expect(mocks.obtenerEspecies).toHaveBeenCalledOnce();
    });

    it("no consulta datos cuando el control de acceso redirige", async () => {
        const error = new Error("NEXT_REDIRECT");
        mocks.redirigirProductor.mockRejectedValue(error);
        await expect(PaginaInicio()).rejects.toBe(error);
        expect(mocks.obtenerEspecies).not.toHaveBeenCalled();
        expect(mocks.obtenerUrlLista).not.toHaveBeenCalled();
        expect(mocks.obtenerConfiguracion).not.toHaveBeenCalled();
    });

    it("espera la comprobación de acceso antes de iniciar las consultas", async () => {
        let finalizar!: () => void;
        mocks.redirigirProductor.mockImplementation(() => new Promise<void>((resolve) => { finalizar = resolve; }));
        const pendiente = PaginaInicio();
        expect(mocks.obtenerEspecies).not.toHaveBeenCalled();
        expect(mocks.obtenerUrlLista).not.toHaveBeenCalled();
        expect(mocks.obtenerConfiguracion).not.toHaveBeenCalled();
        finalizar();
        await pendiente;
        expect(mocks.obtenerEspecies).toHaveBeenCalledOnce();
        expect(mocks.obtenerUrlLista).toHaveBeenCalledOnce();
        expect(mocks.obtenerConfiguracion).toHaveBeenCalledOnce();
    });

    it("propaga los errores de consulta de especies", async () => {
        const error = new Error("Error de especies");
        mocks.obtenerEspecies.mockRejectedValue(error);
        await expect(PaginaInicio()).rejects.toBe(error);
    });

    it("propaga los errores de consulta de la Lista Inteligente", async () => {
        const error = new Error("Error de Lista Inteligente");
        mocks.obtenerUrlLista.mockRejectedValue(error);
        await expect(PaginaInicio()).rejects.toBe(error);
    });

    it("propaga los errores de consulta de configuración", async () => {
        const error = new Error("Error de configuración");
        mocks.obtenerConfiguracion.mockRejectedValue(error);
        await expect(PaginaInicio()).rejects.toBe(error);
    });
});