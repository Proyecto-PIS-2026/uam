
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PerfilProductorPorOperador } from "@/modulos/usuarios/productores/acciones/consultas-perfil-por-operador";
import PerfilProductor from "./PerfilProductor";

// Reemplazar Image de next por un img común
vi.mock("next/image", async () => {
    const { createElement } = await import("react");

    return {
        default: ({
            src,
            alt,
            onError,
        }: {
            src: string;
            alt: string;
            onError?: React.ReactEventHandler<HTMLImageElement>;
        }) => createElement("img", { src, alt, onError }),
    };
});

const productor: PerfilProductorPorOperador = {
    id: 13,
    nombreFantasia: "Frutas del Norte",
    fotoPerfil: null,
    whatsApp: "+598 99-100-001",
    departamentos: ["Canelones", "Salto"],
    publicaciones: [],
};

describe("PerfilProductor", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("muestra el nombre, la inicial y el tipo de perfil", () => {
        render(<PerfilProductor productor={productor} />);

        expect(screen.getByRole("heading", {
            name: "Frutas del Norte",
        })).toBeInTheDocument();

        expect(screen.getByText("Perfil Productor")).toBeInTheDocument();
        expect(screen.getByText("F")).toBeInTheDocument();

        expect(screen.queryByRole("img", {
            name: "Foto de Frutas del Norte",
        })).not.toBeInTheDocument();
    });

    it("muestra la foto cuando el productor tiene una", () => {
        render(
            <PerfilProductor
                productor={{ ...productor, fotoPerfil: "/productor.jpg" }}
            />,
        );

        expect(screen.getByRole("img", {
            name: "Foto de Frutas del Norte",
        })).toHaveAttribute("src", "/productor.jpg");

        expect(screen.queryByText("F")).not.toBeInTheDocument();
    });

    it("muestra los departamentos y un guion cuando no hay información", () => {
        const vista = render(<PerfilProductor productor={productor} />);

        expect(screen.getByText("Canelones · Salto", {
            exact: false,
        })).toBeInTheDocument();

        vista.rerender(
            <PerfilProductor
                productor={{ ...productor, departamentos: [] }}
            />,
        );

        expect(screen.getByText("Departamentos:").parentElement).toHaveTextContent(
            "Departamentos: -",
        );
    });

    it("muestra la inicial si falla la foto del perfil", () => {
        render(
            <PerfilProductor
                productor={{ ...productor, fotoPerfil: "/productor.jpg" }}
            />,
        );

        fireEvent.error(
            screen.getByRole("img", { name: "Foto de Frutas del Norte" }),
        );

        expect(screen.getByText("F")).toBeInTheDocument();

        expect(screen.queryByRole("img", {
            name: "Foto de Frutas del Norte",
        })).not.toBeInTheDocument();
    });

    it("prepara el enlace de WhatsApp con el número y el mensaje", () => {
        render(<PerfilProductor productor={productor} />);

        const enlace = screen.getByRole("link", {
            name: "Contactar a Frutas del Norte por WhatsApp",
        });

        const destino = new URL(enlace.getAttribute("href")!);

        expect(destino.hostname).toBe("web.whatsapp.com");
        expect(destino.pathname).toBe("/send");

        expect(destino.searchParams.get("phone")).toBe("59899100001");

        expect(destino.searchParams.get("text")).toBe(
            "Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.",
        );
    });

    it("registra el contacto cuando se hace clic en el enlace de WhatsApp", () => {
        const fetchMock = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("fetch", fetchMock);

        render(<PerfilProductor productor={productor} />);

        fireEvent.click(screen.getByRole("link", {
            name: "Contactar a Frutas del Norte por WhatsApp",
        }));

        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
            "/api/estadisticas/whatsapp",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    tipo: "PRODUCTOR",
                    entidadId: 13,
                }),
                keepalive: true,
            },
        );
    });

    it("registra el error en consola cuando falla el registro del contacto", async () => {
        const error = new Error("Error de conexión");
        const fetchMock = vi.fn().mockRejectedValue(error);
        const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});

        vi.stubGlobal("fetch", fetchMock);

        render(<PerfilProductor productor={productor} />);

        fireEvent.click(screen.getByRole("link", {
            name: "Contactar a Frutas del Norte por WhatsApp",
        }));

        await waitFor(() => {
            expect(registrarError).toHaveBeenCalledExactlyOnceWith(
                "Error al registrar contacto:",
                error,
            );
        });

        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("ofrece volver al listado de productores por defecto", () => {
        render(<PerfilProductor productor={productor} />);

        expect(screen.getByRole("link", {
            name: "Volver al listado de productores",
        })).toHaveAttribute("href", "/productores");
    });

    it("permite volver a publicaciones cuando se indica ese origen", () => {
        render(
            <PerfilProductor
                productor={productor}
                hrefVolver="/publicaciones-productor"
                textoVolver="Volver a Mercado Producción"
            />,
        );

        expect(screen.getByRole("link", {
            name: "Volver a Mercado Producción",
        })).toHaveAttribute("href", "/publicaciones-productor");
    });

    it("actualiza el perfil cuando cambia el productor recibido", () => {
        const vista = render(<PerfilProductor productor={productor} />);

        const otroProductor = {
            ...productor,
            id: 25,
            nombreFantasia: "Productor del Sur",
            whatsApp: "+598 98 222 333",
            departamentos: ["Montevideo"],
        };

        vista.rerender(<PerfilProductor productor={otroProductor} />);

        expect(screen.getByRole("heading", {
            name: "Productor del Sur",
        })).toBeInTheDocument();

        expect(screen.getByText("P")).toBeInTheDocument();
        expect(screen.getByText("Montevideo", {
            exact: false,
        })).toBeInTheDocument();

        const enlace = screen.getByRole("link", {
            name: "Contactar a Productor del Sur por WhatsApp",
        });

        const destino = new URL(enlace.getAttribute("href")!);

        expect(destino.searchParams.get("phone")).toBe("59898222333");
    });
});
