import { StrictMode } from "react";
import { render, screen } from "@/test-utils";
import { describe, expect, it } from "vitest";
import AvisoErrorToast from "./AvisoErrorToast";

describe("AvisoErrorToast", () => {
    it("notifica una sola vez en StrictMode y al repetir el mismo estado", () => {
        const { rerender } = render(<StrictMode><AvisoErrorToast mensaje="No se pudo cargar." /></StrictMode>);
        expect(screen.getAllByRole("alert")).toHaveLength(1);
        rerender(<StrictMode><AvisoErrorToast mensaje="No se pudo cargar." /></StrictMode>);
        expect(screen.getAllByRole("alert")).toHaveLength(1);
    });

    it("retira el aviso al corregirse y permite mostrarlo de nuevo si el error vuelve", () => {
        const { rerender } = render(<AvisoErrorToast mensaje="Revisá el período." />);
        expect(screen.getByRole("alert")).toHaveTextContent("Revisá el período.");
        rerender(<AvisoErrorToast mensaje={null} />);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        rerender(<AvisoErrorToast mensaje="Revisá el período." />);
        expect(screen.getAllByRole("alert")).toHaveLength(1);
        expect(screen.getByRole("alert")).toHaveTextContent("Revisá el período.");
    });

    it("conserva la advertencia anterior al notificar un nuevo error", () => {
        const { rerender } = render(<AvisoErrorToast mensaje="Publicación no disponible." tipo="warning" />);
        const advertencia = screen.getByRole("alert");
        expect(advertencia).toHaveClass("MuiAlert-colorWarning");
        rerender(<AvisoErrorToast mensaje="Publicación no disponible." />);
        const avisos = screen.getAllByRole("alert");
        expect(avisos).toHaveLength(2);
        expect(avisos[0]).toBe(advertencia);
        expect(avisos[1]).toHaveClass("MuiAlert-colorError");
    });

    it("acumula los errores distintos hasta conservar los tres más recientes", () => {
        const { rerender } = render(<AvisoErrorToast mensaje="Primer error." />);
        rerender(<AvisoErrorToast mensaje="Segundo error." />);
        const segundo = screen.getAllByRole("alert")[1];
        rerender(<AvisoErrorToast mensaje="Tercer error." />);
        expect(screen.getAllByRole("alert")).toHaveLength(3);
        rerender(<AvisoErrorToast mensaje="Cuarto error." />);
        const avisos = screen.getAllByRole("alert");
        expect(avisos.map((aviso) => aviso.textContent)).toEqual(["Segundo error.", "Tercer error.", "Cuarto error."]);
        expect(avisos[0]).toBe(segundo);
    });

    it("conserva los avisos de carga entre reintentos y acumula hasta tres aunque el error sea el mismo", () => {
        const { rerender } = render(<AvisoErrorToast mensaje="No se pudo cargar." cerrarAlCorregir={false} />);
        for (let intento = 2; intento <= 4; intento += 1) {
            const anteriores = screen.getAllByRole("alert");
            rerender(<AvisoErrorToast mensaje={null} cerrarAlCorregir={false} />);
            expect(screen.getAllByRole("alert")).toEqual(anteriores);
            rerender(<AvisoErrorToast mensaje="No se pudo cargar." cerrarAlCorregir={false} />);
            const avisos = screen.getAllByRole("alert");
            expect(avisos).toHaveLength(Math.min(intento, 3));
            expect(avisos.slice(0, -1)).toEqual(anteriores.slice(-2));
            expect(anteriores).not.toContain(avisos.at(-1));
        }
    });
});
