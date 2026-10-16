import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import CatalogoProductorAdmin from "./CatalogoProductorAdmin";
import type { PublicacionPerfilAdminProductor } from "../../consultas-perfil-productor-admin";

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
    categoria: "I",
    calibre: "G",
    codigoCalibre: "G",
    pais: "Uruguay",
    ubicaciones: [
        { nombre: "Ruta 3 km 500, Salto", urlMaps: "https://goo.gl/maps/salto1" },
        { nombre: "Ruta 5 km 200, Maldonado", urlMaps: "https://goo.gl/maps/maldonado1" },
    ],
};

describe("CatalogoProductorAdmin", () => {
    beforeEach(() => {
        cleanup();
    });

    afterEach(() => {
        cleanup();
    });

    // Sin publicaciones se informa y no hay tarjetas
    it("informa cuando el productor no tiene publicaciones", () => {
        render(<CatalogoProductorAdmin publicaciones={[]} />);

        expect(screen.getByText("El productor no tiene publicaciones.")).toBeInTheDocument();
        expect(screen.queryByRole("article")).not.toBeInTheDocument();
    });

    // Una tarjeta por publicación
    it("muestra una tarjeta por cada publicación", () => {
        render(
            <CatalogoProductorAdmin
                publicaciones={[publicacionBase, { ...publicacionBase, id: 202, especie: "Lechuga", variedad: "-" }]}
            />
        );

        expect(screen.getByRole("article", { name: "Ver detalles de Manzana - Red Delicious" })).toBeInTheDocument();
        expect(screen.getByRole("article", { name: "Ver detalles de Lechuga" })).toBeInTheDocument();
    });


});