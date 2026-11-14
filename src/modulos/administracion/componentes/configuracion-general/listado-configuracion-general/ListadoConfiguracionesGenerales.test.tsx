import type { ComponentProps } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ListadoConfiguracionesGenerales from "./ListadoConfiguracionesGenerales";

type PropsInput = ComponentProps<typeof import("../tarjetas-configuracion/input/TarjetaInput").default>;
type PropsOrdenamiento = ComponentProps<typeof import("../tarjetas-configuracion/ordenamiento-predeterminado/TarjetaOrdenamientoPredeterminado").default>;
type PropsVigencia = ComponentProps<typeof import("../tarjetas-configuracion/vigencia/TarjetaVigencia").default>;
type PropsRestablecimiento = ComponentProps<typeof import("../tarjetas-configuracion/restablecimiento-contraseña/TarjetaRestablecimientoContraseña").default>;
type PropsFotos = ComponentProps<typeof import("../tarjetas-configuracion/fotos-especies/TarjetaUploadFotoEspecie").default>;

const mocks = vi.hoisted(() => ({
    refresh: vi.fn(),
    guardarConfiguraciones: vi.fn(),
    guardarFoto: vi.fn(),
    eliminarFoto: vi.fn(),
    input: vi.fn<(props: PropsInput) => null>(() => null),
    ordenamiento: vi.fn<(props: PropsOrdenamiento) => null>(() => null),
    vigencia: vi.fn<(props: PropsVigencia) => null>(() => null),
    restablecimiento: vi.fn<(props: PropsRestablecimiento) => null>(() => null),
    fotos: vi.fn<(props: PropsFotos) => null>(() => null),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/modulos/administracion/acciones/guardar-configuracion", () => ({
    guardarConfiguraciones: mocks.guardarConfiguraciones,
}));

vi.mock("@/modulos/administracion/acciones/foto-especie", () => ({
    guardarFotoEspecie: mocks.guardarFoto,
    eliminarFotoEspecie: mocks.eliminarFoto,
}));

vi.mock("../tarjetas-configuracion/input/TarjetaInput", () => ({ default: mocks.input }));
vi.mock("../tarjetas-configuracion/ordenamiento-predeterminado/TarjetaOrdenamientoPredeterminado", () => ({ default: mocks.ordenamiento }));
vi.mock("../tarjetas-configuracion/vigencia/TarjetaVigencia", () => ({ default: mocks.vigencia }));
vi.mock("../tarjetas-configuracion/restablecimiento-contraseña/TarjetaRestablecimientoContraseña", () => ({ default: mocks.restablecimiento }));
vi.mock("../tarjetas-configuracion/fotos-especies/TarjetaUploadFotoEspecie", () => ({ default: mocks.fotos }));

const especies = [
    { id: 1, nombreEspecie: "Acelga", fotoEspecie: "/acelga.webp" },
    { id: 2, nombreEspecie: "Ají", fotoEspecie: null },
];

function crearConfiguracion(cambios: Record<string, string | null> = {}): Record<string, string | null> {
    return {
        url_lista_inteligente: "https://uam.com.uy/lista.pdf",
        incremento_precio: "25",
        ordenamiento_habilitado: "true",
        orden_landing_page_default: "nombre_desc",
        orden_mercado_virtual_default: "menor_precio",
        orden_mercado_produccion_default: "mayor_precio",
        aging_fotos_habilitado: "true",
        vigencia_fotos: "30",
        aviso_vencimiento_fotos_habilitado: "true",
        anticipacion_aviso_fotos: "7",
        aging_fotos_productor_habilitado: "true",
        vigencia_fotos_productor: "10",
        aviso_vencimiento_fotos_productor_habilitado: "false",
        anticipacion_aviso_fotos_productor: "2",
        vigencia_publicaciones_operador_habilitada: "true",
        vigencia_publicaciones_operador: "20",
        aviso_vencimiento_publicaciones_operador_habilitado: "true",
        anticipacion_aviso_publicaciones_operador: "3",
        vigencia_publicaciones_productor_habilitada: "true",
        vigencia_publicaciones_productor: "15",
        aviso_vencimiento_publicaciones_productor_habilitado: "false",
        anticipacion_aviso_publicaciones_productor: "",
        restablecimiento_contrasena_habilitado: "true",
        ...cambios,
    };
}

function preparar(configuracion = crearConfiguracion()) {
    return render(<ListadoConfiguracionesGenerales configuracion={configuracion} especies={especies} />);
}

function propsInput(titulo: string): PropsInput {
    const ultima = mocks.input.mock.calls.filter(([props]) => props.titulo === titulo).at(-1);
    if (!ultima) throw new Error(`No se encontró la tarjeta ${titulo}`);
    return ultima[0];
}

function propsVigencia(titulo: string): PropsVigencia {
    const ultima = mocks.vigencia.mock.calls.filter(([props]) => props.titulo === titulo).at(-1);
    if (!ultima) throw new Error(`No se encontró la tarjeta ${titulo}`);
    return ultima[0];
}

function propsOrdenamiento(): PropsOrdenamiento {
    return mocks.ordenamiento.mock.calls.at(-1)![0];
}

function propsRestablecimiento(): PropsRestablecimiento {
    return mocks.restablecimiento.mock.calls.at(-1)![0];
}

function propsFotos(): PropsFotos {
    return mocks.fotos.mock.calls.at(-1)![0];
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardarConfiguraciones.mockReset().mockResolvedValue(undefined);
    mocks.guardarFoto.mockReset().mockResolvedValue(undefined);
    mocks.eliminarFoto.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("ListadoConfiguracionesGenerales", () => {
    it("entrega los valores iniciales a las tarjetas de entrada", () => {
        preparar();
        expect(propsInput("Lista Inteligente")).toMatchObject({ tipo: "url", valor: "https://uam.com.uy/lista.pdf" });
        expect(propsInput("Importe de ajuste rápido de precios")).toMatchObject({ tipo: "numero", valor: "25" });
    });

    it("entrega mensajes de éxito específicos para URL e importe", () => {
        preparar();
        expect(propsInput("Lista Inteligente").mensajeExito).toBe("La URL de la Lista Inteligente se guardó correctamente.");
        expect(propsInput("Importe de ajuste rápido de precios").mensajeExito).toBe("El importe de ajuste rápido de precios se guardó correctamente.");
    });

    it("entrega los tres órdenes por separado", () => {
        preparar();
        expect(propsOrdenamiento().configuracion).toEqual({ habilitado: true, ordenLanding: "nombre_desc", ordenMercadoVirtual: "menor_precio", ordenMercadoProduccion: "mayor_precio" });
    });

    it("entrega las configuraciones de vigencia por separado", () => {
        preparar();
        expect(propsVigencia("Vigencia de fotos de operadores").configuracion).toEqual({ habilitado: true, diasVigencia: "30", avisosHabilitados: true, diasAnticipacion: "7" });
        expect(propsVigencia("Vigencia de fotos de productores").configuracion).toEqual({ habilitado: true, diasVigencia: "10", avisosHabilitados: false, diasAnticipacion: "2" });
        expect(propsVigencia("Vigencia de publicaciones de operadores").configuracion).toEqual({ habilitado: true, diasVigencia: "20", avisosHabilitados: true, diasAnticipacion: "3" });
        expect(propsVigencia("Vigencia de publicaciones de productores").configuracion).toEqual({ habilitado: true, diasVigencia: "15", avisosHabilitados: false, diasAnticipacion: "" });
    });

    it("entrega el estado de restablecimiento y las especies disponibles", () => {
        preparar();
        expect(propsRestablecimiento().habilitado).toBe(true);
        expect(propsFotos().especies).toEqual(especies);
        expect(propsFotos().especieSeleccionada).toBe("");
    });

    it("usa valores vacíos y estados apagados cuando faltan configuraciones", () => {
        preparar({});
        expect(propsInput("Lista Inteligente").valor).toBe("");
        expect(propsInput("Importe de ajuste rápido de precios").valor).toBe("");
        expect(propsOrdenamiento().configuracion).toEqual({ habilitado: false, ordenLanding: "mas_vendidas", ordenMercadoVirtual: "mas_vendidas", ordenMercadoProduccion: "mas_vendidas" });
        expect(propsVigencia("Vigencia de fotos de operadores").configuracion).toEqual({ habilitado: false, diasVigencia: "", avisosHabilitados: false, diasAnticipacion: "" });
        expect(propsVigencia("Vigencia de fotos de productores").configuracion).toEqual({ habilitado: false, diasVigencia: "", avisosHabilitados: false, diasAnticipacion: "" });
        expect(propsVigencia("Vigencia de publicaciones de operadores").configuracion).toEqual({ habilitado: false, diasVigencia: "", avisosHabilitados: false, diasAnticipacion: "" });
        expect(propsVigencia("Vigencia de publicaciones de productores").configuracion).toEqual({ habilitado: false, diasVigencia: "", avisosHabilitados: false, diasAnticipacion: "" });
        expect(propsRestablecimiento().habilitado).toBe(false);
    });

    it.each(["nombre_asc", "nombre_desc", "mas_vendidas"])("interpreta el orden de Inicio %s", (orden) => {
        preparar(crearConfiguracion({ orden_landing_page_default: orden }));
        expect(propsOrdenamiento().configuracion.ordenLanding).toBe(orden);
        expect(propsOrdenamiento().configuracion.ordenMercadoVirtual).toBe("menor_precio");
        expect(propsOrdenamiento().configuracion.ordenMercadoProduccion).toBe("mayor_precio");
    });

    describe.each([
        { nombre: "Mercado Virtual", clave: "orden_mercado_virtual_default", campo: "ordenMercadoVirtual" },
        { nombre: "Mercado Producción", clave: "orden_mercado_produccion_default", campo: "ordenMercadoProduccion" },
    ] as const)("$nombre", ({ clave, campo }) => {
        it.each(["menor_precio", "mayor_precio", "nombre_asc", "nombre_desc", "mas_vendidas", "mas_actualizadas"])("interpreta el orden %s", (orden) => {
            preparar(crearConfiguracion({ [clave]: orden }));
            expect(propsOrdenamiento().configuracion[campo]).toBe(orden);
            expect(propsOrdenamiento().configuracion.ordenLanding).toBe("nombre_desc");
            const otroCampo = campo === "ordenMercadoVirtual" ? "ordenMercadoProduccion" : "ordenMercadoVirtual";
            const otroOrden = campo === "ordenMercadoVirtual" ? "mayor_precio" : "menor_precio";
            expect(propsOrdenamiento().configuracion[otroCampo]).toBe(otroOrden);
        });
    });

    it("usa Más vendidas cuando recibe órdenes desconocidos", () => {
        preparar(crearConfiguracion({ orden_landing_page_default: "desconocido", orden_mercado_virtual_default: "desconocido", orden_mercado_produccion_default: "desconocido" }));
        expect(propsOrdenamiento().configuracion).toEqual({ habilitado: true, ordenLanding: "mas_vendidas", ordenMercadoVirtual: "mas_vendidas", ordenMercadoProduccion: "mas_vendidas" });
    });

    it("actualiza localmente las entradas sin guardar automáticamente", () => {
        preparar();
        act(() => {
            propsInput("Lista Inteligente").onChangeValor?.("https://uam.com.uy/nueva.pdf");
            propsInput("Importe de ajuste rápido de precios").onChangeValor?.("50");
        });
        expect(propsInput("Lista Inteligente").valor).toBe("https://uam.com.uy/nueva.pdf");
        expect(propsInput("Importe de ajuste rápido de precios").valor).toBe("50");
        expect(mocks.guardarConfiguraciones).not.toHaveBeenCalled();
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("guarda únicamente la URL y refresca después de guardar", async () => {
        preparar();
        await act(async () => { await propsInput("Lista Inteligente").onGuardarValor?.("https://uam.com.uy/nueva.pdf") });
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({ url_lista_inteligente: "https://uam.com.uy/nueva.pdf" });
        expect(propsInput("Lista Inteligente").valor).toBe("https://uam.com.uy/nueva.pdf");
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("guarda únicamente el importe", async () => {
        preparar();
        await act(async () => { await propsInput("Importe de ajuste rápido de precios").onGuardarValor?.("50") });
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({ incremento_precio: "50" });
        expect(propsInput("Importe de ajuste rápido de precios").valor).toBe("50");
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("guarda las cuatro claves de ordenamiento juntas", async () => {
        preparar();
        await act(async () => {
            await propsOrdenamiento().onGuardar({ habilitado: false, ordenLanding: "nombre_asc", ordenMercadoVirtual: "mayor_precio", ordenMercadoProduccion: "menor_precio" });
        });
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({
            ordenamiento_habilitado: "false",
            orden_landing_page_default: "nombre_asc",
            orden_mercado_virtual_default: "mayor_precio",
            orden_mercado_produccion_default: "menor_precio",
        });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("guarda Más actualizadas para ambos mercados", async () => {
        preparar();
        await act(async () => {
            await propsOrdenamiento().onGuardar({ habilitado: true, ordenLanding: "nombre_asc", ordenMercadoVirtual: "mas_actualizadas", ordenMercadoProduccion: "mas_actualizadas" });
        });
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({
            ordenamiento_habilitado: "true",
            orden_landing_page_default: "nombre_asc",
            orden_mercado_virtual_default: "mas_actualizadas",
            orden_mercado_produccion_default: "mas_actualizadas",
        });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("guarda la vigencia de fotos de operadores sin modificar la de productores", async () => {
        preparar();
        await act(async () => { await propsVigencia("Vigencia de fotos de operadores").onGuardar({ habilitado: true, diasVigencia: "60", avisosHabilitados: true, diasAnticipacion: "10" }) });
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({
            aging_fotos_habilitado: "true",
            vigencia_fotos: "60",
            aviso_vencimiento_fotos_habilitado: "true",
            anticipacion_aviso_fotos: "10",
        });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("guarda la vigencia de publicaciones de operadores con sus propias claves", async () => {
        preparar();
        await act(async () => { await propsVigencia("Vigencia de publicaciones de operadores").onGuardar({ habilitado: true, diasVigencia: "60", avisosHabilitados: true, diasAnticipacion: "10" }) });
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({
            vigencia_publicaciones_operador_habilitada: "true",
            vigencia_publicaciones_operador: "60",
            aviso_vencimiento_publicaciones_operador_habilitado: "true",
            anticipacion_aviso_publicaciones_operador: "10",
        });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("guarda la vigencia de fotos de productores sin modificar la de operadores", async () => {
        preparar();
        await act(async () => { await propsVigencia("Vigencia de fotos de productores").onGuardar({ habilitado: true, diasVigencia: "12", avisosHabilitados: true, diasAnticipacion: "3" }) });
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({
            aging_fotos_productor_habilitado: "true",
            vigencia_fotos_productor: "12",
            aviso_vencimiento_fotos_productor_habilitado: "true",
            anticipacion_aviso_fotos_productor: "3",
        });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("guarda la vigencia de publicaciones de productores con sus propias claves", async () => {
        preparar();
        await act(async () => { await propsVigencia("Vigencia de publicaciones de productores").onGuardar({ habilitado: true, diasVigencia: "20", avisosHabilitados: true, diasAnticipacion: "3" }) });
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({
            vigencia_publicaciones_productor_habilitada: "true",
            vigencia_publicaciones_productor: "20",
            aviso_vencimiento_publicaciones_productor_habilitado: "true",
            anticipacion_aviso_publicaciones_productor: "3",
        });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it.each([true, false])("guarda el restablecimiento como texto: %s", async (habilitado) => {
        preparar();
        await act(async () => { await propsRestablecimiento().onGuardar(habilitado) });
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({ restablecimiento_contrasena_habilitado: String(habilitado) });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("actualiza la selección de especie sin guardar", () => {
        preparar();
        act(() => { propsFotos().onChangeEspecie("2") });
        expect(propsFotos().especieSeleccionada).toBe("2");
        expect(mocks.guardarFoto).not.toHaveBeenCalled();
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("delega el guardado de la foto y refresca", async () => {
        preparar();
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        await act(async () => { await propsFotos().onGuardarFoto(2, archivo) });
        expect(mocks.guardarFoto).toHaveBeenCalledExactlyOnceWith(2, archivo);
        expect(mocks.guardarConfiguraciones).not.toHaveBeenCalled();
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("delega la eliminación de la foto y refresca", async () => {
        preparar();
        await act(async () => { await propsFotos().onEliminarFoto(1) });
        expect(mocks.eliminarFoto).toHaveBeenCalledExactlyOnceWith(1);
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("propaga los errores de configuración sin refrescar", async () => {
        const error = new Error("Error al guardar");
        mocks.guardarConfiguraciones.mockRejectedValue(error);
        preparar();
        await expect(propsRestablecimiento().onGuardar(false)).rejects.toBe(error);
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("no actualiza el valor guardado de la URL si falla la acción", async () => {
        mocks.guardarConfiguraciones.mockRejectedValue(new Error("Error al guardar"));
        preparar();
        await expect(propsInput("Lista Inteligente").onGuardarValor?.("https://uam.com.uy/otra.pdf")).rejects.toThrow("Error al guardar");
        expect(propsInput("Lista Inteligente").valor).toBe("https://uam.com.uy/lista.pdf");
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("no actualiza el importe guardado si falla la acción", async () => {
        mocks.guardarConfiguraciones.mockRejectedValue(new Error("Error al guardar"));
        preparar();
        await expect(propsInput("Importe de ajuste rápido de precios").onGuardarValor?.("50")).rejects.toThrow("Error al guardar");
        expect(propsInput("Importe de ajuste rápido de precios").valor).toBe("25");
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("propaga los errores de carga de foto sin refrescar", async () => {
        const error = new Error("Error de imagen");
        mocks.guardarFoto.mockRejectedValue(error);
        preparar();
        await expect(propsFotos().onGuardarFoto(1, new File(["imagen"], "foto.png"))).rejects.toBe(error);
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("propaga los errores de eliminación sin refrescar", async () => {
        const error = new Error("Error de eliminación");
        mocks.eliminarFoto.mockRejectedValue(error);
        preparar();
        await expect(propsFotos().onEliminarFoto(1)).rejects.toBe(error);
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("sincroniza URL e importe cuando cambian los valores del servidor", () => {
        const { rerender } = preparar();
        rerender(<ListadoConfiguracionesGenerales configuracion={crearConfiguracion({ url_lista_inteligente: "https://uam.com.uy/nueva.pdf", incremento_precio: "100" })} especies={especies} />);
        expect(propsInput("Lista Inteligente").valor).toBe("https://uam.com.uy/nueva.pdf");
        expect(propsInput("Importe de ajuste rápido de precios").valor).toBe("100");
        expect(mocks.guardarConfiguraciones).not.toHaveBeenCalled();
    });
});
