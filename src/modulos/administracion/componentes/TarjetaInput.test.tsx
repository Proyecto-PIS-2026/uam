import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";

import TarjetaInput from "./TarjetaInput";

interface PropsPrueba {
    valorInicial?: string;
    tipo?: "numero" | "url";
    onGuardarValor?: (valor: string) => Promise<void>;
}

function ComponentePrueba({
    valorInicial = "10",
    tipo = "numero",
    onGuardarValor = vi.fn().mockResolvedValue(undefined)
}: PropsPrueba) {
    const [valor, setValor] = useState(valorInicial);
    return (
        <TarjetaInput
            titulo="Configuración de prueba"
            descripcion="Descripción de prueba"
            tipo={tipo}
            valor={valor}
            onChangeValor={setValor}
            onGuardarValor={onGuardarValor}
        />
    );
}

describe("TarjetaInput", () => {
    it("muestra el título, la descripción y el valor inicial habilitado", () => {
        render(<ComponentePrueba />);
        expect(screen.getByText("Configuración de prueba")).toBeInTheDocument();
        expect(screen.getByText("Descripción de prueba")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeEnabled();
        expect(screen.getByRole("textbox")).toHaveValue("10");
    });

    it("mantiene el botón de guardar deshabilitado cuando no hay cambios", () => {
        render(<ComponentePrueba />);
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    });

    it("habilita el botón de guardar cuando se modifica el texto", () => {
        render(<ComponentePrueba />);
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "25" } });
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    });

    it("guarda el nuevo valor al hacer clic en el tick, muestra alerta de éxito y luego lo deshabilita", async () => {
        const onGuardarValor = vi.fn().mockResolvedValue(undefined);
        render(<ComponentePrueba onGuardarValor={onGuardarValor} />);
        
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "20" } });
        const botonGuardar = screen.getByRole("button", { name: "Guardar cambios" });
        
        fireEvent.click(botonGuardar);

        await waitFor(() => {
            expect(onGuardarValor).toHaveBeenCalledExactlyOnceWith("20");
            expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
            expect(screen.getByText("La configuración se guardó correctamente.")).toBeInTheDocument();
        });
    });

    it("muestra alerta de error cuando ocurre un fallo al guardar", async () => {
        const onGuardarValor = vi.fn().mockRejectedValue(new Error("Error al guardar en BD"));
        render(<ComponentePrueba onGuardarValor={onGuardarValor} />);
        
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "20" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await waitFor(() => {
            expect(screen.getByText("Error al guardar en BD")).toBeInTheDocument();
        });
    });

    it("deshabilita los controles mientras se guardan los cambios", async () => {
        let resolverGuardado!: () => void;
        const onGuardarValor = vi.fn(() => new Promise<void>((resolve) => { resolverGuardado = resolve; }));
        render(<ComponentePrueba onGuardarValor={onGuardarValor} />);
        
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "30" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        
        expect(screen.getByRole("textbox")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
        
        resolverGuardado();
        await waitFor(() => {
            expect(screen.getByRole("textbox")).toBeEnabled();
        });
    });
});