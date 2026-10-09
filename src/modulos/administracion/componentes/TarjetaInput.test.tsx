
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";

import TarjetaInput from "./TarjetaInput";

interface PropsPrueba {
    valorInicial?: string;
    tipo?: "numero" | "url";
    onGuardarValor?: (valor: string) => Promise<void>;
    onEliminarValor?: () => Promise<void>;
}

function ComponentePrueba({valorInicial = "10", tipo = "numero", onGuardarValor = vi.fn().mockResolvedValue(undefined), onEliminarValor = vi.fn().mockResolvedValue(undefined)}: PropsPrueba) {
    const [valor, setValor] = useState(valorInicial);
    return (
        <TarjetaInput
            titulo="Configuración de prueba"
            descripcion="Descripción de prueba"
            tipo={tipo}
            valor={valor}
            onChangeValor={setValor}
            onGuardarValor={onGuardarValor}
            onEliminarValor={onEliminarValor}
        />
    );
}

describe("TarjetaInput", () => {
    it("muestra el título, la descripción y el valor inicial", () => {
        render(<ComponentePrueba />);
        expect(screen.getByText("Configuración de prueba")).toBeInTheDocument();
        expect(screen.getByText("Descripción de prueba")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toHaveValue("10");
    });

    it("mantiene el campo deshabilitado inicialmente", () => {
        render(<ComponentePrueba />);
        expect(screen.getByRole("textbox")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    });

    it("habilita el campo al presionar editar", () => {
        render(<ComponentePrueba />);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        expect(screen.getByRole("textbox")).toBeEnabled();
        expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    });

    it("permite modificar un valor numérico", () => {
        render(<ComponentePrueba />);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "25" }});
        expect(screen.getByRole("textbox")).toHaveValue("25");
    });

    it("impide introducir caracteres no numéricos cuando el tipo es numero", () => {
        render(<ComponentePrueba />);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "abc" }});
        expect(screen.getByRole("textbox")).toHaveValue("10");
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "12.5" }});
        expect(screen.getByRole("textbox")).toHaveValue("10");
    });

    it("permite ingresar una URL cuando el tipo es url", () => {
        render(<ComponentePrueba valorInicial="" tipo="url" />);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        const campo = screen.getByRole("textbox");
        fireEvent.change(campo, {target: { value: "https://uam.com.uy/lista.pdf" }});
        expect(campo).toHaveValue("https://uam.com.uy/lista.pdf");
        expect(campo).toHaveAttribute("type", "url");
    });

    it("guarda el nuevo valor al confirmar la edición", async () => {
        const onGuardarValor = vi.fn().mockResolvedValue(undefined);
        render(<ComponentePrueba onGuardarValor={onGuardarValor} />);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "20" }});
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => {
            expect(onGuardarValor).toHaveBeenCalledExactlyOnceWith("20");
            expect(screen.getByRole("textbox")).toBeDisabled();
        });
    });

    it("recupera el valor anterior al cancelar la edición", () => {
        render(<ComponentePrueba />);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "50" }});
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(screen.getByRole("textbox")).toHaveValue("10");
        expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("ejecuta la eliminación cuando se confirma", async () => {
        const onEliminarValor = vi.fn().mockResolvedValue(undefined);
        render(<ComponentePrueba onEliminarValor={onEliminarValor} />);
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        expect(
            screen.getByRole("button", { name: "Confirmar eliminación" })
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
        await waitFor(() => {
            expect(onEliminarValor).toHaveBeenCalledOnce();
            expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
        });
    });

    it("permite cancelar la eliminación sin modificar el valor", () => {
        const onEliminarValor = vi.fn();
        render(<ComponentePrueba onEliminarValor={onEliminarValor} />);
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(onEliminarValor).not.toHaveBeenCalled();
        expect(screen.getByRole("textbox")).toHaveValue("10");
    });

    it("descarta los cambios al hacer clic fuera del componente", async () => {
        render(
            <div>
                <ComponentePrueba />
                <button type="button">Fuera</button>
            </div>
        );
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "50" } });
        fireEvent.mouseDown(screen.getByRole("button", { name: "Fuera" }));
        await waitFor(() => {
            expect(screen.getByRole("textbox")).toHaveValue("10");
            expect(screen.getByRole("textbox")).toBeDisabled();
        });
    });

    it("deshabilita las acciones mientras se guarda", async () => {
        let resolverGuardado!: () => void;
        const onGuardarValor = vi.fn(() => new Promise<void>((resolve) => {resolverGuardado = resolve;}));
        render(<ComponentePrueba onGuardarValor={onGuardarValor} />);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "30" }});
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(screen.getByRole("textbox")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
        resolverGuardado();
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument()
        });
    });

    it("cancela la eliminación al hacer clic fuera del componente", async () => {
        const onEliminarValor = vi.fn();
        render(
            <div>
                <ComponentePrueba onEliminarValor={onEliminarValor} />
                <button type="button">Fuera</button>
            </div>
        );
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        fireEvent.mouseDown(screen.getByRole("button", { name: "Fuera" }));
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
            expect(onEliminarValor).not.toHaveBeenCalled();
        });
    });

    it("permite vaciar completamente un campo numérico", () => {
        render(<ComponentePrueba />);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "" }});
        expect(screen.getByRole("textbox")).toHaveValue("");
    });
});
