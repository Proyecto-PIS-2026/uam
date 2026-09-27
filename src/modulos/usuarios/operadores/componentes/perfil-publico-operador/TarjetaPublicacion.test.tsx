import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import TarjetaPublicacion from "./TarjetaPublicacion";

// Reemplaza Image de Next por un img comun durante los tests
vi.mock("next/image", async () => {
    const { createElement } = await import("react");

    return {
        default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt })
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
    // Verifica que se muestren los datos principales de una publicacion con precio
    it("muestra los datos y el precio del producto", () => {
        render(<TarjetaPublicacion publicacion={publicacion} />);
        expect(screen.getByText("Tomate - Perita")).toBeInTheDocument();
        expect(screen.getByText("A")).toBeInTheDocument();
        expect(screen.getByText("Extra")).toBeInTheDocument();
        expect(screen.getByText((contenido) => contenido.replace(/\s/g, "") === "$120")).toBeInTheDocument();
        expect(screen.getByText("por Cajón")).toBeInTheDocument();
    });

    // Verifica el comportamiento cuando no hay variedad, precio ni foto
    it("muestra solo la especie, la foto alternativa y la consulta de precio cuando faltan datos", () => {
        render(<TarjetaPublicacion publicacion={{ ...publicacion, variedad: "-", precio: null, foto: null}}/>);
        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.queryByText("Tomate - Perita")).not.toBeInTheDocument();
        expect(screen.getByText("Foto")).toBeInTheDocument();
        expect(screen.getByText("Sin foto disponible")).toBeInTheDocument();
        expect(screen.getByText("Consultar precio")).toBeInTheDocument();
        expect(screen.getByText("por Cajón")).toBeInTheDocument();
    });

    // Verifica que se muestre la imagen cuando la publicacion tiene foto
    it("muestra la imagen cuando la publicación tiene foto", () => {
        render(<TarjetaPublicacion publicacion={{...publicacion, foto: "/tomate.jpg"}}/>);
        expect(screen.getByRole("img", {name: "Foto de Tomate - Perita",})).toHaveAttribute("src", "/tomate.jpg");
        expect(screen.queryByText("Foto")).not.toBeInTheDocument();
        expect(screen.queryByText("Sin foto disponible")).not.toBeInTheDocument();
    });

    // Verifica que se invoque la funcion de seleccion al hacer clic en la tarjeta
    it("selecciona la publicación al hacer clic en la tarjeta", () => {
        const onSeleccionar = vi.fn();
        render(<TarjetaPublicacion publicacion={publicacion} onSeleccionar={onSeleccionar}/>);
        fireEvent.click(screen.getByRole("button", {name: "Ver detalles de Tomate - Perita"}));
        expect(onSeleccionar).toHaveBeenCalledTimes(1);
        expect(onSeleccionar).toHaveBeenCalledWith(publicacion);
    });

    // Verifica que la tarjeta funcione aunque no se proporcione onSeleccionar
    it("permite hacer clic aunque no tenga onSeleccionar", () => {
        render(<TarjetaPublicacion publicacion={publicacion} />);
        const boton = screen.getByRole("button", {name: "Ver detalles de Tomate - Perita"});
        expect(() => fireEvent.click(boton)).not.toThrow();
    });
});