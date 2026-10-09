import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ListadoConfiguracionesGenerales from "./ListadoConfiguracionesGenerales";

describe("ListadoConfiguracionesGenerales", () => {
    beforeEach(() => {vi.stubGlobal("fetch", vi.fn());});
    afterEach(() => {vi.unstubAllGlobals();});

    it("muestra la URL inicial de la Lista Inteligente", () => {
        render(<ListadoConfiguracionesGenerales configuracion={{url_lista_inteligente: "https://uam.com.uy/lista.pdf",}}/>);
        expect(screen.getByText("Lista Inteligente")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toHaveValue("https://uam.com.uy/lista.pdf");
        expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("muestra el campo vacío cuando la configuración no existe", () => {
        render(<ListadoConfiguracionesGenerales configuracion={{}} />);
        expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("muestra el campo vacío cuando la configuración es null", () => {
        render(<ListadoConfiguracionesGenerales configuracion={{ url_lista_inteligente: null }}/>);
        expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("permite modificar la URL de la Lista Inteligente", () => {
        render(<ListadoConfiguracionesGenerales configuracion={{ url_lista_inteligente: "https://uam.com.uy/anterior" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "https://uam.com.uy/nueva" },});
        expect(screen.getByRole("textbox")).toHaveValue("https://uam.com.uy/nueva");
    });

    it("guarda la nueva URL mediante una petición PATCH", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                valor: "https://uam.com.uy/nueva",
            }),
        } as Response);
        render(<ListadoConfiguracionesGenerales configuracion={{ url_lista_inteligente: "https://uam.com.uy/anterior" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "https://uam.com.uy/nueva" }});
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
                "/api/configuracion/url_lista_inteligente",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        valor: "https://uam.com.uy/nueva",
                    }),
                }
            );
            expect(screen.getByRole("textbox")).toHaveValue("https://uam.com.uy/nueva");
            expect(screen.getByRole("textbox")).toBeDisabled();
        });
    });

    it("elimina la URL enviando el valor por defecto", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                valor: "",
            }),
        } as Response);
        render(<ListadoConfiguracionesGenerales configuracion={{ url_lista_inteligente: "https://uam.com.uy/lista.pdf" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
                "/api/configuracion/url_lista_inteligente",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ valor: "" }),
                }
            );
            expect(screen.getByRole("textbox")).toHaveValue("");
        });
    });

    it("no realiza peticiones al cancelar la edición", () => {
        const fetchMock = vi.mocked(fetch);
        render(<ListadoConfiguracionesGenerales configuracion={{ url_lista_inteligente: "https://uam.com.uy/anterior" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "https://uam.com.uy/nueva" }});
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByRole("textbox")).toHaveValue("https://uam.com.uy/anterior");
    });

    it("no realiza peticiones al cancelar la eliminación", () => {
        const fetchMock = vi.mocked(fetch);
        render(<ListadoConfiguracionesGenerales configuracion={{ url_lista_inteligente: "https://uam.com.uy/lista.pdf" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByRole("textbox")).toHaveValue("https://uam.com.uy/lista.pdf");
    });
});