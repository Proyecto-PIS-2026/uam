import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TarjetaOrdenamientoPredeterminado, { type ConfiguracionOrdenamiento } from "./TarjetaOrdenamientoPredeterminado";

afterEach(cleanup);

const configuracion: ConfiguracionOrdenamiento = {
    habilitado: true, ordenLanding: "nombre_asc", ordenMercadoVirtual: "menor_precio", ordenMercadoProduccion: "mayor_precio",
};
const etiquetaInicio = "Orden predeterminado de Inicio";
const etiquetaVirtual = "Orden predeterminado de Mercado Virtual";
const etiquetaProduccion = "Orden predeterminado de Mercado Producción";

function preparar(cambios: Partial<ConfiguracionOrdenamiento> = {}) {
    const props = { configuracion: { ...configuracion, ...cambios }, onChange: vi.fn() };
    return { ...render(<TarjetaOrdenamientoPredeterminado {...props} />), props };
}

function selector(etiqueta: string) {
    return screen.getByRole("combobox", { name: etiqueta });
}

async function seleccionarOrden(etiqueta: string, opcion: string) {
    fireEvent.mouseDown(selector(etiqueta));
    fireEvent.click(await screen.findByRole("option", { name: opcion }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

describe("TarjetaOrdenamientoPredeterminado controlada", () => {
    it("muestra la configuración sin formularios ni botones de guardado propios", () => {
        const { container } = preparar();
        expect(screen.getByText("Orden de las publicaciones")).toBeInTheDocument();
        expect(screen.getByRole("switch", { name: "Permitir cambiar el orden" })).toBeChecked();
        expect(selector(etiquetaInicio)).toHaveTextContent("A-Z");
        expect(selector(etiquetaVirtual)).toHaveTextContent("Menor Precio");
        expect(selector(etiquetaProduccion)).toHaveTextContent("Mayor Precio");
        expect(screen.queryByRole("button", { name: /^Guardar/ })).not.toBeInTheDocument();
        expect(container.querySelector("form")).toBeNull();
    });

    it("comunica solo el permiso y refleja la descripción recibida desde el panel", () => {
        const { props, rerender } = preparar();
        fireEvent.click(screen.getByRole("switch", { name: "Permitir cambiar el orden" }));
        expect(props.onChange).toHaveBeenCalledExactlyOnceWith({ habilitado: false });
        expect(props.configuracion).toEqual(configuracion);
        rerender(<TarjetaOrdenamientoPredeterminado {...props} configuracion={{ ...configuracion, habilitado: false }} />);
        expect(screen.getByRole("switch", { name: "Permitir cambiar el orden" })).not.toBeChecked();
        expect(screen.getByText("Se utiliza únicamente el orden predeterminado.")).toBeInTheDocument();
        expect(screen.queryByText("Los usuarios pueden elegir cómo ordenar los resultados.")).not.toBeInTheDocument();
        for (const etiqueta of [etiquetaInicio, etiquetaVirtual, etiquetaProduccion]) expect(selector(etiqueta)).not.toHaveAttribute("aria-disabled", "true");
    });

    it("ofrece solamente A-Z, Z-A y Más vendidas para Inicio", async () => {
        preparar();
        fireEvent.mouseDown(selector(etiquetaInicio));
        expect(await screen.findByRole("option", { name: "A-Z" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Z-A" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Más vendidas" })).toBeInTheDocument();
        expect(screen.getAllByRole("option")).toHaveLength(3);
    });

    it.each([etiquetaVirtual, etiquetaProduccion])("ofrece las seis opciones en %s", async (etiqueta) => {
        preparar();
        fireEvent.mouseDown(selector(etiqueta));
        expect(await screen.findByRole("option", { name: "Menor Precio" })).toBeInTheDocument();
        for (const opcion of ["Mayor Precio", "A-Z", "Z-A", "Más vendidas", "Más actualizadas"]) {
            expect(screen.getByRole("option", { name: opcion })).toBeInTheDocument();
        }
        expect(screen.getAllByRole("option")).toHaveLength(6);
    });

    it.each([
        { etiqueta: etiquetaInicio, opcion: "Z-A", campo: "ordenLanding", valor: "nombre_desc" },
        { etiqueta: etiquetaInicio, opcion: "Más vendidas", campo: "ordenLanding", valor: "mas_vendidas" },
        { etiqueta: etiquetaVirtual, opcion: "Mayor Precio", campo: "ordenMercadoVirtual", valor: "mayor_precio" },
        { etiqueta: etiquetaVirtual, opcion: "Más actualizadas", campo: "ordenMercadoVirtual", valor: "mas_actualizadas" },
        { etiqueta: etiquetaProduccion, opcion: "Menor Precio", campo: "ordenMercadoProduccion", valor: "menor_precio" },
        { etiqueta: etiquetaProduccion, opcion: "Más actualizadas", campo: "ordenMercadoProduccion", valor: "mas_actualizadas" },
    ] as const)("comunica $campo sin sustituir otros valores del borrador", async ({ etiqueta, opcion, campo, valor }) => {
        const { props } = preparar({ habilitado: false });
        await seleccionarOrden(etiqueta, opcion);
        expect(props.onChange).toHaveBeenCalledExactlyOnceWith({ [campo]: valor });
        expect(selector(etiquetaInicio)).toHaveTextContent("A-Z");
        expect(selector(etiquetaVirtual)).toHaveTextContent("Menor Precio");
        expect(selector(etiquetaProduccion)).toHaveTextContent("Mayor Precio");
        expect(props.configuracion).toEqual({ ...configuracion, habilitado: false });
    });

    it("refleja cambios y cancelaciones enviados por el panel", () => {
        const { props, rerender } = preparar();
        rerender(<TarjetaOrdenamientoPredeterminado {...props} configuracion={{ ...configuracion, ordenLanding: "nombre_desc", ordenMercadoVirtual: "mas_actualizadas", ordenMercadoProduccion: "mas_vendidas" }} />);
        expect(selector(etiquetaInicio)).toHaveTextContent("Z-A");
        expect(selector(etiquetaVirtual)).toHaveTextContent("Más actualizadas");
        expect(selector(etiquetaProduccion)).toHaveTextContent("Más vendidas");
        rerender(<TarjetaOrdenamientoPredeterminado {...props} />);
        expect(selector(etiquetaInicio)).toHaveTextContent("A-Z");
        expect(props.onChange).not.toHaveBeenCalled();
    });

    it("marca individualmente los campos pendientes y permite quitar la marca", () => {
        const { props, rerender } = preparar();
        rerender(<TarjetaOrdenamientoPredeterminado {...props} modificados={{ habilitado: true, ordenMercadoVirtual: true }} />);
        expect(screen.getByRole("switch", { name: "Permitir cambiar el orden" }).closest("[data-modificado]")).toHaveAttribute("data-modificado", "true");
        expect(selector(etiquetaInicio).closest("[data-modificado]")).toHaveAttribute("data-modificado", "false");
        expect(selector(etiquetaVirtual).closest("[data-modificado]")).toHaveAttribute("data-modificado", "true");
        expect(selector(etiquetaProduccion).closest("[data-modificado]")).toHaveAttribute("data-modificado", "false");
        rerender(<TarjetaOrdenamientoPredeterminado {...props} />);
        expect(selector(etiquetaVirtual).closest("[data-modificado]")).toHaveAttribute("data-modificado", "false");
    });

    it("presenta los errores del panel en campos pendientes", () => {
        const { props, rerender } = preparar();
        const marcas = { habilitado: true, ordenLanding: true };
        rerender(<TarjetaOrdenamientoPredeterminado {...props} modificados={marcas} errores={marcas} />);
        expect(selector(etiquetaInicio)).toHaveAttribute("aria-invalid", "true");
        expect(selector(etiquetaInicio).closest(".MuiOutlinedInput-root")).toHaveClass("Mui-error");
        expect(screen.getByRole("switch", { name: "Permitir cambiar el orden" })).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("switch", { name: "Permitir cambiar el orden" }).closest("[data-error]")).toHaveAttribute("data-error", "true");
    });

    it("deshabilita todos los controles durante el guardado global", () => {
        const { props, rerender } = preparar();
        rerender(<TarjetaOrdenamientoPredeterminado {...props} guardando />);
        expect(screen.getByRole("switch", { name: "Permitir cambiar el orden" })).toBeDisabled();
        for (const etiqueta of [etiquetaInicio, etiquetaVirtual, etiquetaProduccion]) expect(selector(etiqueta)).toHaveAttribute("aria-disabled", "true");
        rerender(<TarjetaOrdenamientoPredeterminado {...props} />);
        expect(screen.getByRole("switch", { name: "Permitir cambiar el orden" })).toBeEnabled();
        for (const etiqueta of [etiquetaInicio, etiquetaVirtual, etiquetaProduccion]) expect(selector(etiqueta)).not.toHaveAttribute("aria-disabled", "true");
    });
});
