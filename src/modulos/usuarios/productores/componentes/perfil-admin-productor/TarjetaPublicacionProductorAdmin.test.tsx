import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';  
import TarjetaPublicacionProductorAdmin from './TarjetaPublicacionProductorAdmin';
import type { PublicacionPerfilAdminProductor } from '../../consultas-perfil-productor-admin';

const publicacionBase: PublicacionPerfilAdminProductor = {
    id: 201,
    publicacionProductorId: 301,
    especieId: 5,
    variedadId: 12,
    presentacionId: 7,
    categoriaId: 3,
    calibreId: 4,
    paisId: 1,
    foto: null,
    precio: "90.00",
    cantidadUnidades: 15,
    fecha: "2026-10-01T12:00:00Z",
    disponible: true,
    especie: "Manzana",
    variedad: "Red Delicious",
    presentacion: "Cajón",
    categoria: "Extra",
    calibre: "Grande",
    codigoCalibre: "G",
    pais: "Uruguay",
    ubicaciones: [
        { nombre: "Ruta 3 km 500, Salto", urlMaps: "https://goo.gl/maps/salto1" },
        { nombre: "Ruta 5 km 200, Maldonado", urlMaps: "https://goo.gl/maps/maldonado1" },
    ],
};

describe ('TarjetaPublicacionProductorAdmin', () => {
    afterEach(() => {
        cleanup();
    });

    // Muestra los datos principales de la publicación
    it('muestra el producto, el calibre, la categoría, la presentación y el precio', () => {
        render(<TarjetaPublicacionProductorAdmin publicacion={publicacionBase} />);
 
        expect(screen.getByRole("heading", { name: "Manzana - Red Delicious" })).toBeInTheDocument();
        expect(screen.getAllByText(/Grande/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Extra/).length).toBeGreaterThan(0);
        expect(screen.getByText("por Cajón")).toBeInTheDocument();
        expect(screen.getByText(/90/)).toBeInTheDocument();
    });

    // Si la variedad es "-", el nombre es solo la especie
    it("muestra solo la especie cuando no hay variedad", () => {
        render(<TarjetaPublicacionProductorAdmin publicacion={{ ...publicacionBase, variedad: "-" }} />);

        expect(screen.getByRole("heading", { name: "Manzana" })).toBeInTheDocument();
    });

    // Sin precio cargado se indica explícitamente
    it("muestra 'Sin precio' cuando la publicación no tiene precio", () => {
        render(<TarjetaPublicacionProductorAdmin publicacion={{ ...publicacionBase, precio: null }} />);

        expect(screen.getByText("Sin precio")).toBeInTheDocument();
    });

    // La etiqueta refleja la disponibilidad
    it.each([
        { disponible: true, texto: "Disponible" },
        { disponible: false, texto: "No disponible" },
    ])("muestra la etiqueta '$texto'", ({ disponible, texto }) => {
        render(<TarjetaPublicacionProductorAdmin publicacion={{ ...publicacionBase, disponible }} />);

        expect(screen.getByText(texto)).toBeInTheDocument();
    });

});