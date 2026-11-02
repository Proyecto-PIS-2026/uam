import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TarjetaRestablecimientoContraseña from "./TarjetaRestablecimientoContraseña";

const mocks = vi.hoisted(() => ({
    notificar: vi.fn(),
}));

vi.mock("@/compartido/componentes/NotificacionToast", () => ({
    useNotificacionToast: () => ({ notificar: mocks.notificar }),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(cleanup);

function preparar(habilitado = true, onGuardar = vi.fn().mockResolvedValue(undefined)) {
    const props = {
        titulo: "Restablecimiento de contraseñas",
        descripcion: "Configurá si los usuarios pueden solicitar el restablecimiento de su contraseña.",
        etiqueta: "Permitir solicitar el restablecimiento de contraseña",
        habilitado,
        onGuardar,
    };

    return { ...render(<TarjetaRestablecimientoContraseña {...props} />), props, onGuardar };
}

function obtenerSwitch() {
    return screen.getByRole("switch", { name: "Permitir solicitar el restablecimiento de contraseña" });
}

function botonGuardar() {
    return screen.getByRole("button", { name: "Guardar configuración: Restablecimiento de contraseñas" });
}

describe("TarjetaRestablecimientoContraseña", () => {
    it("muestra el título, la descripción y la etiqueta", () => {
        preparar();
        expect(screen.getByText("Restablecimiento de contraseñas")).toBeInTheDocument();
        expect(screen.getByText("Configurá si los usuarios pueden solicitar el restablecimiento de su contraseña.")).toBeInTheDocument();
        expect(screen.getByText("Permitir solicitar el restablecimiento de contraseña")).toBeInTheDocument();
    });

    it.each([true, false])("muestra el estado inicial %s sin cambios pendientes", (habilitado) => {
        preparar(habilitado);
        expect(obtenerSwitch()).toHaveProperty("checked", habilitado);
        expect(botonGuardar()).toBeDisabled();
    });

    it("habilita guardar al cambiar el switch y no guarda automáticamente", () => {
        const { onGuardar } = preparar(false);
        fireEvent.click(obtenerSwitch());
        expect(obtenerSwitch()).toBeChecked();
        expect(botonGuardar()).toBeEnabled();
        expect(onGuardar).not.toHaveBeenCalled();
    });

    it("deshabilita guardar cuando se restaura el valor original", () => {
        preparar();
        fireEvent.click(obtenerSwitch());
        expect(botonGuardar()).toBeEnabled();
        fireEvent.click(obtenerSwitch());
        expect(obtenerSwitch()).toBeChecked();
        expect(botonGuardar()).toBeDisabled();
    });

    it.each([true, false])("guarda el cambio desde el estado inicial %s", async (habilitado) => {
        const { onGuardar } = preparar(habilitado);
        fireEvent.click(obtenerSwitch());
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(onGuardar).toHaveBeenCalledExactlyOnceWith(!habilitado));
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("La configuración de restablecimiento de contraseña se guardó correctamente.", "success"));
        expect(obtenerSwitch()).toHaveProperty("checked", !habilitado);
        expect(botonGuardar()).toBeDisabled();
    });

    it("considera el último valor guardado como referencia para nuevas modificaciones", async () => {
        preparar(true);
        fireEvent.click(obtenerSwitch());
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("La configuración de restablecimiento de contraseña se guardó correctamente.", "success"));
        expect(botonGuardar()).toBeDisabled();
        fireEvent.click(obtenerSwitch());
        expect(obtenerSwitch()).toBeChecked();
        expect(botonGuardar()).toBeEnabled();
        fireEvent.click(obtenerSwitch());
        expect(obtenerSwitch()).not.toBeChecked();
        expect(botonGuardar()).toBeDisabled();
    });

    it("bloquea los controles mientras guarda y evita envíos repetidos", async () => {
        let finalizar!: () => void;
        const onGuardar = vi.fn(() => new Promise<void>((resolve) => { finalizar = resolve }));
        preparar(true, onGuardar);
        fireEvent.click(obtenerSwitch());
        fireEvent.click(botonGuardar());
        expect(obtenerSwitch()).toBeDisabled();
        expect(botonGuardar()).toBeDisabled();
        fireEvent.click(botonGuardar());
        expect(onGuardar).toHaveBeenCalledOnce();
        await act(async () => { finalizar() });
        expect(obtenerSwitch()).toBeEnabled();
        expect(botonGuardar()).toBeDisabled();
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("La configuración de restablecimiento de contraseña se guardó correctamente.", "success"));
    });

    it("muestra el error y conserva el cambio si falla el guardado", async () => {
        const onGuardar = vi.fn().mockRejectedValue(new Error("No se pudo conectar con el servidor"));
        preparar(true, onGuardar);
        fireEvent.click(obtenerSwitch());
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("No se pudo conectar con el servidor", "error"));
        expect(obtenerSwitch()).not.toBeChecked();
        await waitFor(() => expect(botonGuardar()).toBeEnabled());
        expect(obtenerSwitch()).toBeEnabled();
    });

    it("permite reintentar después de un error", async () => {
        const onGuardar = vi.fn().mockRejectedValueOnce(new Error("Error temporal")).mockResolvedValueOnce(undefined);
        preparar(true, onGuardar);
        fireEvent.click(obtenerSwitch());
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("Error temporal", "error"));
        await waitFor(() => expect(botonGuardar()).toBeEnabled());
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("La configuración de restablecimiento de contraseña se guardó correctamente.", "success"));
        expect(onGuardar).toHaveBeenCalledTimes(2);
        expect(onGuardar).toHaveBeenNthCalledWith(1, false);
        expect(onGuardar).toHaveBeenNthCalledWith(2, false);
        expect(botonGuardar()).toBeDisabled();
    });

    it("muestra un mensaje genérico si el rechazo no es un Error", async () => {
        preparar(true, vi.fn().mockRejectedValue("fallo"));
        fireEvent.click(obtenerSwitch());
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("No se pudo guardar la configuración.", "error"));
        await waitFor(() => expect(botonGuardar()).toBeEnabled());
    });

    it.each([true, false])("sincroniza el switch si el servidor cambia el estado inicial %s", (habilitado) => {
        const { rerender, props } = preparar(habilitado);
        rerender(<TarjetaRestablecimientoContraseña {...props} habilitado={!habilitado} />);
        expect(obtenerSwitch()).toHaveProperty("checked", !habilitado);
        expect(botonGuardar()).toBeDisabled();
    });

    it("conserva el cambio local si las props mantienen el mismo valor", () => {
        const { rerender, props } = preparar(true);
        fireEvent.click(obtenerSwitch());
        rerender(<TarjetaRestablecimientoContraseña {...props} />);
        expect(obtenerSwitch()).not.toBeChecked();
        expect(botonGuardar()).toBeEnabled();
    });

    it("no ejecuta el guardado al pulsar el botón sin cambios", () => {
        const { onGuardar } = preparar();
        fireEvent.click(botonGuardar());
        expect(onGuardar).not.toHaveBeenCalled();
    });
});