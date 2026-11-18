import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TarjetaInput from "./TarjetaInput";

const props = { titulo: "Configuración de prueba", descripcion: "Descripción de prueba", valor: "10", onChangeValor: vi.fn() };

function ComponentePrueba({ tipo = "numero", valorInicial = "10" }: { tipo?: "numero" | "url"; valorInicial?: string }) {
    const [valor, setValor] = useState(valorInicial);
    return <TarjetaInput {...props} valor={valor} tipo={tipo} onChangeValor={setValor} modificado={valor !== valorInicial} />;
}

function campo() {
    return screen.getByRole("textbox", { name: "Configuración de prueba" });
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("TarjetaInput", () => {
    it("muestra el título, la descripción y el valor sin formulario ni guardado propio", () => {
        const { container } = render(<TarjetaInput {...props} />);
        expect(screen.getByText("Configuración de prueba")).toBeInTheDocument();
        expect(screen.getByText("Descripción de prueba")).toBeInTheDocument();
        expect(campo()).toHaveValue("10");
        expect(campo()).toHaveAccessibleDescription("Descripción de prueba");
        expect(campo()).toBeRequired();
        expect(container.querySelector("form")).toBeNull();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("usa la etiqueta del campo cuando se proporciona", () => {
        render(<TarjetaInput {...props} label="Importe" />);
        expect(screen.getByRole("textbox", { name: "Importe" })).toHaveValue("10");
    });

    it("usa modo numérico por defecto y permite el valor vacío recibido", () => {
        render(<TarjetaInput {...props} valor="" />);
        expect(campo()).toHaveValue("");
        expect(campo()).toHaveAttribute("type", "text");
        expect(campo()).toHaveAttribute("inputmode", "numeric");
        expect(campo()).toHaveAttribute("pattern", "[0-9]*");
    });

    it("notifica la edición al padre y refleja el valor controlado", () => {
        const { rerender } = render(<TarjetaInput {...props} />);
        fireEvent.change(campo(), { target: { value: "25" } });
        expect(props.onChangeValor).toHaveBeenCalledExactlyOnceWith("25");
        expect(campo()).toHaveValue("10");
        rerender(<TarjetaInput {...props} valor="25" modificado />);
        expect(campo()).toHaveValue("25");
        expect(campo().closest("[data-modificado]")).toHaveAttribute("data-modificado", "true");
    });

    it("retira la marca pendiente al restaurar el valor original desde el padre", () => {
        render(<ComponentePrueba />);
        fireEvent.change(campo(), { target: { value: "25" } });
        expect(campo().closest("[data-modificado]")).toHaveAttribute("data-modificado", "true");
        fireEvent.change(campo(), { target: { value: "10" } });
        expect(campo().closest("[data-modificado]")).toHaveAttribute("data-modificado", "false");
    });

    it.each(["abc", "-1", "1.5", " 2", "1e2"])("rechaza la entrada numérica %j", (valor) => {
        render(<TarjetaInput {...props} />);
        fireEvent.change(campo(), { target: { value: valor } });
        expect(campo()).toHaveValue("10");
        expect(props.onChangeValor).not.toHaveBeenCalled();
    });

    it.each(["", "0", "00", "9007199254740992"])("delega al padre la validación del borrador numérico %j", (valor) => {
        render(<TarjetaInput {...props} />);
        fireEvent.change(campo(), { target: { value: valor } });
        expect(props.onChangeValor).toHaveBeenCalledExactlyOnceWith(valor);
    });

    it("configura el campo para URL y permite escribir una dirección", () => {
        render(<ComponentePrueba tipo="url" valorInicial="" />);
        expect(campo()).toHaveAttribute("type", "url");
        expect(campo()).toHaveAttribute("inputmode", "url");
        expect(campo()).not.toHaveAttribute("pattern");
        fireEvent.change(campo(), { target: { value: "https://uam.com.uy/lista.pdf" } });
        expect(campo()).toHaveValue("https://uam.com.uy/lista.pdf");
    });

    it("bloquea el campo durante el guardado global y muestra el error recibido", () => {
        const { rerender } = render(<TarjetaInput {...props} guardando modificado error />);
        expect(campo()).toBeDisabled();
        expect(campo()).toHaveAttribute("aria-invalid", "true");
        rerender(<TarjetaInput {...props} />);
        expect(campo()).toBeEnabled();
        expect(campo()).not.toHaveAttribute("aria-invalid", "true");
        expect(campo().closest("[data-modificado]")).toHaveAttribute("data-modificado", "false");
    });
});
