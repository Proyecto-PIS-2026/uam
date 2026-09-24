import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import CatalogoOperador from "./CatalogoOperador";

// Reemplaza Image de Next por un img común
vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({src, alt}: {src: string; alt: string}) => createElement("img", {src, alt}),
    };
});

// Reemplaza el Drawer real para probar solamente el comportamiento del catálogo
vi.mock("./DrawerPublicacionPerfil", () => ({
    default: ({publicacion, open}: {publicacion: PublicacionPerfil | null; open: boolean}) =>
        open && publicacion ? <div data-testid="drawer">{publicacion.especie}</div> : null,
}));

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

const tomateCherry: PublicacionPerfil = {
    ...tomate,
    id: 2,
    precio: "150",
    variedad: "Cherry",
};

const manzana: PublicacionPerfil = {
    ...tomate,
    id: 3,
    precio: null,
    especie: "Manzana",
    variedad: "-",
};

describe("CatalogoOperador", () => {
    it("muestra el mensaje de vacío cuando no hay publicaciones", () => {
        render(<CatalogoOperador publicaciones={[]}/>);

        expect(screen.getByRole("heading", {name: "Publicaciones"})).toBeInTheDocument();
        expect(screen.getByText("Filtros")).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Agrupar por especie"})).toBeInTheDocument();
        expect(screen.getByText("No hay publicaciones disponibles.")).toBeInTheDocument();
        expect(screen.queryAllByRole("button", {name: /Ver detalles de/})).toHaveLength(0);
    });

    it("muestra una tarjeta por cada publicación", () => {
        render(<CatalogoOperador publicaciones={[tomate, manzana]}/>);

        expect(screen.getAllByRole("button", {name: /Ver detalles de/})).toHaveLength(2);
        expect(screen.getByText("Tomate - Perita")).toBeInTheDocument();
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.queryByText("No hay publicaciones disponibles.")).not.toBeInTheDocument();
    });

    it("agrupa las publicaciones por especie", () => {
        render(<CatalogoOperador publicaciones={[tomate, tomateCherry, manzana]}/>);

        const botonAgrupar = screen.getByRole("button", {name: "Agrupar por especie"});

        expect(botonAgrupar).toHaveAttribute("aria-pressed", "false");

        fireEvent.click(botonAgrupar);

        expect(screen.getByRole("button", {name: "Desagrupar"})).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("heading", {name: "Tomate", level: 3})).toBeInTheDocument();
        expect(screen.getAllByRole("heading", {name: "Manzana", level: 3})).toHaveLength(2);
        expect(screen.getAllByRole("button", {name: /Ver detalles de/})).toHaveLength(3);
    });

    it("muestra la cantidad de publicaciones de cada especie", () => {
        render(<CatalogoOperador publicaciones={[tomate, tomateCherry, manzana]}/>);

        fireEvent.click(screen.getByRole("button", {name: "Agrupar por especie"}));

        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText("productos")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("producto")).toBeInTheDocument();
    });

    it("permite desagrupar las publicaciones", () => {
        render(<CatalogoOperador publicaciones={[tomate, manzana]}/>);

        fireEvent.click(screen.getByRole("button", {name: "Agrupar por especie"}));

        expect(screen.getByRole("heading", {name: "Tomate", level: 3})).toBeInTheDocument();
        expect(screen.getAllByRole("heading", {name: "Manzana", level: 3})).toHaveLength(2);

        fireEvent.click(screen.getByRole("button", {name: "Desagrupar"}));

        expect(screen.getByRole("button", {name: "Agrupar por especie"})).toHaveAttribute("aria-pressed", "false");
        expect(screen.queryByRole("heading", {name: "Tomate", level: 3})).not.toBeInTheDocument();
        expect(screen.getAllByRole("heading", {name: "Manzana", level: 3})).toHaveLength(1);
        expect(screen.getAllByRole("button", {name: /Ver detalles de/})).toHaveLength(2);
    });

    it("abre el drawer con la publicación seleccionada", () => {
        render(<CatalogoOperador publicaciones={[tomate]}/>);

        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {name: "Ver detalles de Tomate - Perita"}));

        expect(screen.getByTestId("drawer")).toBeInTheDocument();
        expect(screen.getByTestId("drawer")).toHaveTextContent("Tomate");
    });

    it("abre el drawer desde una publicación agrupada", () => {
        render(<CatalogoOperador publicaciones={[tomate]}/>);

        fireEvent.click(screen.getByRole("button", {name: "Agrupar por especie"}));
        fireEvent.click(screen.getByRole("button", {name: "Ver detalles de Tomate - Perita"}));

        expect(screen.getByTestId("drawer")).toBeInTheDocument();
        expect(screen.getByTestId("drawer")).toHaveTextContent("Tomate");
    });

    it("muestra la sección de filtros", () => {
        render(<CatalogoOperador publicaciones={[tomate]}/>);

        expect(screen.getByText("Filtros")).toBeInTheDocument();
    });
});