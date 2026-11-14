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

    it("permite avisos de advertencia y actualiza su severidad", () => {
        const { rerender } = render(<AvisoErrorToast mensaje="Publicación no disponible." tipo="warning" />);
        expect(screen.getByRole("alert")).toHaveClass("MuiAlert-colorWarning");
        rerender(<AvisoErrorToast mensaje="Publicación no disponible." />);
        expect(screen.getAllByRole("alert")).toHaveLength(1);
        expect(screen.getByRole("alert")).toHaveClass("MuiAlert-colorError");
    });
});
