
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PerfilPublicoOperador } from "../../consultas-perfil-publico";
import PerfilOperador from "./PerfilOperador";

// Reemplazar Image de next por un img común.
vi.mock("next/image", async () => {
    const { createElement } = await import("react");

    return {
        default: ({ src, alt }: { src: string; alt: string }) =>
            createElement("img", { src, alt }),
    };
});

const operador: PerfilPublicoOperador = {
    id: 13,
    nombreFantasia: "Frutas del Norte",
    fotoPerfil: null,
    whatsApp: "+598 99-100-001",
    locales: [
        { numeroLocal: "18", nombreNave: "B" },
        { numeroLocal: "19", nombreNave: "B" },
        { numeroLocal: "5", nombreNave: "A" },
    ],
    publicaciones: [],
};

const mensajeWhatsApp = "Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.";

describe("PerfilOperador", () => {
    it("muestra el aviso y las fechas de licencia con su mensaje de recomendación", () => {
        render(
            <PerfilOperador operador={{ ...operador, enLicencia: true,
                comentario: "Licencia: 2026-11-05 - 2026-11-12\n\nConsultar disponibilidad antes de comprar." }} />,
        );

        expect(screen.getAllByRole("status")[0]).toHaveTextContent("Fecha: 05/11/2026 - 12/11/2026");
        expect(screen.queryByText("Mensaje de recomendación")).not.toBeInTheDocument();
        expect(screen.getByText("Consultar disponibilidad antes de comprar.")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Licencia" })).toBeInTheDocument();
    });

    it("indica que las fechas de licencia no están especificadas cuando el comentario no tiene formato", () => {
        render(<PerfilOperador operador={{ ...operador, enLicencia: true, comentario: "En licencia sin fechas" }} />);

        expect(screen.getAllByRole("status")[0]).toHaveTextContent("Fechas no especificadas");
        expect(screen.getByText("En licencia sin fechas")).toBeInTheDocument();
    });


    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("muestra el nombre, la inicial y los locales agrupados por nave", () => {
        render(<PerfilOperador operador={operador} />);

        expect(screen.getByRole("heading", {
            name: "Frutas del Norte",
        })).toBeInTheDocument();

        expect(screen.getByText("F")).toBeInTheDocument();

        expect(screen.queryByRole("img", {
            name: "Foto de Frutas del Norte",
        })).not.toBeInTheDocument();

        expect(screen.getAllByRole("listitem")).toHaveLength(2);

        expect(screen.getByText("Nave B")).toBeInTheDocument();
        expect(screen.getByText("Locales 18, 19")).toBeInTheDocument();

        expect(screen.getByText("Nave A")).toBeInTheDocument();
        expect(screen.getByText("Local 5")).toBeInTheDocument();
    });

    it("muestra la foto cuando el operador tiene una", () => {
        render(
            <PerfilOperador
                operador={{
                    ...operador,
                    fotoPerfil: "/operador.jpg",
                }}
            />,
        );

        expect(screen.getByRole("img", {
            name: "Foto de Frutas del Norte",
        })).toHaveAttribute("src", "/operador.jpg");

        expect(screen.queryByText("F")).not.toBeInTheDocument();
    });

    it("muestra el estado vacío cuando el operador no tiene locales", () => {
        render(
            <PerfilOperador
                operador={{
                    ...operador,
                    locales: [],
                }}
            />,
        );

        expect(screen.getByText("Sin locales registrados")).toBeInTheDocument();

        expect(screen.getByText(
            "El operador no tiene locales registrados.",
        )).toBeInTheDocument();

        expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    });

    it("muestra Tinglado sin agregarle el prefijo Nave", () => {
        render(
            <PerfilOperador
                operador={{
                    ...operador,
                    locales: [
                        { numeroLocal: "12", nombreNave: "Tinglado" },
                    ],
                }}
            />,
        );

        expect(screen.getByRole("listitem")).toBeInTheDocument();
        expect(screen.getByText("Tinglado")).toBeInTheDocument();
        expect(screen.getByText("Local 12")).toBeInTheDocument();

        expect(screen.queryByText("Nave Tinglado")).not.toBeInTheDocument();
    });

    it("muestra un único local sin utilizar el plural", () => {
        render(
            <PerfilOperador
                operador={{
                    ...operador,
                    locales: [
                        { numeroLocal: "25", nombreNave: "D" },
                    ],
                }}
            />,
        );

        expect(screen.getByText("Nave D")).toBeInTheDocument();
        expect(screen.getByText("Local 25")).toBeInTheDocument();
        expect(screen.queryByText("Locales 25")).not.toBeInTheDocument();
    });

    it("utiliza los valores predeterminados del botón para volver", () => {
        render(<PerfilOperador operador={operador} />);

        const enlace = screen.getByRole("link", {
            name: "Volver al listado de operadores",
        });

        expect(enlace).toHaveAttribute("href", "/operadores");
    });

    it("permite personalizar el destino y el texto del botón para volver", () => {
        render(
            <PerfilOperador
                operador={operador}
                hrefVolver="/mi-mercado"
                textoVolver="Volver al mercado"
            />,
        );

        const enlace = screen.getByRole("link", {
            name: "Volver al mercado",
        });

        expect(enlace).toHaveAttribute("href", "/mi-mercado");

        expect(screen.queryByRole("link", {
            name: "Volver al listado de operadores",
        })).not.toBeInTheDocument();
    });

    it("prepara el enlace de WhatsApp con el número y el mensaje", () => {
        render(<PerfilOperador operador={operador} />);

        const enlace = screen.getByRole("link", {
            name: "Contactar a Frutas del Norte por WhatsApp",
        });

        const destino = new URL(enlace.getAttribute("href")!);

        expect(destino.hostname).toBe("web.whatsapp.com");
        expect(destino.pathname).toBe("/send");
        expect(destino.searchParams.get("phone")).toBe("59899100001");
        expect(destino.searchParams.get("text")).toBe(mensajeWhatsApp);
    });

    it("registra el contacto de WhatsApp del operador", () => {
        const fetchMock = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("fetch", fetchMock);

        render(<PerfilOperador operador={operador} />);

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
                    tipo: "OPERADOR",
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

        render(<PerfilOperador operador={operador} />);

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
});
