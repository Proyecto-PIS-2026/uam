import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TarjetaInput from "./TarjetaInput";

const mocks = vi.hoisted(() => ({
    notificar: vi.fn(),
}));

vi.mock("@/compartido/componentes/NotificacionToast", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/compartido/componentes/NotificacionToast")>(),
    useNotificacionToast: () => ({ notificar: mocks.notificar }),
}));

interface PropsPrueba {
    valorInicial?: string;
    tipo?: "numero" | "url";
    label?: string;
    mensajeExito?: string;
    onGuardarValor?: (valor: string) => Promise<void>;
}

function ComponentePrueba({ valorInicial = "10", tipo = "numero", label, onGuardarValor, mensajeExito }: PropsPrueba) {
    const [valor, setValor] = useState(valorInicial);
    return <TarjetaInput titulo="Configuración de prueba" descripcion="Descripción de prueba" label={label} valor={valor} tipo={tipo} onChangeValor={setValor} onGuardarValor={onGuardarValor} mensajeExito={mensajeExito} />;
}

function campo() {
    return screen.getByRole("textbox", { name: "Configuración de prueba" });
}

function botonGuardar() {
    return screen.getByRole("button", { name: "Guardar cambios" });
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(cleanup);

describe("TarjetaInput", () => {
    it("muestra el título, la descripción y el valor inicial", () => {
        render(<ComponentePrueba />);
        expect(screen.getByText("Configuración de prueba")).toBeInTheDocument();
        expect(screen.getByText("Descripción de prueba")).toBeInTheDocument();
        expect(campo()).toHaveValue("10");
        expect(campo()).toHaveAccessibleDescription("Descripción de prueba");
        expect(botonGuardar()).toBeDisabled();
    });

    it("usa la etiqueta del campo cuando se proporciona", () => {
        render(<ComponentePrueba label="Importe" />);
        expect(screen.getByRole("textbox", { name: "Importe" })).toHaveValue("10");
    });

    it("usa valor vacío y modo numérico por defecto", () => {
        render(<TarjetaInput titulo="Configuración de prueba" descripcion="Descripción de prueba" />);
        expect(campo()).toHaveValue("");
        expect(campo()).toHaveAttribute("type", "text");
        expect(campo()).toHaveAttribute("inputmode", "numeric");
        expect(campo()).toHaveAttribute("pattern", "[0-9]*");
        expect(botonGuardar()).toBeDisabled();
    });

    it("habilita guardar al editar y no guarda automáticamente", () => {
        const onGuardarValor = vi.fn().mockResolvedValue(undefined);
        render(<ComponentePrueba onGuardarValor={onGuardarValor} />);
        fireEvent.change(campo(), { target: { value: "25" } });
        expect(campo()).toHaveValue("25");
        expect(botonGuardar()).toBeEnabled();
        expect(onGuardarValor).not.toHaveBeenCalled();
    });

    it("deshabilita guardar al restaurar el valor original", () => {
        render(<ComponentePrueba />);
        fireEvent.change(campo(), { target: { value: "25" } });
        expect(botonGuardar()).toBeEnabled();
        fireEvent.change(campo(), { target: { value: "10" } });
        expect(botonGuardar()).toBeDisabled();
    });

    it.each(["abc", "-1", "1.5", " 2", "1e2"])("rechaza la entrada numérica %j", (valor) => {
        render(<ComponentePrueba />);
        fireEvent.change(campo(), { target: { value: valor } });
        expect(campo()).toHaveValue("10");
        expect(botonGuardar()).toBeDisabled();
    });

    it("permite vaciar el campo para editarlo", () => {
        render(<ComponentePrueba />);
        fireEvent.change(campo(), { target: { value: "" } });
        expect(campo()).toHaveValue("");
        expect(botonGuardar()).toBeEnabled();
    });

    it.each(["0", "00", "9007199254740992"])("no guarda el importe inválido %j", (valor) => {
        const onGuardarValor = vi.fn();
        render(<ComponentePrueba onGuardarValor={onGuardarValor} />);
        fireEvent.change(campo(), { target: { value: valor } });
        fireEvent.click(botonGuardar());
        expect(onGuardarValor).not.toHaveBeenCalled();
        expect(mocks.notificar).toHaveBeenCalledWith("El importe debe ser un número entero positivo.", "error");
    });

    it("configura el campo para URL y permite escribir una dirección", () => {
        render(<ComponentePrueba tipo="url" valorInicial="" />);
        expect(campo()).toHaveAttribute("type", "url");
        expect(campo()).toHaveAttribute("inputmode", "url");
        expect(campo()).not.toHaveAttribute("pattern");
        fireEvent.change(campo(), { target: { value: "https://uam.com.uy/lista.pdf" } });
        expect(campo()).toHaveValue("https://uam.com.uy/lista.pdf");
        expect(botonGuardar()).toBeEnabled();
    });

    it.each(["", "   ", "\t"])("no guarda una URL vacía %j y conserva la referencia guardada", async (valor) => {
        const onGuardarValor = vi.fn();
        const urlGuardada = "https://uam.com.uy/lista.pdf";
        render(<ComponentePrueba tipo="url" valorInicial={urlGuardada} onGuardarValor={onGuardarValor} />);
        fireEvent.change(campo(), { target: { value: valor } });
        fireEvent.click(botonGuardar());
        expect(onGuardarValor).not.toHaveBeenCalled();
        expect(await screen.findByRole("alert")).toHaveTextContent("Faltan completar campos obligatorios.");
        expect(campo()).toHaveAttribute("aria-invalid", "true");
        fireEvent.change(campo(), { target: { value: urlGuardada } });
        expect(campo()).not.toHaveAttribute("aria-invalid", "true");
        expect(botonGuardar()).toBeDisabled();
    });

    it("marca el importe vacío y solicita completar los campos sin guardar", async () => {
        const onGuardarValor = vi.fn();
        render(<ComponentePrueba onGuardarValor={onGuardarValor} />);
        fireEvent.change(campo(), { target: { value: "" } });
        fireEvent.click(botonGuardar());
        expect(await screen.findByRole("alert")).toHaveTextContent("Faltan completar campos obligatorios.");
        expect(campo()).toHaveAttribute("aria-invalid", "true");
        expect(onGuardarValor).not.toHaveBeenCalled();
    });

    it("guarda el valor editado y notifica el resultado", async () => {
        const onGuardarValor = vi.fn().mockResolvedValue(undefined);
        render(<ComponentePrueba onGuardarValor={onGuardarValor} />);
        fireEvent.change(campo(), { target: { value: "25" } });
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(onGuardarValor).toHaveBeenCalledExactlyOnceWith("25"));
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("", "success"));        
        expect(botonGuardar()).toBeDisabled();
    });

    it("usa el último valor guardado como referencia para nuevas ediciones", async () => {
        render(<ComponentePrueba onGuardarValor={vi.fn().mockResolvedValue(undefined)} />);
        fireEvent.change(campo(), { target: { value: "25" } });
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(botonGuardar()).toBeDisabled());
        fireEvent.change(campo(), { target: { value: "10" } });
        expect(botonGuardar()).toBeEnabled();
        fireEvent.change(campo(), { target: { value: "25" } });
        expect(botonGuardar()).toBeDisabled();
    });

    it("bloquea el campo y el check durante el guardado", async () => {
        let finalizar!: () => void;
        const onGuardarValor = vi.fn(() => new Promise<void>((resolve) => { finalizar = resolve }));
        render(<ComponentePrueba onGuardarValor={onGuardarValor} />);
        fireEvent.change(campo(), { target: { value: "25" } });
        fireEvent.click(botonGuardar());
        expect(campo()).toBeDisabled();
        expect(botonGuardar()).toBeDisabled();
        fireEvent.click(botonGuardar());
        expect(onGuardarValor).toHaveBeenCalledOnce();
        await act(async () => { finalizar() });
        expect(campo()).toBeEnabled();
        expect(botonGuardar()).toBeDisabled();
    });

    it("conserva la edición y permite reintentar cuando falla", async () => {
        const onGuardarValor = vi.fn().mockRejectedValueOnce(new Error("Error temporal")).mockResolvedValueOnce(undefined);
        render(<ComponentePrueba onGuardarValor={onGuardarValor} />);

        fireEvent.change(campo(), { target: { value: "25" } });
        fireEvent.click(botonGuardar());

        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("Error temporal", "error"));
        expect(campo()).toHaveValue("25");
        expect(campo()).toBeEnabled();
        expect(botonGuardar()).toBeEnabled();
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("", "success"));
        expect(onGuardarValor).toHaveBeenCalledTimes(2);
        expect(botonGuardar()).toBeDisabled();
    });

    it("notifica un error genérico cuando el rechazo no es un Error", async () => {
        render(<ComponentePrueba onGuardarValor={vi.fn().mockRejectedValue("fallo")} />);
        fireEvent.change(campo(), { target: { value: "25" } });
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("Ocurrió un error al guardar la configuración.", "error"));
        expect(botonGuardar()).toBeEnabled();
    });

    it("no guarda si no existen cambios", () => {
        const onGuardarValor = vi.fn();
        render(<ComponentePrueba onGuardarValor={onGuardarValor} />);
        fireEvent.click(botonGuardar());
        expect(onGuardarValor).not.toHaveBeenCalled();
    });

    it("permite renderizar el campo sin callback de edición", () => {
        render(<TarjetaInput titulo="Configuración de prueba" descripcion="Descripción de prueba" valor="10" />);
        fireEvent.change(campo(), { target: { value: "25" } });
        expect(campo()).toHaveValue("10");
        expect(botonGuardar()).toBeDisabled();
    });

    it.each([{ tipo: "url", valor: "https://uam.com.uy/lista.pdf", mensaje: "La URL de la Lista Inteligente se guardó correctamente." }, { tipo: "numero", valor: "25", mensaje: "El importe de ajuste rápido de precios se guardó correctamente." }] as const)("muestra el mensaje personalizado para el campo $tipo", async ({ tipo, valor, mensaje }) => {
        const onGuardarValor = vi.fn().mockResolvedValue(undefined);
        render(<ComponentePrueba tipo={tipo} valorInicial="" onGuardarValor={onGuardarValor} mensajeExito={mensaje} />);
        fireEvent.change(campo(), { target: { value: valor } });
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledExactlyOnceWith(mensaje, "success"));
        expect(onGuardarValor).toHaveBeenCalledExactlyOnceWith(valor);
        expect(botonGuardar()).toBeDisabled();
    });
});
