import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ListadoConfiguracionesGenerales from "./ListadoConfiguracionesGenerales";

const mocks = vi.hoisted(() => ({
    routerRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: mocks.routerRefresh,
    }),
}));

describe("ListadoConfiguracionesGenerales", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("muestra la URL inicial de la Lista Inteligente habilitada", () => {
        render(<ListadoConfiguracionesGenerales configuracion={{ url_lista_inteligente: "https://uam.com.uy/lista.pdf" }} />);
        expect(screen.getByText("Lista Inteligente")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeEnabled();
        expect(screen.getByRole("textbox")).toHaveValue("https://uam.com.uy/lista.pdf");
    });

    it("muestra el campo vacío cuando la configuración no existe", () => {
        render(<ListadoConfiguracionesGenerales configuracion={{}} />);
        expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("muestra el campo vacío cuando la configuración es null", () => {
        render(<ListadoConfiguracionesGenerales configuracion={{ url_lista_inteligente: null }} />);
        expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("permite modificar la URL de la Lista Inteligente", () => {
        render(<ListadoConfiguracionesGenerales configuracion={{ url_lista_inteligente: "https://uam.com.uy/anterior" }} />);
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "https://uam.com.uy/nueva" } });
        expect(screen.getByRole("textbox")).toHaveValue("https://uam.com.uy/nueva");
    });

    it("guarda la nueva URL mediante una petición PATCH y refresca la ruta", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ valor: "https://uam.com.uy/nueva" }),
        } as Response);

        render(<ListadoConfiguracionesGenerales configuracion={{ url_lista_inteligente: "https://uam.com.uy/anterior" }} />);
        
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "https://uam.com.uy/nueva" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
                "/api/configuracion/url_lista_inteligente",
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ valor: "https://uam.com.uy/nueva" }),
                }
            );
            expect(screen.getByRole("textbox")).toHaveValue("https://uam.com.uy/nueva");
            expect(mocks.routerRefresh).toHaveBeenCalledOnce();
        });
    });

    it("muestra el error devuelto por la API al guardar la URL", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: false,
            json: async () => ({ errores: ["La URL de la Lista Inteligente no es válida."] }),
        } as Response);

        render(<ListadoConfiguracionesGenerales configuracion={{ url_lista_inteligente: "https://uam.com.uy/anterior" }} />);
        
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "url-invalida" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("La URL de la Lista Inteligente no es válida.");
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("muestra un error por defecto cuando la API no devuelve un mensaje", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: false,
            json: async () => ({}),
        } as Response);

        render(<ListadoConfiguracionesGenerales configuracion={{ url_lista_inteligente: "https://uam.com.uy/anterior" }} />);
        
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "https://uam.com.uy/nueva" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la configuración.");
        expect(fetchMock).toHaveBeenCalledOnce();
    });
});