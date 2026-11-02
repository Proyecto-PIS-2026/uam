import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SeguimientoVisita from "./SeguimientoVisita";

describe("SeguimientoVisita", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true }),
        } as Response);
    });

    it("debería realizar un fetch al montar el componente", () => {
        render(<SeguimientoVisita />);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith("/api/estadisticas/visitas", { method: "GET" });
    });

    it("debería evitar llamadas duplicadas bajo StrictMode", () => {
        render(
            <StrictMode>
                <SeguimientoVisita />
            </StrictMode>
        );
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("debería manejar el error de fetch silenciosamente", () => {
        global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

        render(<SeguimientoVisita />);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});