import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import TarjetaPublicacion from "./TarjetaPublicacion";

// Reemplazar un Image de next por un img comun
vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({ src, alt }: { src: string; alt: string }) =>
            createElement("img", { src, alt }),
    };
});

// Datos de prueba
const publicacion: PublicacionPerfil = {
    id: 101,
    foto: null,
    precio: "120",
    especie: "Tomate",
    variedad: "Perita",
    presentacion: "Cajón",
    categoria: "Extra",
    calibre: "A",
};

describe("TarjetaPublicacion", () => {
    it("muestra los datos y el precio del producto", () => {
        render(<TarjetaPublicacion publicacion={publicacion} />);

        expect(screen.getByText("Tomate - Perita")).toBeInTheDocument();
        expect(screen.getByText("A")).toBeInTheDocument();
        expect(screen.getByText("Extra")).toBeInTheDocument();
        expect(screen.getByText("$120")).toBeInTheDocument();
        expect(screen.getByText("por Cajón")).toBeInTheDocument();
    });

    it("muestra solo la especie, la foto alternativa y la consulta de precio cuando faltan datos", () => {
        render(<TarjetaPublicacion publicacion={{ ...publicacion, variedad: "-", precio: null }}/>);

        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.queryByText("Tomate - Perita")).not.toBeInTheDocument();
        expect(screen.getByText("Foto")).toBeInTheDocument();
        expect(screen.getByText("Consultar precio")).toBeInTheDocument();
        expect(screen.getByText("por Cajón")).toBeInTheDocument();
    });

    it("muestra la imagen cuando la publicación tiene foto", () => {
        render(<TarjetaPublicacion publicacion={{ ...publicacion, foto: "/tomate.jpg" }}/>);

        expect(screen.getByRole("img", { name: "Foto de Tomate" })).toHaveAttribute("src", "/tomate.jpg");
        expect(screen.queryByText("Foto")).not.toBeInTheDocument();
    });
});