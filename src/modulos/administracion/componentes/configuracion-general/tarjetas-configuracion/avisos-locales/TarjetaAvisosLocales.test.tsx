import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TarjetaAvisosLocales, { type ConfiguracionAvisosLocalesFormulario } from "./TarjetaAvisosLocales";

const mocks = vi.hoisted(() => ({ notificar: vi.fn() }));

vi.mock("@/compartido/componentes/NotificacionToast", () => ({
    useNotificacionToast: () => ({ notificar: mocks.notificar }),
}));

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

function preparar(configuracion: ConfiguracionAvisosLocalesFormulario = { habilitado: true, diasAnticipacion: "9" }, onGuardar = vi.fn().mockResolvedValue(undefined)) {
    return { ...render(<TarjetaAvisosLocales configuracion={configuracion} onGuardar={onGuardar} />), configuracion, onGuardar };
}

const interruptor = () => screen.getByRole("switch", { name: "Habilitar avisos de vencimiento de locales" });
const dias = () => screen.getByRole("textbox", { name: "Días de anticipación del aviso de locales" });
const guardar = () => screen.getByRole("button", { name: "Guardar configuración: Avisos de vencimiento de locales" });
const exito = () => expect(mocks.notificar).toHaveBeenCalledWith("La configuración de avisos de locales se guardó correctamente.", "success");

describe("TarjetaAvisosLocales", () => {
    it("permite desactivar y reactivar los avisos conservando el plazo guardado", async () => {
        const { onGuardar } = preparar();
        expect(guardar()).toBeDisabled();
        fireEvent.click(interruptor());
        expect(dias()).toBeDisabled();
        expect(dias()).toHaveValue("9");
        expect(onGuardar).not.toHaveBeenCalled();
        fireEvent.click(guardar());
        await waitFor(exito);
        expect(onGuardar).toHaveBeenCalledExactlyOnceWith({ habilitado: false, diasAnticipacion: "9" });
        expect(guardar()).toBeDisabled();
        fireEvent.click(interruptor());
        expect(dias()).toBeEnabled();
        expect(dias()).toHaveValue("9");
        fireEvent.click(guardar());
        await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(guardar()).toBeDisabled());
        expect(onGuardar).toHaveBeenLastCalledWith({ habilitado: true, diasAnticipacion: "9" });
    });

    it.each(["0", "365"])("admite %s días y guarda el plazo junto al estado", async (plazo) => {
        const { onGuardar } = preparar();
        fireEvent.change(dias(), { target: { value: plazo } });
        fireEvent.click(guardar());
        await waitFor(exito);
        expect(onGuardar).toHaveBeenCalledExactlyOnceWith({ habilitado: true, diasAnticipacion: plazo });
        expect(guardar()).toBeDisabled();
    });

    it.each([
        { plazo: "", mensaje: "Faltan completar campos." },
        { plazo: "366", mensaje: "La anticipación de los avisos de locales debe ser un entero entre 0 y 365 días." },
    ])("rechaza el plazo '$plazo' cuando los avisos están habilitados", ({ plazo, mensaje }) => {
        const { onGuardar } = preparar();
        fireEvent.change(dias(), { target: { value: plazo } });
        fireEvent.click(guardar());
        expect(onGuardar).not.toHaveBeenCalled();
        expect(mocks.notificar).toHaveBeenCalledWith(mensaje, "error");
        expect(dias()).toHaveAttribute("aria-invalid", "true");
        fireEvent.change(dias(), { target: { value: "10" } });
        expect(dias()).toHaveAttribute("aria-invalid", "false");
    });

    it("permite apagar aunque se haya borrado el plazo, conservando el último guardado", async () => {
        const { onGuardar } = preparar();
        fireEvent.change(dias(), { target: { value: "" } });
        fireEvent.click(interruptor());
        fireEvent.click(guardar());
        await waitFor(exito);
        expect(onGuardar).toHaveBeenCalledExactlyOnceWith({ habilitado: false, diasAnticipacion: "9" });
        expect(dias()).toHaveValue("9");
        expect(dias()).toBeDisabled();
    });

    it("bloquea todos los controles mientras guarda y evita enviar dos veces", async () => {
        let finalizar!: () => void;
        const onGuardar = vi.fn(() => new Promise<void>((resolve) => { finalizar = resolve; }));
        preparar(undefined, onGuardar);
        fireEvent.change(dias(), { target: { value: "14" } });
        fireEvent.click(guardar());
        expect(interruptor()).toBeDisabled();
        expect(dias()).toBeDisabled();
        expect(guardar()).toBeDisabled();
        fireEvent.click(guardar());
        expect(onGuardar).toHaveBeenCalledOnce();
        await act(async () => { finalizar(); });
        expect(interruptor()).toBeEnabled();
        expect(dias()).toBeEnabled();
        expect(guardar()).toBeDisabled();
    });

    it("conserva la edición si falla el guardado y permite reintentar", async () => {
        const onGuardar = vi.fn().mockRejectedValueOnce(new Error("Error al guardar")).mockResolvedValueOnce(undefined);
        preparar(undefined, onGuardar);
        fireEvent.change(dias(), { target: { value: "14" } });
        fireEvent.click(interruptor());
        fireEvent.click(guardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("Error al guardar", "error"));
        expect(interruptor()).not.toBeChecked();
        expect(dias()).toHaveValue("14");
        expect(guardar()).toBeEnabled();
        fireEvent.click(guardar());
        await waitFor(exito);
        expect(onGuardar).toHaveBeenCalledTimes(2);
        expect(onGuardar).toHaveBeenLastCalledWith({ habilitado: false, diasAnticipacion: "14" });
    });

    it("conserva ediciones ante el mismo servidor y sincroniza cambios confirmados", () => {
        const { rerender, configuracion, onGuardar } = preparar();
        fireEvent.change(dias(), { target: { value: "14" } });
        rerender(<TarjetaAvisosLocales configuracion={{ ...configuracion }} onGuardar={onGuardar} />);
        expect(dias()).toHaveValue("14");
        expect(guardar()).toBeEnabled();
        rerender(<TarjetaAvisosLocales configuracion={{ habilitado: false, diasAnticipacion: "0" }} onGuardar={onGuardar} />);
        expect(interruptor()).not.toBeChecked();
        expect(dias()).toHaveValue("0");
        expect(dias()).toBeDisabled();
        expect(guardar()).toBeDisabled();
    });
});
