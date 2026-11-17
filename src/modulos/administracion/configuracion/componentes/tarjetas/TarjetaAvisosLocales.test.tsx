import { cleanup, fireEvent, render, screen, waitFor } from "@/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import TarjetaAvisosLocales, { type ConfiguracionAvisosLocalesFormulario } from "./TarjetaAvisosLocales";

afterEach(cleanup);

const configuracion: ConfiguracionAvisosLocalesFormulario = { habilitado: true, diasAnticipacion: "7" };
const etiquetaDias = /^Días de anticipación del aviso de locales/;
const etiquetaSwitch = "Habilitar avisos de vencimiento de locales";

function preparar(cambios: Partial<ConfiguracionAvisosLocalesFormulario> = {}) {
    const props = { configuracion: { ...configuracion, ...cambios }, onChange: vi.fn() };
    return { ...render(<TarjetaAvisosLocales {...props} />), props };
}

describe("TarjetaAvisosLocales controlada", () => {
    it("muestra la configuración sin botones ni formularios de guardado", () => {
        const { container } = preparar();
        expect(screen.getByText("Avisos de vencimiento de locales")).toBeInTheDocument();
        expect(screen.getByText("Configurá los avisos para todos los administradores sobre contratos de locales próximos a vencer o vencidos.")).toBeInTheDocument();
        expect(screen.getByRole("switch", { name: etiquetaSwitch })).toBeChecked();
        expect(screen.getByLabelText(etiquetaDias)).toHaveValue("7");
        expect(container.querySelector("form")).toBeNull();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("comunica el cambio del switch sin modificar el plazo", () => {
        const { props } = preparar();
        fireEvent.click(screen.getByRole("switch", { name: etiquetaSwitch }));
        expect(props.onChange).toHaveBeenCalledExactlyOnceWith({ habilitado: false });
        expect(props.configuracion).toEqual(configuracion);
        expect(screen.getByLabelText(etiquetaDias)).toHaveValue("7");
    });

    it.each(["", "0", "014", "366", "9007199254740992"])("envía el borrador %j sin validación ni normalización local", (valor) => {
        const { props } = preparar();
        fireEvent.change(screen.getByLabelText(etiquetaDias), { target: { value: valor } });
        expect(props.onChange).toHaveBeenCalledExactlyOnceWith({ diasAnticipacion: valor });
        expect(screen.getByLabelText(etiquetaDias)).toHaveValue("7");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it.each(["abc", "-1", "1.5", " 2", "1e2"])("ignora caracteres no numéricos: %j", (valor) => {
        const { props } = preparar();
        fireEvent.change(screen.getByLabelText(etiquetaDias), { target: { value: valor } });
        expect(props.onChange).not.toHaveBeenCalled();
    });

    it("oculta y recupera el plazo mediante Collapse sin perder el borrador recibido", async () => {
        const { props, rerender } = preparar({ diasAnticipacion: "014" });
        const entrada = screen.getByLabelText(etiquetaDias);
        rerender(<TarjetaAvisosLocales {...props} configuracion={{ ...props.configuracion, habilitado: false }} />);
        expect(entrada.closest(".MuiCollapse-root")).toHaveStyle({ transitionDuration: "300ms" });
        await waitFor(() => expect(entrada).not.toBeVisible());
        expect(entrada).toHaveValue("014");
        rerender(<TarjetaAvisosLocales {...props} />);
        await waitFor(() => expect(entrada).toBeVisible());
        expect(entrada).toHaveValue("014");
        expect(props.onChange).not.toHaveBeenCalled();
    });

    it("comienza con el plazo oculto cuando los avisos están apagados", () => {
        preparar({ habilitado: false, diasAnticipacion: "9" });
        expect(screen.getByLabelText(etiquetaDias)).not.toBeVisible();
        expect(screen.getByLabelText(etiquetaDias)).toHaveValue("9");
    });

    it("marca por separado el switch y los días pendientes", () => {
        const { props, rerender } = preparar();
        rerender(<TarjetaAvisosLocales {...props} modificados={{ diasAnticipacion: true }} />);
        expect(screen.getByLabelText(etiquetaDias).closest("[data-modificado]")).toHaveAttribute("data-modificado", "true");
        expect(screen.getByRole("switch", { name: etiquetaSwitch }).closest("[data-modificado]")).toHaveAttribute("data-modificado", "false");
        rerender(<TarjetaAvisosLocales {...props} modificados={{ habilitado: true }} />);
        expect(screen.getByLabelText(etiquetaDias).closest("[data-modificado]")).toHaveAttribute("data-modificado", "false");
        expect(screen.getByRole("switch", { name: etiquetaSwitch }).closest("[data-modificado]")).toHaveAttribute("data-modificado", "true");
    });

    it("aplica los errores recibidos aunque los campos estén modificados", () => {
        const { props, rerender } = preparar();
        const marcas = { habilitado: true, diasAnticipacion: true };
        rerender(<TarjetaAvisosLocales {...props} modificados={marcas} errores={marcas} />);
        expect(screen.getByLabelText(etiquetaDias)).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByLabelText(etiquetaDias).closest(".MuiOutlinedInput-root")).toHaveClass("Mui-error");
        expect(screen.getByRole("switch", { name: etiquetaSwitch })).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("switch", { name: etiquetaSwitch }).closest("[data-error]")).toHaveAttribute("data-error", "true");
        rerender(<TarjetaAvisosLocales {...props} />);
        expect(screen.getByLabelText(etiquetaDias)).not.toHaveAttribute("aria-invalid", "true");
    });

    it("refleja una cancelación del panel y bloquea la edición durante el guardado global", () => {
        const { props, rerender } = preparar();
        rerender(<TarjetaAvisosLocales {...props} configuracion={{ habilitado: true, diasAnticipacion: "14" }} guardando />);
        expect(screen.getByLabelText(etiquetaDias)).toHaveValue("14");
        expect(screen.getByLabelText(etiquetaDias)).toBeDisabled();
        expect(screen.getByRole("switch", { name: etiquetaSwitch })).toBeDisabled();
        rerender(<TarjetaAvisosLocales {...props} />);
        expect(screen.getByLabelText(etiquetaDias)).toHaveValue("7");
        expect(screen.getByLabelText(etiquetaDias)).toBeEnabled();
        expect(screen.getByRole("switch", { name: etiquetaSwitch })).toBeEnabled();
    });

    it("revela un plazo inválido con avisos apagados y permite corregirlo sin cerrarlo hasta cancelar", async () => {
        const { props, rerender } = preparar({ habilitado: false });
        const entrada = screen.getByLabelText(etiquetaDias);
        const modificados = { diasAnticipacion: true };
        expect(entrada).not.toBeVisible();
        rerender(<TarjetaAvisosLocales {...props} configuracion={{ ...props.configuracion, diasAnticipacion: "366" }} modificados={modificados} errores={modificados} />);
        await waitFor(() => {
            expect(entrada).toBeVisible();
            expect(entrada.closest(".MuiCollapse-root")).toHaveClass("MuiCollapse-entered");
        });
        expect(entrada).toBeEnabled();
        fireEvent.change(entrada, { target: { value: "14" } });
        expect(props.onChange).toHaveBeenCalledExactlyOnceWith({ diasAnticipacion: "14" });
        rerender(<TarjetaAvisosLocales {...props} configuracion={{ ...props.configuracion, diasAnticipacion: "14" }} modificados={modificados} />);
        expect(entrada).toBeVisible();
        expect(entrada).toBeEnabled();
        expect(entrada.closest(".MuiCollapse-root")).toHaveClass("MuiCollapse-entered");
        expect(entrada).not.toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("switch", { name: etiquetaSwitch })).not.toBeChecked();
        rerender(<TarjetaAvisosLocales {...props} />);
        await waitFor(() => expect(entrada).not.toBeVisible());
        expect(entrada).toBeDisabled();
        expect(entrada).toHaveValue("7");
        expect(props.onChange).toHaveBeenCalledTimes(1);
    });
});
