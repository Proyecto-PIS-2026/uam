import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TarjetaOrdenamientoPredeterminado, { type ConfiguracionOrdenamiento } from "./TarjetaOrdenamientoPredeterminado";

afterEach(cleanup);

const etiquetaInicio = "Orden predeterminado de Inicio";
const etiquetaVirtual = "Orden predeterminado de Mercado Virtual";
const etiquetaProduccion = "Orden predeterminado de Mercado Producción";

const etiquetasOrden = {
    nombre_asc: "A-Z",
    nombre_desc: "Z-A",
    menor_precio: "Menor precio",
    mayor_precio: "Mayor precio",
    mas_vendidas: "Más vendidas",
};

function crearConfiguracion(cambios: Partial<ConfiguracionOrdenamiento> = {}): ConfiguracionOrdenamiento {
    return {
        habilitado: true,
        ordenLanding: "nombre_asc",
        ordenMercadoVirtual: "menor_precio",
        ordenMercadoProduccion: "mayor_precio",
        ...cambios,
    };
}

function preparar(configuracion = crearConfiguracion(), onGuardar = vi.fn().mockResolvedValue(undefined)) {
    const props = { configuracion, onGuardar };
    return { ...render(<TarjetaOrdenamientoPredeterminado {...props} />), props, onGuardar };
}

function obtenerSwitch() {
    return screen.getByRole("switch", { name: "Permitir cambiar el orden" });
}

function botonGuardar() {
    return screen.getByRole("button", { name: "Guardar configuración de ordenamiento" });
}

function selector(etiqueta: string) {
    return screen.getByRole("combobox", { name: etiqueta });
}

async function seleccionarOrden(etiqueta: string, opcion: string) {
    fireEvent.mouseDown(selector(etiqueta));
    fireEvent.click(await screen.findByRole("option", { name: opcion }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

describe("TarjetaOrdenamientoPredeterminado", () => {
    it("muestra los textos y los tres órdenes recibidos", () => {
        preparar();
        expect(screen.getByText("Orden de las publicaciones")).toBeInTheDocument();
        expect(screen.getByText("Configurá el orden predeterminado de cada sección y si los usuarios pueden cambiarlo.")).toBeInTheDocument();
        expect(obtenerSwitch()).toBeChecked();
        expect(selector(etiquetaInicio)).toHaveTextContent("A-Z");
        expect(selector(etiquetaVirtual)).toHaveTextContent("Menor precio");
        expect(selector(etiquetaProduccion)).toHaveTextContent("Mayor precio");
        expect(botonGuardar()).toBeDisabled();
    });

    it.each([true, false])("muestra el estado inicial %s sin cambios pendientes", (habilitado) => {
        preparar(crearConfiguracion({ habilitado }));
        expect(obtenerSwitch()).toHaveProperty("checked", habilitado);
        expect(botonGuardar()).toBeDisabled();
    });

    it("actualiza la descripción al cambiar el switch sin guardar automáticamente", () => {
        const { onGuardar } = preparar();
        expect(screen.getByText("Los usuarios pueden elegir cómo ordenar los resultados.")).toBeInTheDocument();
        fireEvent.click(obtenerSwitch());
        expect(screen.getByText("Se utiliza únicamente el orden predeterminado.")).toBeInTheDocument();
        expect(screen.queryByText("Los usuarios pueden elegir cómo ordenar los resultados.")).not.toBeInTheDocument();
        expect(botonGuardar()).toBeEnabled();
        expect(onGuardar).not.toHaveBeenCalled();
    });

    it("mantiene los tres selectores habilitados con el switch apagado", () => {
        preparar(crearConfiguracion({ habilitado: false }));
        expect(selector(etiquetaInicio)).not.toHaveAttribute("aria-disabled", "true");
        expect(selector(etiquetaVirtual)).not.toHaveAttribute("aria-disabled", "true");
        expect(selector(etiquetaProduccion)).not.toHaveAttribute("aria-disabled", "true");
    });

    it("ofrece solamente A-Z, Z-A y Más vendidas para Inicio", async () => {
        preparar();
        fireEvent.mouseDown(selector(etiquetaInicio));
        expect(await screen.findByRole("option", { name: "A-Z" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Z-A" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Más vendidas" })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Menor precio" })).not.toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Mayor precio" })).not.toBeInTheDocument();
        expect(screen.getAllByRole("option")).toHaveLength(3);
    });

    it.each([etiquetaVirtual, etiquetaProduccion])("ofrece las cinco opciones en %s", async (etiqueta) => {
        preparar();
        fireEvent.mouseDown(selector(etiqueta));
        expect(await screen.findByRole("option", { name: "Menor precio" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Mayor precio" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "A-Z" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Z-A" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Más vendidas" })).toBeInTheDocument();
        expect(screen.getAllByRole("option")).toHaveLength(5);
    });

    it.each([
        { etiqueta: etiquetaInicio, opcion: "Z-A", inicio: "Z-A", virtual: "Menor precio", produccion: "Mayor precio" },
        { etiqueta: etiquetaVirtual, opcion: "Mayor precio", inicio: "A-Z", virtual: "Mayor precio", produccion: "Mayor precio" },
        { etiqueta: etiquetaProduccion, opcion: "Menor precio", inicio: "A-Z", virtual: "Menor precio", produccion: "Menor precio" },
    ])("cambia $etiqueta sin modificar los otros órdenes", async ({ etiqueta, opcion, inicio, virtual, produccion }) => {
        const { onGuardar } = preparar();
        await seleccionarOrden(etiqueta, opcion);
        expect(selector(etiquetaInicio)).toHaveTextContent(inicio);
        expect(selector(etiquetaVirtual)).toHaveTextContent(virtual);
        expect(selector(etiquetaProduccion)).toHaveTextContent(produccion);
        expect(botonGuardar()).toBeEnabled();
        expect(onGuardar).not.toHaveBeenCalled();
    });

    it("restaurar el switch al estado original elimina el cambio pendiente", () => {
        preparar();
        fireEvent.click(obtenerSwitch());
        expect(botonGuardar()).toBeEnabled();
        fireEvent.click(obtenerSwitch());
        expect(obtenerSwitch()).toBeChecked();
        expect(botonGuardar()).toBeDisabled();
    });

    it.each([
        { etiqueta: etiquetaInicio, nuevo: "Z-A", original: "A-Z" },
        { etiqueta: etiquetaVirtual, nuevo: "Mayor precio", original: "Menor precio" },
        { etiqueta: etiquetaProduccion, nuevo: "Menor precio", original: "Mayor precio" },
    ])("restaurar $etiqueta elimina el cambio pendiente", async ({ etiqueta, nuevo, original }) => {
        preparar();
        await seleccionarOrden(etiqueta, nuevo);
        expect(botonGuardar()).toBeEnabled();
        await seleccionarOrden(etiqueta, original);
        expect(botonGuardar()).toBeDisabled();
    });

    it("apagar el switch conserva los tres órdenes seleccionados", async () => {
        preparar();
        await seleccionarOrden(etiquetaInicio, "Z-A");
        await seleccionarOrden(etiquetaVirtual, "Mayor precio");
        await seleccionarOrden(etiquetaProduccion, "Menor precio");
        fireEvent.click(obtenerSwitch());
        expect(obtenerSwitch()).not.toBeChecked();
        expect(selector(etiquetaInicio)).toHaveTextContent("Z-A");
        expect(selector(etiquetaVirtual)).toHaveTextContent("Mayor precio");
        expect(selector(etiquetaProduccion)).toHaveTextContent("Menor precio");
    });

    it("guarda los cuatro valores juntos y muestra confirmación", async () => {
        const { onGuardar } = preparar();
        await seleccionarOrden(etiquetaInicio, "Z-A");
        await seleccionarOrden(etiquetaVirtual, "Mayor precio");
        await seleccionarOrden(etiquetaProduccion, "Menor precio");
        fireEvent.click(obtenerSwitch());
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(onGuardar).toHaveBeenCalledExactlyOnceWith({
            habilitado: false,
            ordenLanding: "nombre_desc",
            ordenMercadoVirtual: "mayor_precio",
            ordenMercadoProduccion: "menor_precio",
        }));
        expect(await screen.findByRole("status")).toHaveTextContent("La configuración de ordenamiento se guardó correctamente.");
        expect(botonGuardar()).toBeDisabled();
    });

    it("permite configurar Más vendidas en las tres secciones desde el panel", async () => {
        const { onGuardar } = preparar();
        await seleccionarOrden(etiquetaInicio, "Más vendidas");
        await seleccionarOrden(etiquetaVirtual, "Más vendidas");
        await seleccionarOrden(etiquetaProduccion, "Más vendidas");
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(onGuardar).toHaveBeenCalledExactlyOnceWith({
            habilitado: true,
            ordenLanding: "mas_vendidas",
            ordenMercadoVirtual: "mas_vendidas",
            ordenMercadoProduccion: "mas_vendidas",
        }));
    });

    it("permite guardar órdenes nuevos con el switch apagado", async () => {
        const { onGuardar } = preparar(crearConfiguracion({ habilitado: false }));
        await seleccionarOrden(etiquetaVirtual, "Mayor precio");
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(onGuardar).toHaveBeenCalledExactlyOnceWith({
            habilitado: false,
            ordenLanding: "nombre_asc",
            ordenMercadoVirtual: "mayor_precio",
            ordenMercadoProduccion: "mayor_precio",
        }));
    });

    it("bloquea los controles mientras guarda y evita envíos repetidos", async () => {
        let finalizar!: () => void;
        const onGuardar = vi.fn(() => new Promise<void>((resolve) => { finalizar = resolve; }));
        preparar(crearConfiguracion(), onGuardar);
        fireEvent.click(obtenerSwitch());
        fireEvent.click(botonGuardar());
        expect(obtenerSwitch()).toBeDisabled();
        for (const etiqueta of [etiquetaInicio, etiquetaVirtual, etiquetaProduccion]) {
            expect(selector(etiqueta)).toHaveAttribute("aria-disabled", "true");
        }
        expect(botonGuardar()).toBeDisabled();
        fireEvent.click(botonGuardar());
        expect(onGuardar).toHaveBeenCalledOnce();
        await act(async () => { finalizar(); });
        expect(obtenerSwitch()).toBeEnabled();
        for (const etiqueta of [etiquetaInicio, etiquetaVirtual, etiquetaProduccion]) {
            expect(selector(etiqueta)).not.toHaveAttribute("aria-disabled", "true");
        }
        expect(botonGuardar()).toBeDisabled();
    });

    it("conserva los cambios cuando falla el guardado", async () => {
        preparar(crearConfiguracion(), vi.fn().mockRejectedValue(new Error("Error de conexión")));
        await seleccionarOrden(etiquetaVirtual, "Mayor precio");
        fireEvent.click(botonGuardar());
        expect(await screen.findByRole("alert")).toHaveTextContent("Error de conexión");
        expect(selector(etiquetaVirtual)).toHaveTextContent("Mayor precio");
        await waitFor(() => expect(botonGuardar()).toBeEnabled());
    });

    it("permite reintentar después de un error", async () => {
        const onGuardar = vi.fn().mockRejectedValueOnce(new Error("Error temporal")).mockResolvedValueOnce(undefined);
        preparar(crearConfiguracion(), onGuardar);
        fireEvent.click(obtenerSwitch());
        fireEvent.click(botonGuardar());
        expect(await screen.findByRole("alert")).toHaveTextContent("Error temporal");
        await waitFor(() => expect(botonGuardar()).toBeEnabled());
        fireEvent.click(botonGuardar());
        expect(await screen.findByRole("status")).toHaveTextContent("La configuración de ordenamiento se guardó correctamente.");
        expect(onGuardar).toHaveBeenCalledTimes(2);
        expect(botonGuardar()).toBeDisabled();
    });

    it("muestra un error genérico si el rechazo no es un Error", async () => {
        preparar(crearConfiguracion(), vi.fn().mockRejectedValue("fallo"));
        fireEvent.click(obtenerSwitch());
        fireEvent.click(botonGuardar());
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la configuración de ordenamiento.");
        await waitFor(() => expect(botonGuardar()).toBeEnabled());
    });

    it.each([
        { habilitado: false },
        { ordenLanding: "nombre_desc" },
        { ordenMercadoVirtual: "mayor_precio" },
        { ordenMercadoProduccion: "menor_precio" },
    ] satisfies Partial<ConfiguracionOrdenamiento>[])("sincroniza cambios recibidos del servidor: %j", (cambios) => {
        const { rerender, props } = preparar();
        const nuevaConfiguracion = crearConfiguracion(cambios);
        rerender(<TarjetaOrdenamientoPredeterminado {...props} configuracion={nuevaConfiguracion} />);
        expect(obtenerSwitch()).toHaveProperty("checked", nuevaConfiguracion.habilitado);
        expect(selector(etiquetaInicio)).toHaveTextContent(etiquetasOrden[nuevaConfiguracion.ordenLanding]);
        expect(selector(etiquetaVirtual)).toHaveTextContent(etiquetasOrden[nuevaConfiguracion.ordenMercadoVirtual]);
        expect(selector(etiquetaProduccion)).toHaveTextContent(etiquetasOrden[nuevaConfiguracion.ordenMercadoProduccion]);
        expect(botonGuardar()).toBeDisabled();
    });

    it("conserva la edición si recibe otro objeto con los mismos valores", async () => {
        const { rerender, props } = preparar();
        await seleccionarOrden(etiquetaVirtual, "Mayor precio");
        rerender(<TarjetaOrdenamientoPredeterminado {...props} configuracion={crearConfiguracion()} />);
        expect(selector(etiquetaVirtual)).toHaveTextContent("Mayor precio");
        expect(botonGuardar()).toBeEnabled();
    });

    it("no ejecuta el guardado sin cambios pendientes", () => {
        const { onGuardar } = preparar();
        fireEvent.click(botonGuardar());
        expect(onGuardar).not.toHaveBeenCalled();
    });
});