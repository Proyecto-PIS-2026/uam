import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';  
import TarjetaPublicacionAdmin from './TarjetaPublicacionAdmin';
import type { PublicacionPerfilAdmin } from '../../consultas-perfil-admin';

const publicacionBase: PublicacionPerfilAdmin = {
    id: 101,
    publicacionOperadorId: 15,
    especieId: 1,
    variedadId: 11,
    presentacionId: 111,
    categoriaId: 3,
    calibreId: 4,
    paisId: 44,
    foto: null,
    precio: "120.00",
    disponible: true,
    especie: "Tomate",
    variedad: "Perita",
    presentacion: "Cajón",
    categoria: "Extra",
    calibre: "Grande",
    codigoCalibre: "G",
    pais: "Uruguay",
};

describe ('TarjetaPublicacionAdmin', () => {
    afterEach(() => {
        cleanup();
    });

    // Muestra los datos principales de la publicación
    it('muestra el producto, el calibre, la categoría, la presentación y el precio', () => {
        render(<TarjetaPublicacionAdmin publicacion={publicacionBase} />);

        expect(screen.getByRole("heading", { name: "Tomate - Perita" })).toBeInTheDocument();
        expect(screen.getAllByText(/Grande/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Extra/).length).toBeGreaterThan(0);
        expect(screen.getByText("por Cajón")).toBeInTheDocument();
        expect(screen.getByText(/120/)).toBeInTheDocument();
    });


    // Si la variedad es "-", el nombre es solo la especie
    it("muestra solo la especie cuando no hay variedad", () => {
        render(<TarjetaPublicacionAdmin publicacion={{ ...publicacionBase, variedad: "-" }} />);

        expect(screen.getByRole("heading", { name: "Tomate" })).toBeInTheDocument();
    });

    // Sin precio cargado se indica explícitamente
    it("muestra 'Sin precio' cuando la publicación no tiene precio", () => {
        render(<TarjetaPublicacionAdmin publicacion={{ ...publicacionBase, precio: null }} />);

        expect(screen.getByText("Sin precio")).toBeInTheDocument();
    });

    // La etiqueta refleja la disponibilidad
    it.each([
        { disponible: true, texto: "Disponible" },
        { disponible: false, texto: "No disponible" },
    ])("muestra la etiqueta '$texto'", ({ disponible, texto }) => {
        render(<TarjetaPublicacionAdmin publicacion={{ ...publicacionBase, disponible }} />);

        expect(screen.getByText(texto)).toBeInTheDocument();
    });

    // Al tocarla avisa qué publicación se seleccionó
    it("llama a onSeleccionar con la publicación al tocar la tarjeta", () => {
        const onSeleccionar = vi.fn();
        render(<TarjetaPublicacionAdmin publicacion={publicacionBase} onSeleccionar={onSeleccionar} />);

        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tomate - Perita" }));

        expect(onSeleccionar).toHaveBeenCalledOnce();
        expect(onSeleccionar).toHaveBeenCalledWith(publicacionBase);
    });

    // Sin onSeleccionar, tocarla no rompe nada
    it("no falla al tocarla si no se pasa onSeleccionar", () => {
        render(<TarjetaPublicacionAdmin publicacion={publicacionBase} />);

        expect(() => fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tomate - Perita" }))).not.toThrow();
    });

});