import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PerfilProductorPorOperador  } from "@/modulos/usuarios/productores/acciones/consultas-perfil-por-operador";
import PerfilProductor from "./PerfilProductor";

// Reemplazar Image de next por un img comun
vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({ src, alt }: { src: string; alt: string }) =>
            createElement("img", { src, alt }),
    };
});

// Datos de prueba
const productor: PerfilProductorPorOperador  = {
    id: 13,
    nombreFantasia: "Frutas del Norte",
    fotoPerfil: null,
    whatsApp: "+598 99-100-001",
    publicaciones: [],
};

describe("PerfilProductor", () => {
    it("muestra el nombre, la inicial", () => {
        render(<PerfilProductor productor={productor} />);
        expect(screen.getByRole("heading", { name: "Frutas del Norte" })).toBeInTheDocument();
        expect(screen.getByText("F")).toBeInTheDocument();
        expect(screen.queryByRole("img", { name: "Foto de Frutas del Norte" })).not.toBeInTheDocument();
    });

    it("muestra la foto cuando el productor tiene una", () => {
        render(<PerfilProductor productor={{ ...productor, fotoPerfil: "/productor.jpg" }} />);
        expect(screen.getByRole("img", { name: "Foto de Frutas del Norte" })).toHaveAttribute("src", "/productor.jpg");
        expect(screen.queryByText("F")).not.toBeInTheDocument();
    });

    it("prepara el enlace de WhatsApp con el número y el mensaje", () => {
        render(<PerfilProductor productor={productor} />);
        const enlace = screen.getByRole("link", {name: "Contactar a Frutas del Norte por WhatsApp"});
        const destino = new URL(enlace.getAttribute("href")!);
        expect(destino.hostname).toBe("wa.me");
        expect(destino.pathname).toBe("/59899100001");
        expect(destino.searchParams.get("text")).toBe("Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.");
    });

    it("ofrece volver al listado de productores por defecto", () => {
        render(<PerfilProductor productor={productor} />);
        expect(screen.getByRole("link", {name: "Volver al listado de productores"})).toHaveAttribute("href", "/productores");
    });

    it("permite volver a publicaciones cuando se indica ese origen", () => {
        render(<PerfilProductor productor={productor} hrefVolver="/publicaciones-productor" textoVolver="Volver a Mercado Productores"/>);
        expect(screen.getByRole("link", {name: "Volver a Mercado Productores"})).toHaveAttribute("href", "/publicaciones-productor");
    });
});