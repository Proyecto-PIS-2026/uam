import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ListadoConfiguraciones from "./ListadoConfiguracionesPublicaciones";

const mocks = vi.hoisted(() => ({
    routerRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: mocks.routerRefresh,
    }),
}));

describe("ListadoConfiguraciones", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("muestra el importe inicial de ajuste rápido de precios habilitado", () => {
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }} />);
        expect(screen.getByText("Importe de ajuste rápido de precios")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeEnabled();
        expect(screen.getByRole("textbox")).toHaveValue("10");
    });

    it("muestra el campo vacío cuando la configuración no existe", () => {
        render(<ListadoConfiguraciones configuracion={{}} />);
        expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("muestra el campo vacío cuando la configuración es null", () => {
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: null }} />);
        expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("permite modificar el importe de ajuste rápido", () => {
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }} />);
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "25" } });
        expect(screen.getByRole("textbox")).toHaveValue("25");
    });

    it("impide ingresar caracteres no numéricos", () => {
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }} />);
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });
        expect(screen.getByRole("textbox")).toHaveValue("10");
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "12.5" } });
        expect(screen.getByRole("textbox")).toHaveValue("10");
    });

    it("guarda el nuevo importe mediante una petición PATCH y refresca la ruta", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ valor: "25" }),
        } as Response);

        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }} />);
        
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "25" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
                "/api/configuracion/incremento_precio",
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ valor: "25" }),
                }
            );
            expect(screen.getByRole("textbox")).toHaveValue("25");
            expect(mocks.routerRefresh).toHaveBeenCalledOnce();
        });
    });

    it("muestra el error devuelto por la API al guardar el importe", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: false,
            json: async () => ({ errores: ["El valor debe ser un número entero mayor a cero."] }),
        } as Response);

        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }} />);
        
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "0" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "El valor debe ser un número entero mayor a cero."
        );
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
            "/api/configuracion/incremento_precio",
            expect.objectContaining({
                method: "PATCH",
                body: JSON.stringify({ valor: "0" }),
            })
        );
    });

    it("muestra el mensaje por defecto cuando la API no devuelve errores", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: false,
            json: async () => ({}),
        } as Response);

        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }} />);
        
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "20" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la configuración.");
        expect(fetchMock).toHaveBeenCalledOnce();
    });
});