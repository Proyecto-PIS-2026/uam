import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TarjetaConfiguracionSwitch from "./TarjetaConfiguracionSwitch";

function preparar(habilitado = true) {
    const props = {
        titulo: "Restablecimiento de contraseñas",
        descripcion: "Configurá si los usuarios pueden solicitar el restablecimiento de su contraseña.",
        etiqueta: "Permitir solicitar el restablecimiento de contraseña",
        habilitado,
        onChange: vi.fn(),
    };
    return { ...render(<TarjetaConfiguracionSwitch {...props} />), props };
}

function obtenerSwitch() {
    return screen.getByRole("switch", { name: "Permitir solicitar el restablecimiento de contraseña" });
}

afterEach(cleanup);

describe("TarjetaConfiguracionSwitch", () => {
    it("muestra los textos sin formulario ni guardado propio", () => {
        const { container } = preparar();
        expect(screen.getByText("Restablecimiento de contraseñas")).toBeInTheDocument();
        expect(screen.getByText("Configurá si los usuarios pueden solicitar el restablecimiento de su contraseña.")).toBeInTheDocument();
        expect(screen.getByText("Permitir solicitar el restablecimiento de contraseña")).toBeInTheDocument();
        expect(container.querySelector("form")).toBeNull();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it.each([true, false])("muestra el estado recibido %s", (habilitado) => {
        preparar(habilitado);
        expect(obtenerSwitch()).toHaveProperty("checked", habilitado);
        expect(obtenerSwitch().closest("[data-modificado]")).toHaveAttribute("data-modificado", "false");
    });

    it.each([true, false])("delega al padre el cambio desde %s", (habilitado) => {
        const { props, rerender } = preparar(habilitado);
        fireEvent.click(obtenerSwitch());
        expect(props.onChange).toHaveBeenCalledExactlyOnceWith(!habilitado);
        expect(obtenerSwitch()).toHaveProperty("checked", habilitado);
        rerender(<TarjetaConfiguracionSwitch {...props} habilitado={!habilitado} modificado />);
        expect(obtenerSwitch()).toHaveProperty("checked", !habilitado);
        expect(obtenerSwitch().closest("[data-modificado]")).toHaveAttribute("data-modificado", "true");
    });

    it("restaura el switch y su marca pendiente cuando el padre cancela", () => {
        const { props, rerender } = preparar();
        rerender(<TarjetaConfiguracionSwitch {...props} habilitado={false} modificado />);
        expect(obtenerSwitch()).not.toBeChecked();
        rerender(<TarjetaConfiguracionSwitch {...props} />);
        expect(obtenerSwitch()).toBeChecked();
        expect(obtenerSwitch().closest("[data-modificado]")).toHaveAttribute("data-modificado", "false");
    });

    it("bloquea el switch mientras el padre guarda", () => {
        const { props, rerender } = preparar();
        rerender(<TarjetaConfiguracionSwitch {...props} guardando />);
        expect(obtenerSwitch()).toBeDisabled();
        rerender(<TarjetaConfiguracionSwitch {...props} />);
        expect(obtenerSwitch()).toBeEnabled();
    });
});
