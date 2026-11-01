import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SelectorFotoPerfil, { argumentosFotoPerfil, type CambioFotoPerfil } from "./SelectorFotoPerfil";

const URLOriginal = URL;
const crearUrl = vi.fn();
const revocarUrl = vi.fn();
const alError = vi.fn();

function SelectorControlado({ fotoActual, deshabilitado = false }: { fotoActual?: string; deshabilitado?: boolean }) {
    const [cambio, setCambio] = useState<CambioFotoPerfil>(undefined);
    return <SelectorFotoPerfil fotoActual={fotoActual} cambio={cambio} alCambiar={setCambio} alError={alError} deshabilitado={deshabilitado} />;
}

function elegir(archivo: File) {
    fireEvent.change(screen.getByLabelText("Seleccionar foto de perfil"), { target: { files: [archivo] } });
}

function esperarFoto(ruta: string) {
    const src = screen.getByRole("img").getAttribute("src");
    expect(src).not.toBeNull();
    expect(new URL(src!, window.location.href).href).toBe(new URL(ruta, window.location.href).href);
}

describe("SelectorFotoPerfil", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        crearUrl.mockImplementation((archivo: File) => `blob:${archivo.name}`);
        vi.stubGlobal("URL", class extends URLOriginal {
            static createObjectURL = crearUrl;
            static revokeObjectURL = revocarUrl;
        });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it("permite cargar, reemplazar y quitar una foto nueva liberando sus vistas previas", async () => {
        const vista = render(<SelectorControlado />);
        expect(screen.getByRole("button", { name: "Agregar foto" })).toBeEnabled();
        expect(screen.queryByRole("button", { name: "Quitar foto" })).not.toBeInTheDocument();
        elegir(new File(["jpeg"], "primera.jpg", { type: "image/jpeg" }));
        expect(await screen.findByRole("img", { name: "Vista previa de la foto de perfil" })).toHaveAttribute("src", "blob:primera.jpg");
        expect(screen.getByLabelText("Seleccionar foto de perfil")).toHaveValue("");
        elegir(new File(["png"], "segunda.png", { type: "image/png" }));
        await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "blob:segunda.png"));
        expect(revocarUrl).toHaveBeenCalledWith("blob:primera.jpg");
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Agregar foto" })).toBeEnabled();
        expect(revocarUrl).toHaveBeenCalledWith("blob:segunda.png");
        elegir(new File(["webp"], "tercera.webp", { type: "image/webp" }));
        await screen.findByRole("img");
        vista.unmount();
        expect(revocarUrl).toHaveBeenCalledWith("blob:tercera.webp");
    });

    it("muestra la foto actual directamente y permite deshacer el reemplazo o la eliminación", async () => {
        const actual = "/api/imagenes/productores/2/actual.webp";
        render(<SelectorControlado fotoActual={actual} />);
        esperarFoto(actual);
        expect(screen.getByRole("img")).not.toHaveAttribute("srcset");
        elegir(new File(["jpeg"], "nueva.jpg", { type: "image/jpeg" }));
        await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "blob:nueva.jpg"));
        fireEvent.click(screen.getByRole("button", { name: "Deshacer cambio" }));
        esperarFoto(actual);
        expect(revocarUrl).toHaveBeenCalledWith("blob:nueva.jpg");
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("La foto se eliminará al guardar.");
        fireEvent.click(screen.getByRole("button", { name: "Deshacer cambio" }));
        esperarFoto(actual);
    });

    it.each([
        ["image/gif", 10, "La foto debe ser JPEG, PNG o WebP."],
        ["image/jpeg", 0, "La foto debe pesar entre 1 byte y 10 MB."],
        ["image/png", 10 * 1024 * 1024 + 1, "La foto debe pesar entre 1 byte y 10 MB."],
    ])("rechaza %s de %s bytes y conserva la foto actual", (tipo, tamano, mensaje) => {
        render(<SelectorControlado fotoActual="/api/imagenes/operadores/2/actual.webp" />);
        const archivo = new File(["x"], "foto", { type: tipo });
        Object.defineProperty(archivo, "size", { value: tamano });
        elegir(archivo);
        expect(alError).toHaveBeenCalledWith(mensaje);
        expect(crearUrl).not.toHaveBeenCalled();
        esperarFoto("/api/imagenes/operadores/2/actual.webp");
    });

    it("deshabilita los controles y no cambia la selección mientras guarda", () => {
        render(<SelectorControlado fotoActual="/foto.webp" deshabilitado />);
        expect(screen.getByLabelText("Seleccionar foto de perfil")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Quitar foto" })).toBeDisabled();
        elegir(new File(["png"], "foto.png", { type: "image/png" }));
        expect(crearUrl).not.toHaveBeenCalled();
        esperarFoto("/foto.webp");
    });

    it("descarta una vista previa pendiente si el selector se desmonta enseguida", async () => {
        const vista = render(<SelectorControlado />);
        elegir(new File(["png"], "foto.png", { type: "image/png" }));
        vista.unmount();
        await act(async () => {});
        expect(revocarUrl).toHaveBeenCalledWith("blob:foto.png");
    });

    it("distingue conservar, reemplazar y quitar en el envío sin aceptar URLs de imágenes", () => {
        expect(argumentosFotoPerfil(undefined)).toEqual([]);
        const archivo = new File(["png"], "foto.png", { type: "image/png" });
        const [subida] = argumentosFotoPerfil(archivo);
        expect(subida!.get("fotoPerfil")).toBe(archivo);
        expect(subida!.has("eliminarFoto")).toBe(false);
        const [borrado] = argumentosFotoPerfil(null);
        expect(borrado!.get("eliminarFoto")).toBe("true");
        expect(borrado!.has("fotoPerfil")).toBe(false);
    });
});
