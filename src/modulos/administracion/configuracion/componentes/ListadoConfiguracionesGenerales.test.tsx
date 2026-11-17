import type { ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ListadoConfiguracionesGenerales from "./ListadoConfiguracionesGenerales";

type PropsInput = ComponentProps<typeof import("./tarjetas/TarjetaInput").default>;
type PropsOrdenamiento = ComponentProps<typeof import("./tarjetas/TarjetaOrdenamientoPredeterminado").default>;
type PropsVigencia = ComponentProps<typeof import("./tarjetas/TarjetaVigencia").default>;
type PropsAvisosLocales = ComponentProps<typeof import("./tarjetas/TarjetaAvisosLocales").default>;
type PropsRestablecimiento = ComponentProps<typeof import("./tarjetas/TarjetaConfiguracionSwitch").default>;
type PropsFotos = ComponentProps<typeof import("../fotos-especies/componentes/TarjetaUploadFotoEspecie").default>;

const mocks = vi.hoisted(() => ({
    refresh: vi.fn(),
    guardarConfiguraciones: vi.fn(),
    guardarFoto: vi.fn(),
    eliminarFoto: vi.fn(),
    notificar: vi.fn(),
    input: vi.fn<(props: PropsInput) => null>(() => null),
    ordenamiento: vi.fn<(props: PropsOrdenamiento) => null>(() => null),
    vigencia: vi.fn<(props: PropsVigencia) => null>(() => null),
    avisosLocales: vi.fn<(props: PropsAvisosLocales) => null>(() => null),
    restablecimiento: vi.fn<(props: PropsRestablecimiento) => null>(() => null),
    fotos: vi.fn<(props: PropsFotos) => null>(() => null),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/modulos/administracion/configuracion/acciones/guardar-configuracion", () => ({
    guardarConfiguraciones: mocks.guardarConfiguraciones,
}));

vi.mock("@/modulos/administracion/configuracion/fotos-especies/acciones", () => ({
    guardarFotoEspecie: mocks.guardarFoto,
    eliminarFotoEspecie: mocks.eliminarFoto,
}));

vi.mock("@/compartido/componentes/NotificacionToast", () => ({
    useNotificacionToast: () => ({ notificar: mocks.notificar }),
}));

vi.mock("./tarjetas/TarjetaInput", () => ({ default: mocks.input }));
vi.mock("./tarjetas/TarjetaOrdenamientoPredeterminado", () => ({ default: mocks.ordenamiento }));
vi.mock("./tarjetas/TarjetaVigencia", () => ({ default: mocks.vigencia }));
vi.mock("./tarjetas/TarjetaAvisosLocales", () => ({ default: mocks.avisosLocales }));
vi.mock("./tarjetas/TarjetaConfiguracionSwitch", () => ({ default: mocks.restablecimiento }));
vi.mock("../fotos-especies/componentes/TarjetaUploadFotoEspecie", () => ({ default: mocks.fotos }));

const especies = [
    { id: 1, nombreEspecie: "Acelga", fotoEspecie: "/acelga.webp" },
    { id: 2, nombreEspecie: "Ají", fotoEspecie: null },
];

function crearConfiguracion(cambios: Record<string, string | null> = {}): Record<string, string | null> {
    return {
        url_lista_inteligente: "https://uam.com.uy/lista.pdf",
        incremento_precio: "25",
        anticipacion_aviso_vencimiento_locales: "9",
        aviso_vencimiento_locales_habilitado: "true",
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

function propsAvisosLocales(): PropsAvisosLocales {
    return mocks.avisosLocales.mock.calls.at(-1)![0];
}

function propsFotos(): PropsFotos {
    return mocks.fotos.mock.calls.at(-1)![0];
}

const botonGuardar = () => screen.getByRole("button", { name: "Guardar" });
const botonCancelar = () => screen.getByRole("button", { name: "Cancelar" });

function comprobarSinAcciones() {
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
}

async function guardarCambios() {
    await act(async () => { fireEvent.click(botonGuardar()); });
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
        expect(propsAvisosLocales().configuracion).toEqual({ habilitado: true, diasAnticipacion: "9" });
    });

    it("no muestra Guardar ni Cancelar cuando no hay cambios", () => {
        preparar();
        comprobarSinAcciones();
        expect(document.querySelectorAll("form")).toHaveLength(1);
        expect(document.querySelector("form")).toHaveAttribute("novalidate");
        fireEvent.submit(screen.getByRole("form", { name: "Configuración general" }));
        expect(mocks.guardarConfiguraciones).not.toHaveBeenCalled();
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
        for (const rol of ["operadores", "productores"]) {
            expect(propsVigencia(`Vigencia de fotos de ${rol}`).avisosIndependientes).not.toBe(true);
            expect(propsVigencia(`Vigencia de publicaciones de ${rol}`).avisosIndependientes).toBe(true);
        }
    });

    it.each<{ configuracion: Record<string, string | null>; esperado: string }>([
        { configuracion: {}, esperado: "3" },
        { configuracion: { anticipacion_aviso_vencimiento_locales: null }, esperado: "3" },
        { configuracion: { anticipacion_aviso_vencimiento_locales: "0" }, esperado: "0" },
    ])("muestra $esperado días de aviso de locales según la configuración", ({ configuracion, esperado }) => {
        preparar(configuracion);
        expect(propsAvisosLocales().configuracion).toEqual({ habilitado: true, diasAnticipacion: esperado });
    });

    it.each([true, false])("entrega el estado %s de avisos de locales sin perder su anticipación", (habilitado) => {
        preparar(crearConfiguracion({ aviso_vencimiento_locales_habilitado: String(habilitado) }));
        expect(propsAvisosLocales().configuracion).toEqual({ habilitado, diasAnticipacion: "9" });
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

    it("mantiene todos los cambios en borrador y marca únicamente los campos modificados", () => {
        preparar();
        act(() => {
            propsInput("Lista Inteligente").onChangeValor("https://uam.com.uy/nueva.pdf");
            propsInput("Importe de ajuste rápido de precios").onChangeValor("50");
            propsOrdenamiento().onChange({ ordenMercadoVirtual: "mayor_precio" });
            propsAvisosLocales().onChange({ habilitado: false });
            propsRestablecimiento().onChange(false);
        });
        expect(propsInput("Lista Inteligente")).toMatchObject({ valor: "https://uam.com.uy/nueva.pdf", modificado: true });
        expect(propsInput("Importe de ajuste rápido de precios")).toMatchObject({ valor: "50", modificado: true });
        expect(propsOrdenamiento().modificados?.ordenMercadoVirtual).toBe(true);
        expect(propsOrdenamiento().modificados?.ordenLanding).not.toBe(true);
        expect(propsAvisosLocales().modificados?.habilitado).toBe(true);
        expect(propsAvisosLocales().modificados?.diasAnticipacion).not.toBe(true);
        expect(propsRestablecimiento().modificado).toBe(true);
        expect(botonGuardar()).toBeEnabled();
        expect(botonCancelar()).toBeEnabled();
        expect(mocks.guardarConfiguraciones).not.toHaveBeenCalled();
        expect(mocks.refresh).not.toHaveBeenCalled();
        act(() => { propsInput("Lista Inteligente").onChangeValor("https://uam.com.uy/lista.pdf"); });
        expect(propsInput("Lista Inteligente").modificado).not.toBe(true);
        expect(propsInput("Importe de ajuste rápido de precios").modificado).toBe(true);
        act(() => {
            propsInput("Importe de ajuste rápido de precios").onChangeValor("25");
            propsOrdenamiento().onChange({ ordenMercadoVirtual: "menor_precio" });
            propsAvisosLocales().onChange({ habilitado: true });
            propsRestablecimiento().onChange(true);
        });
        comprobarSinAcciones();
    });

    it("guarda juntos únicamente los cambios de todas las tarjetas y confirma una sola vez", async () => {
        preparar();
        act(() => {
            propsInput("Lista Inteligente").onChangeValor("https://uam.com.uy/nueva.pdf");
            propsInput("Importe de ajuste rápido de precios").onChangeValor("050");
            propsOrdenamiento().onChange({ habilitado: false, ordenLanding: "nombre_asc", ordenMercadoVirtual: "mas_actualizadas", ordenMercadoProduccion: "mas_actualizadas" });
            propsVigencia("Vigencia de fotos de operadores").onChange({ diasVigencia: "40", diasAnticipacion: "35" });
            propsAvisosLocales().onChange({ habilitado: false, diasAnticipacion: "0" });
            propsRestablecimiento().onChange(false);
        });
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({
            url_lista_inteligente: "https://uam.com.uy/nueva.pdf", incremento_precio: "50",
            ordenamiento_habilitado: "false", orden_landing_page_default: "nombre_asc",
            orden_mercado_virtual_default: "mas_actualizadas", orden_mercado_produccion_default: "mas_actualizadas",
            vigencia_fotos: "40", anticipacion_aviso_fotos: "35",
            aviso_vencimiento_locales_habilitado: "false", anticipacion_aviso_vencimiento_locales: "0",
            restablecimiento_contrasena_habilitado: "false",
        });
        expect(propsInput("Importe de ajuste rápido de precios")).toMatchObject({ valor: "50", modificado: false });
        expect(propsVigencia("Vigencia de fotos de operadores").modificados?.diasVigencia).not.toBe(true);
        comprobarSinAcciones();
        expect(mocks.notificar).toHaveBeenCalledExactlyOnceWith("La configuración se guardó correctamente.", "success");
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it.each([
        { titulo: "Vigencia de fotos de operadores", vigencia: "vigencia_fotos", anticipacion: "anticipacion_aviso_fotos" },
        { titulo: "Vigencia de fotos de productores", vigencia: "vigencia_fotos_productor", anticipacion: "anticipacion_aviso_fotos_productor" },
        { titulo: "Vigencia de publicaciones de operadores", vigencia: "vigencia_publicaciones_operador", anticipacion: "anticipacion_aviso_publicaciones_operador" },
        { titulo: "Vigencia de publicaciones de productores", vigencia: "vigencia_publicaciones_productor", anticipacion: "anticipacion_aviso_publicaciones_productor" },
    ])("guarda los plazos de $titulo sin modificar las claves de otros grupos", async ({ titulo, vigencia, anticipacion }) => {
        preparar();
        act(() => { propsVigencia(titulo).onChange({ diasVigencia: "60", diasAnticipacion: "8" }); });
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({ [vigencia]: "60", [anticipacion]: "8" });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it.each([true, false])("guarda el restablecimiento %s sin reenviar configuraciones intactas", async (habilitado) => {
        preparar(crearConfiguracion({ restablecimiento_contrasena_habilitado: String(!habilitado) }));
        act(() => { propsRestablecimiento().onChange(habilitado); });
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({ restablecimiento_contrasena_habilitado: String(habilitado) });
    });

    it("conserva los avisos de publicaciones al desactivar solamente la vigencia administrativa", async () => {
        preparar();
        act(() => { propsVigencia("Vigencia de publicaciones de operadores").onChange({ habilitado: false }); });
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({ vigencia_publicaciones_operador_habilitada: "false" });
        expect(propsVigencia("Vigencia de publicaciones de operadores").configuracion.avisosHabilitados).toBe(true);
    });

    it("Cancelar restaura todos los valores, fotos y marcas sin escribir en el servidor", () => {
        preparar();
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        act(() => {
            propsInput("Lista Inteligente").onChangeValor("https://uam.com.uy/otra.pdf");
            propsInput("Importe de ajuste rápido de precios").onChangeValor("99");
            propsOrdenamiento().onChange({ habilitado: false, ordenLanding: "nombre_asc" });
            propsVigencia("Vigencia de fotos de productores").onChange({ diasVigencia: "45" });
            propsAvisosLocales().onChange({ habilitado: false, diasAnticipacion: "18" });
            propsRestablecimiento().onChange(false);
            propsFotos().onChangeFoto(1, null);
            propsFotos().onChangeFoto(2, archivo);
        });
        fireEvent.click(botonCancelar());
        expect(propsInput("Lista Inteligente")).toMatchObject({ valor: "https://uam.com.uy/lista.pdf", modificado: false });
        expect(propsInput("Importe de ajuste rápido de precios")).toMatchObject({ valor: "25", modificado: false });
        expect(propsOrdenamiento().configuracion).toMatchObject({ habilitado: true, ordenLanding: "nombre_desc" });
        expect(Object.values(propsOrdenamiento().modificados ?? {})).not.toContain(true);
        expect(propsVigencia("Vigencia de fotos de productores").configuracion.diasVigencia).toBe("10");
        expect(Object.values(propsVigencia("Vigencia de fotos de productores").modificados ?? {})).not.toContain(true);
        expect(propsAvisosLocales().configuracion).toEqual({ habilitado: true, diasAnticipacion: "9" });
        expect(propsRestablecimiento()).toMatchObject({ habilitado: true, modificado: false });
        expect(propsFotos().cambios).toEqual({});
        comprobarSinAcciones();
        expect(mocks.guardarConfiguraciones).not.toHaveBeenCalled();
        expect(mocks.guardarFoto).not.toHaveBeenCalled();
        expect(mocks.eliminarFoto).not.toHaveBeenCalled();
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("rechaza campos obligatorios vacíos, los marca y permite corregirlos sin perder otros borradores", async () => {
        preparar();
        act(() => {
            propsInput("Lista Inteligente").onChangeValor("");
            propsInput("Importe de ajuste rápido de precios").onChangeValor("50");
        });
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).not.toHaveBeenCalled();
        expect(mocks.notificar).toHaveBeenCalledExactlyOnceWith("Faltan completar campos.", "error");
        expect(propsInput("Lista Inteligente").error).toBe(true);
        expect(propsInput("Importe de ajuste rápido de precios").valor).toBe("50");
        act(() => { propsInput("Lista Inteligente").onChangeValor("https://uam.com.uy/nueva.pdf"); });
        expect(propsInput("Lista Inteligente").error).not.toBe(true);
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({ url_lista_inteligente: "https://uam.com.uy/nueva.pdf", incremento_precio: "50" });
    });

    it.each([
        { titulo: "Lista Inteligente", valor: "https://uam.com.uy/lista.html" },
        { titulo: "Importe de ajuste rápido de precios", valor: "0" },
    ])("valida $titulo antes de enviar cambios", async ({ titulo, valor }) => {
        preparar();
        act(() => { propsInput(titulo).onChangeValor(valor); });
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).not.toHaveBeenCalled();
        expect(propsInput(titulo).error).toBe(true);
        expect(propsInput(titulo).modificado).toBe(true);
        expect(mocks.notificar).toHaveBeenCalledExactlyOnceWith(expect.any(String), "error");
    });

    it("valida la relación entre los plazos pendientes y el límite de aviso de locales", async () => {
        preparar();
        act(() => { propsVigencia("Vigencia de fotos de operadores").onChange({ diasVigencia: "5", diasAnticipacion: "10" }); });
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).not.toHaveBeenCalled();
        expect(propsVigencia("Vigencia de fotos de operadores").errores?.diasAnticipacion).toBe(true);
        fireEvent.click(botonCancelar());
        act(() => { propsAvisosLocales().onChange({ diasAnticipacion: "366" }); });
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).not.toHaveBeenCalled();
        expect(propsAvisosLocales().errores?.diasAnticipacion).toBe(true);
    });

    it("conserva el borrador al fallar la configuración y reintenta sin ejecutar fotos antes de guardarla", async () => {
        mocks.guardarConfiguraciones.mockRejectedValueOnce(new Error("Error al guardar"));
        preparar();
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        act(() => {
            propsInput("Importe de ajuste rápido de precios").onChangeValor("50");
            propsFotos().onChangeFoto(2, archivo);
        });
        await guardarCambios();
        expect(propsInput("Importe de ajuste rápido de precios")).toMatchObject({ valor: "50", modificado: true });
        expect(propsFotos().cambios).toEqual({ 2: archivo });
        expect(mocks.guardarFoto).not.toHaveBeenCalled();
        expect(mocks.refresh).not.toHaveBeenCalled();
        expect(mocks.notificar).toHaveBeenCalledExactlyOnceWith("Error al guardar", "error");
        expect(botonGuardar()).toBeEnabled();
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledTimes(2);
        expect(mocks.guardarFoto).toHaveBeenCalledExactlyOnceWith(2, archivo);
        comprobarSinAcciones();
    });

    it("bloquea el formulario y evita envíos repetidos mientras guarda", async () => {
        let finalizar!: () => void;
        mocks.guardarConfiguraciones.mockImplementationOnce(() => new Promise<void>((resolve) => { finalizar = resolve; }));
        preparar();
        act(() => { propsInput("Importe de ajuste rápido de precios").onChangeValor("50"); });
        fireEvent.click(botonGuardar());
        expect(botonGuardar()).toBeDisabled();
        expect(botonCancelar()).toBeDisabled();
        expect(propsInput("Importe de ajuste rápido de precios").guardando).toBe(true);
        expect(propsOrdenamiento().guardando).toBe(true);
        expect(propsVigencia("Vigencia de fotos de operadores").guardando).toBe(true);
        expect(propsAvisosLocales().guardando).toBe(true);
        expect(propsRestablecimiento().guardando).toBe(true);
        expect(propsFotos().guardando).toBe(true);
        fireEvent.click(botonGuardar());
        fireEvent.click(botonCancelar());
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledOnce();
        expect(propsInput("Importe de ajuste rápido de precios").valor).toBe("50");
        await act(async () => { finalizar(); });
        expect(propsInput("Importe de ajuste rápido de precios").guardando).toBe(false);
        comprobarSinAcciones();
    });

    it("conserva borradores de fotos de distintas especies y permite deshacer uno antes de Guardar", async () => {
        preparar();
        const primera = new File(["primera"], "primera.png", { type: "image/png" });
        const segunda = new File(["segunda"], "segunda.png", { type: "image/png" });
        act(() => {
            propsFotos().onChangeEspecie("1");
            propsFotos().onChangeFoto(1, primera);
            propsFotos().onChangeEspecie("2");
            propsFotos().onChangeFoto(2, segunda);
        });
        expect(propsFotos().especieSeleccionada).toBe("2");
        expect(propsFotos().cambios).toEqual({ 1: primera, 2: segunda });
        expect(mocks.guardarFoto).not.toHaveBeenCalled();
        act(() => { propsFotos().onChangeFoto(1, undefined); });
        expect(propsFotos().cambios).toEqual({ 2: segunda });
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).not.toHaveBeenCalled();
        expect(mocks.guardarFoto).toHaveBeenCalledExactlyOnceWith(2, segunda);
        expect(propsFotos().cambios).toEqual({});
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("confirma las operaciones exitosas y conserva únicamente la foto fallida para reintentar", async () => {
        mocks.guardarFoto.mockRejectedValueOnce(new Error("No se pudo subir la foto"));
        preparar();
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        act(() => {
            propsInput("Importe de ajuste rápido de precios").onChangeValor("50");
            propsFotos().onChangeFoto(1, null);
            propsFotos().onChangeFoto(2, archivo);
        });
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledExactlyOnceWith({ incremento_precio: "50" });
        expect(mocks.eliminarFoto).toHaveBeenCalledExactlyOnceWith(1);
        expect(mocks.guardarFoto).toHaveBeenCalledExactlyOnceWith(2, archivo);
        expect(mocks.guardarConfiguraciones.mock.invocationCallOrder[0]).toBeLessThan(mocks.eliminarFoto.mock.invocationCallOrder[0]);
        expect(mocks.eliminarFoto.mock.invocationCallOrder[0]).toBeLessThan(mocks.guardarFoto.mock.invocationCallOrder[0]);
        expect(propsInput("Importe de ajuste rápido de precios").modificado).not.toBe(true);
        expect(propsFotos().cambios).toEqual({ 2: archivo });
        expect(propsFotos().confirmadas).toMatchObject({ 1: null });
        expect(mocks.notificar).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/^Se guardaron algunos cambios\./), "error");
        expect(botonGuardar()).toBeEnabled();
        await guardarCambios();
        expect(mocks.guardarConfiguraciones).toHaveBeenCalledOnce();
        expect(mocks.eliminarFoto).toHaveBeenCalledOnce();
        expect(mocks.guardarFoto).toHaveBeenCalledTimes(2);
        expect(propsFotos().cambios).toEqual({});
        comprobarSinAcciones();
    });

    it("conserva una eliminación fallida y permite cancelarla sin borrar la foto", async () => {
        mocks.eliminarFoto.mockRejectedValueOnce(new Error("No se pudo eliminar"));
        preparar();
        act(() => { propsFotos().onChangeFoto(1, null); });
        await guardarCambios();
        expect(propsFotos().cambios).toEqual({ 1: null });
        expect(mocks.notificar).toHaveBeenCalledExactlyOnceWith("No se pudo eliminar", "error");
        fireEvent.click(botonCancelar());
        expect(propsFotos().cambios).toEqual({});
        expect(propsFotos().especies).toEqual(especies);
        expect(mocks.eliminarFoto).toHaveBeenCalledOnce();
    });

    it("sincroniza valores recibidos sin descartar campos editados y Cancelar usa la última base", () => {
        const { rerender } = preparar();
        act(() => { propsInput("Lista Inteligente").onChangeValor("https://uam.com.uy/borrador.pdf"); });
        rerender(<ListadoConfiguracionesGenerales configuracion={crearConfiguracion({ url_lista_inteligente: "https://uam.com.uy/servidor.pdf", incremento_precio: "100", aviso_vencimiento_locales_habilitado: "false", anticipacion_aviso_vencimiento_locales: "0" })} especies={especies} />);
        expect(propsInput("Lista Inteligente")).toMatchObject({ valor: "https://uam.com.uy/borrador.pdf", modificado: true });
        expect(propsInput("Importe de ajuste rápido de precios").valor).toBe("100");
        expect(propsAvisosLocales().configuracion).toEqual({ habilitado: false, diasAnticipacion: "0" });
        fireEvent.click(botonCancelar());
        expect(propsInput("Lista Inteligente")).toMatchObject({ valor: "https://uam.com.uy/servidor.pdf", modificado: false });
        expect(mocks.guardarConfiguraciones).not.toHaveBeenCalled();
    });
});
