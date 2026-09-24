import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import CatalogoOperador from "./CatalogoOperador";

// Reemplazar Image de next por un img comun
vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({ src, alt }: { src: string; alt: string }) =>
            createElement("img", { src, alt }),
    };
});

// Datos de prueba
const tomate: PublicacionPerfil = {
    id: 1,
    foto: null,
    precio: "120",
    especie: "Tomate",
    variedad: "Perita",
    presentacion: "Cajón",
    categoria: "Extra",
    calibre: "A",
};

describe("CatalogoOperador", () => {
    it("muestra el mensaje de vacío cuando no hay publicaciones", () => {
        render(<CatalogoOperador publicaciones={[]} />);

        expect(screen.getByRole("heading", { name: "Productos" })).toBeInTheDocument();
        expect(screen.getByText("No hay publicaciones disponibles.")).toBeInTheDocument();
        expect(screen.queryAllByRole("article")).toHaveLength(0);
    });

    it("muestra una tarjeta por cada publicación", () => {
        const manzana: PublicacionPerfil = {
            ...tomate,
            id: 2,
            especie: "Manzana",
            variedad: "-",
            precio: null,
        };

        render(<CatalogoOperador publicaciones={[tomate, manzana]} />);

        expect(screen.getAllByRole("article")).toHaveLength(2);
        expect(screen.getByText("Tomate - Perita")).toBeInTheDocument();
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.queryByText("No hay publicaciones disponibles.")).not.toBeInTheDocument();
    });
});