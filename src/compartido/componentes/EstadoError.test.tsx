import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PaginaNoEncontrada from "@/app/not-found";
import ErrorPagina from "@/app/error";
import ErrorGlobal from "@/app/global-error";
import ErrorMiMercado from "@/app/(operador)/mi-mercado/error";

const errorInterno = Object.assign(new Error("Detalle privado de la base de datos"), {
    digest: "identificador-interno-123",
});

describe("pantallas de error", () => {
    it("ofrece una salida al inicio en una página inexistente sin sugerir un reintento", () => {
        render(<PaginaNoEncontrada />);

        expect(screen.getByRole("heading", { level: 1, name: "Error" })).toBeInTheDocument();
        expect(screen.getByText("404: Página no encontrada. La dirección no existe o el contenido ya no está disponible.")).toBeInTheDocument();
        expect(screen.getAllByRole("link")).toHaveLength(1);
        expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/inicio");
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("ofrece solo volver al inicio ante un error de página sin exponer información interna", () => {
        const reset = vi.fn();
        const retry = vi.fn();
        render(<ErrorPagina error={errorInterno} reset={reset} retry={retry} />);

        expect(screen.getByRole("heading", { level: 1, name: "Error" })).toBeInTheDocument();
        expect(screen.getByText("No pudimos cargar esta página. Ocurrió un problema inesperado.")).toBeInTheDocument();
        expect(screen.getAllByRole("link")).toHaveLength(1);
        expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/inicio");
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(screen.queryByText(errorInterno.message)).not.toBeInTheDocument();
        expect(screen.queryByText(errorInterno.digest)).not.toBeInTheDocument();
        expect(reset).not.toHaveBeenCalled();
        expect(retry).not.toHaveBeenCalled();
    });

    it("permite salir de Mi Mercado sin volver a la ruta que falló", () => {
        const reset = vi.fn();
        const retry = vi.fn();
        render(<ErrorMiMercado reset={reset} retry={retry} />);

        expect(screen.getByRole("heading", { level: 1, name: "Error" })).toBeInTheDocument();
        expect(screen.getByText("No se pudieron cargar tus publicaciones.")).toBeInTheDocument();
        expect(screen.getAllByRole("link")).toHaveLength(1);
        expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/inicio");
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(reset).not.toHaveBeenCalled();
        expect(retry).not.toHaveBeenCalled();
    });

    it("renderiza el fallo global como documento autónomo sin layout ni detalles internos", () => {
        const reset = vi.fn();
        const retry = vi.fn();
        const html = renderToStaticMarkup(<ErrorGlobal error={errorInterno} reset={reset} retry={retry} />);
        const documento = new DOMParser().parseFromString(html, "text/html");

        expect(html).toContain('<html lang="es">');
        expect(html).toContain("<body");
        expect(html).toContain("</body></html>");
        expect(documento.querySelector("h1")?.textContent).toBe("Error");
        expect(documento.body.textContent).toContain("No pudimos cargar UAM. Ocurrió un problema al abrir la aplicación.");
        expect(documento.querySelectorAll("a")).toHaveLength(1);
        expect(documento.querySelector("a")?.getAttribute("href")).toBe("/inicio");
        expect(documento.querySelector("a")?.textContent).toBe("Ir al inicio");
        expect(documento.querySelector("button")).toBeNull();
        expect(html).not.toContain(errorInterno.message);
        expect(html).not.toContain(errorInterno.digest);
        expect(reset).not.toHaveBeenCalled();
        expect(retry).not.toHaveBeenCalled();
    });
});
