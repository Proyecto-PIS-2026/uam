
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ListadoConfiguraciones from "./ListadoConfiguracionesPublicaciones";

describe("ListadoConfiguraciones", () => {
    beforeEach(() => {vi.stubGlobal("fetch", vi.fn());});

    afterEach(() => {vi.unstubAllGlobals()});

    it("muestra el importe inicial de ajuste rápido de precios", () => {
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }}/>);
        expect(screen.getByText("Importe de ajuste rápido de precios")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toHaveValue("10");
        expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("muestra el campo vacío cuando la configuración no existe", () => {
        render(<ListadoConfiguraciones configuracion={{}} />);
        expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("muestra el campo vacío cuando la configuración es null", () => {
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: null }}/>);
        expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("permite modificar el importe de ajuste rápido", () => {
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "25" }});
        expect(screen.getByRole("textbox")).toHaveValue("25");
    });

    it("impide ingresar caracteres no numéricos", () => {
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "abc" }});
        expect(screen.getByRole("textbox")).toHaveValue("10");
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "12.5" }});
        expect(screen.getByRole("textbox")).toHaveValue("10");
    });

    it("guarda el nuevo importe mediante una petición PATCH", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({valor: "25"}),
        } as Response);
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "25" }});
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
                "/api/configuracion/incremento_precio",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ valor: "25" }),
                }
            );
            expect(screen.getByRole("textbox")).toHaveValue("25");
            expect(screen.getByRole("textbox")).toBeDisabled();
        });
    });

    it("restablece el importe a 10 al confirmar la eliminación", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({valor: "10"}),
        } as Response);
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "25" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
                "/api/configuracion/incremento_precio",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ valor: "10" }),
                }
            );
            expect(screen.getByRole("textbox")).toHaveValue("10");
        });
    });

    it("no realiza peticiones al cancelar la edición", () => {
        const fetchMock = vi.mocked(fetch);
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "50" }});
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByRole("textbox")).toHaveValue("10");
        expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("no realiza peticiones al cancelar la eliminación", () => {
        const fetchMock = vi.mocked(fetch);
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "25" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByRole("textbox")).toHaveValue("25");
    });

    it("muestra el error devuelto por la API al guardar el importe", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: false,
            json: async () => ({errores: ["El valor debe ser un número entero mayor a cero."]}),
        } as Response);
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox"), {target: { value: "0" }});
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
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
        await waitFor(() => {
            expect(screen.getByRole("textbox")).toBeEnabled();
            expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
        });
    });

    it("muestra el mensaje por defecto cuando la API no devuelve errores", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: false,
            json: async () => ({}),
        } as Response);
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "10" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la configuración.");
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("muestra un error cuando falla el restablecimiento del importe", async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue({
            ok: false,
            json: async () => ({errores: ["No se pudo modificar la configuración."]}),
        } as Response);
        render(<ListadoConfiguraciones configuracion={{ incremento_precio: "25" }}/>);
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo modificar la configuración.");
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(screen.getByRole("textbox")).toHaveValue("25");
        await waitFor(() => {expect(screen.getByRole("button", { name: "Confirmar eliminación" })).toBeEnabled();
        });
    });
});
