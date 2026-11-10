import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ImagenPerfil from "./ImagenPerfil";

afterEach(cleanup);

describe("ImagenPerfil", () => {
    it.each([null, undefined, "", "   "])("muestra el reemplazo cuando falta la foto (%s)", (src) => {
        render(<ImagenPerfil src={src} alt="Foto del operador" width={96} height={96} reemplazo={<span>OP</span>} />);
        expect(screen.getByText("OP")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("solicita las fotos protegidas directamente sin pasar por el optimizador", () => {
        const src = "/api/imagenes/operadores/2/perfil.webp";
        render(<ImagenPerfil src={src} alt="Foto del operador" width={96} height={96} className="foto" reemplazo={<span>OP</span>} />);
        const imagen = screen.getByRole("img", { name: "Foto del operador" });
        expect(new URL(imagen.getAttribute("src")!, window.location.href).pathname).toBe(src);
        expect(imagen).not.toHaveAttribute("srcset");
        expect(imagen).toHaveClass("foto");
        expect(imagen).toHaveAttribute("width", "96");
        expect(imagen).toHaveAttribute("height", "96");
        expect(screen.queryByText("OP")).not.toBeInTheDocument();
    });

    it("reemplaza una foto inaccesible y vuelve a cargar cuando cambia la URL", () => {
        const onError = vi.fn();
        const props = { alt: "Foto del productor", fill: true, sizes: "64px", reemplazo: <span>PR</span>, onError };
        const vista = render(<ImagenPerfil {...props} src="/api/imagenes/productores/3/anterior.webp" />);
        fireEvent.error(screen.getByRole("img"));
        expect(onError).toHaveBeenCalledOnce();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.getByText("PR")).toBeInTheDocument();
        vista.rerender(<ImagenPerfil {...props} src="/api/imagenes/productores/3/nueva.webp" />);
        expect(new URL(screen.getByRole("img").getAttribute("src")!, window.location.href).pathname).toBe("/api/imagenes/productores/3/nueva.webp");
        expect(screen.queryByText("PR")).not.toBeInTheDocument();
        expect(screen.getByRole("img")).toHaveAttribute("data-nimg", "fill");
    });
});
