import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PerfilPublicoOperador } from "../../consultas-perfil-publico";
import PerfilOperador from "./PerfilOperador";

// Reemplazar Image de next por un img comun
vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({ src, alt }: { src: string; alt: string }) =>
            createElement("img", { src, alt }),
    };
});

// Datos de prueba
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

describe("PerfilOperador", () => {
    it("muestra el nombre, la inicial y los locales agrupados por nave", () => {
        render(<PerfilOperador operador={operador} />);
        expect(screen.getByRole("heading", { name: "Frutas del Norte" })).toBeInTheDocument();
        expect(screen.getByText("F")).toBeInTheDocument();
        expect(screen.queryByRole("img", { name: "Foto de Frutas del Norte" })).not.toBeInTheDocument();
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        expect(screen.getByText("Nave B")).toBeInTheDocument();
        expect(screen.getByText("Locales 18, 19")).toBeInTheDocument();
        expect(screen.getByText("Nave A")).toBeInTheDocument();
        expect(screen.getByText("Local 5")).toBeInTheDocument();
    });

    it("muestra la foto cuando el operador tiene una", () => {
        render(<PerfilOperador operador={{ ...operador, fotoPerfil: "/operador.jpg" }} />);
        expect(screen.getByRole("img", { name: "Foto de Frutas del Norte" })).toHaveAttribute("src", "/operador.jpg");
        expect(screen.queryByText("F")).not.toBeInTheDocument();
    });

    it("prepara el enlace de WhatsApp con el número y el mensaje", () => {
        render(<PerfilOperador operador={operador} />);
        const enlace = screen.getByRole("link", {name: "Contactar a Frutas del Norte por WhatsApp"});
        const destino = new URL(enlace.getAttribute("href")!);
        expect(destino.hostname).toBe("wa.me");
        expect(destino.pathname).toBe("/59899100001");
        expect(destino.searchParams.get("text")).toBe("Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.");
    });
});