import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ alCerrar: vi.fn(), alCrear: vi.fn(), esWeb: false }));

vi.mock("@mui/material/useMediaQuery", () => ({ default: () => mocks.esWeb }));
vi.mock("@mui/material/Drawer", () => ({
    default: ({ open, anchor, children }: { open: boolean; anchor: string; children: ReactNode }) => open ? <section role="dialog" aria-label="Nueva publicación" data-anchor={anchor}>{children}</section> : null,
}));

import NuevaPublicacion from "./NuevaPublicacion";

const catalogos = {
    especies: [{ id: 2, nombre: "Manzana" }],
    variedades: [{ id: 3, nombre: "Royal", especieId: 2 }],
    presentaciones: [{ id: 4, nombre: "Caja", variedadId: 3 }],
    categorias: [{ id: 5, nombre: "Primera", especieId: 2 }],
    calibres: [{ id: 6, nombre: "Grande" }],
    paises: [{ id: 7, nombre: "Uruguay" }],
};

function renderDrawer(abierto = true) {
    return render(<NuevaPublicacion operadorId={9} abierto={abierto} alCerrar={mocks.alCerrar} alCrear={mocks.alCrear} />);
}

function prepararFetch(resultadoAlta: Record<string, unknown> = { mensaje: "Publicación creada correctamente.", id: 15 }, estadoAlta = 201) {
    vi.stubGlobal("fetch", vi.fn((_url: string, opciones?: RequestInit) => {
        const resultado = opciones?.method === "POST" ? resultadoAlta : catalogos;
        const status = opciones?.method === "POST" ? estadoAlta : 200;
        return Promise.resolve(new Response(JSON.stringify(resultado), { status }));
    }));
}

function completarFormulario(formulario: HTMLFormElement) {
    const campos = within(formulario);
    fireEvent.mouseDown(campos.getByRole("combobox", { name: /^País de origen/ }));
    fireEvent.click(screen.getByRole("option", { name: "Uruguay" }));
    fireEvent.mouseDown(campos.getByRole("combobox", { name: /^Especie/ }));
    fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
    fireEvent.mouseDown(campos.getByRole("combobox", { name: /^Variedad/ }));
    fireEvent.click(screen.getByRole("option", { name: "Royal" }));
    fireEvent.mouseDown(campos.getByRole("combobox", { name: /^Presentación/ }));
    fireEvent.click(screen.getByRole("option", { name: "Caja" }));
    fireEvent.mouseDown(campos.getByRole("combobox", { name: /^Categoría/ }));
    fireEvent.click(screen.getByRole("option", { name: "Primera" }));
    fireEvent.mouseDown(campos.getByRole("combobox", { name: /^Calibre/ }));
    fireEvent.click(screen.getByRole("option", { name: "Grande" }));
    fireEvent.change(campos.getByLabelText("Precio en pesos"), { target: { value: "1250" } });
}

describe("NuevaPublicacion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.esWeb = false;
        prepararFetch();
    });

    it("muestra el formulario del operador actual", async () => {
        renderDrawer();
        expect(screen.getByRole("heading", { name: "Nueva publicación" })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
    });

    it("conserva únicamente dígitos en el precio", () => {
        renderDrawer();
        const precio = screen.getByLabelText("Precio en pesos");
        fireEvent.change(precio, { target: { value: "12a.50" } });
        expect(precio).toHaveValue("1250");
    });

    it("abre el selector de fotografía al editar la foto", () => {
        renderDrawer();
        const abrirSelector = vi.spyOn(screen.getByLabelText("Fotografía"), "click").mockImplementation(() => {});
        fireEvent.click(screen.getByRole("button", { name: "Editar foto" }));
        expect(abrirSelector).toHaveBeenCalledOnce();
        abrirSelector.mockRestore();
    });

    it("muestra la vista previa de una fotografía válida", async () => {
        vi.stubGlobal("FileReader", class {
            result = "data:image/png;base64,aW1hZ2Vu";
            onload: (() => void) | null = null;
            readAsDataURL() { this.onload?.(); }
        });
        renderDrawer();
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [archivo] } });
        expect(await screen.findByAltText("Vista previa de la fotografía")).toBeInTheDocument();
    });

    it("borra la fotografía y envía la publicación sin ella", async () => {
        vi.stubGlobal("FileReader", class {
            result = "data:image/png;base64,aW1hZ2Vu";
            onload: (() => void) | null = null;
            readAsDataURL() { this.onload?.(); }
        });
        renderDrawer();
        const boton = screen.getByRole("button", { name: "Confirmar" });
        await waitFor(() => expect(boton).toBeEnabled());
        const formulario = boton.closest("form");
        if (!formulario) throw new Error("No se encontró el formulario de publicación.");
        completarFormulario(formulario);
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [archivo] } });
        expect(await screen.findByAltText("Vista previa de la fotografía")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Borrar foto" }));
        expect(screen.queryByAltText("Vista previa de la fotografía")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Borrar foto" })).not.toBeInTheDocument();

        fireEvent.submit(formulario);
        await waitFor(() => expect(mocks.alCrear).toHaveBeenCalledWith("Publicación creada correctamente."));
        expect(fetch).toHaveBeenCalledWith("/api/publicaciones", expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"fotografia":""'),
        }));
    });

    it("rechaza una fotografía inválida", async () => {
        renderDrawer();
        const archivo = new File(["texto"], "archivo.txt", { type: "text/plain" });
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [archivo] } });
        expect(await screen.findByRole("alert")).toHaveTextContent("La fotografía debe ser PNG, JPEG o WebP");
    });

    it("muestra los errores devueltos al enviar", async () => {
        prepararFetch({ errores: ["La publicación no es válida."] }, 400);
        renderDrawer();
        const boton = screen.getByRole("button", { name: "Confirmar" });
        await waitFor(() => expect(boton).toBeEnabled());
        const formulario = boton.closest("form");
        if (!formulario) throw new Error("No se encontró el formulario de publicación.");
        fireEvent.submit(formulario);
        expect(await screen.findByRole("alert")).toHaveTextContent("La publicación no es válida.");
    });

    it("envía la publicación y comunica el alta sin navegar a otra página", async () => {
        renderDrawer();
        const boton = screen.getByRole("button", { name: "Confirmar" });
        await waitFor(() => expect(boton).toBeEnabled());
        const formulario = boton.closest("form");
        if (!formulario) throw new Error("No se encontró el formulario de publicación.");
        completarFormulario(formulario);
        fireEvent.submit(formulario);
        await waitFor(() => expect(mocks.alCrear).toHaveBeenCalledWith("Publicación creada correctamente."));
        expect(fetch).toHaveBeenCalledWith("/api/publicaciones", expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"operadorId":9'),
        }));
    });

    it("permite cancelar el alta sin enviar el formulario", () => {
        renderDrawer();
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(mocks.alCerrar).toHaveBeenCalled();
        expect(mocks.alCrear).not.toHaveBeenCalled();
    });

    it("no muestra el drawer cuando está cerrado", () => {
        renderDrawer(false);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("abre el drawer desde abajo en mobile", () => {
        renderDrawer();
        expect(screen.getByRole("dialog", { name: "Nueva publicación" })).toHaveAttribute("data-anchor", "bottom");
    });

    it("abre el drawer desde la derecha en web", () => {
        mocks.esWeb = true;
        renderDrawer();
        expect(screen.getByRole("dialog", { name: "Nueva publicación" })).toHaveAttribute("data-anchor", "right");
    });
});
