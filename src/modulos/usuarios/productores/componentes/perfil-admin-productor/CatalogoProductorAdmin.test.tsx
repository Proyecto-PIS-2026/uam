import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import CatalogoProductorAdmin from "./CatalogoProductorAdmin";
import type { PublicacionPerfilAdminProductor } from "../../acciones/consultas-perfil-productor-admin";
import type { PublicacionMiMercadoProductor } from "../../../../publicaciones/mi-mercado/consultas-mi-mercado-productor";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), bajaPendiente: vi.fn<(completar: () => void) => void>() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("../../../../publicaciones/mi-mercado/componentes/DrawerPublicacionProductor", () => ({
    default: ({ publicacion, alCerrar, alGuardar, alEliminada }: {
        publicacion: PublicacionMiMercadoProductor | null;
        alCerrar: () => void;
        alGuardar?: (publicacion: PublicacionMiMercadoProductor) => void;
        alEliminada?: (mensaje: string) => void;
    }) => publicacion ? (
        <section role="dialog" aria-label="Detalle de publicación">
            <h2>{publicacion.especie.nombreEspecie}</h2>
            <p>{publicacion.pais}</p>
            {publicacion.ubicaciones.map((ubicacion) => <p key={ubicacion.id}>{ubicacion.nombreUbicacion}</p>)}
            <button type="button" onClick={alCerrar}>Cerrar consulta</button>
            <button type="button" onClick={() => {
                alCerrar();
                alEliminada?.("Publicación eliminada correctamente.");
            }}>Eliminar publicación</button>
            <button type="button" onClick={() => mocks.bajaPendiente(() => alEliminada?.("Publicación eliminada correctamente."))}>Iniciar baja pendiente</button>
            <button type="button" onClick={() => alGuardar?.({
                ...publicacion,
                precio: "125.50",
                publicacionDisponible: false,
                categoria: { id: 8, nombreCategoria: "Extra" },
                ubicaciones: [{ id: 91, nombreUbicacion: "Nuevo punto de retiro", urlMaps: "https://maps.google.com/" }],
            })}>Guardar cambios</button>
        </section>
    ) : null,
}));

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
        vi.clearAllMocks();
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

    it("abre la publicación elegida con sus puntos de retiro y permite cerrar la consulta", () => {
        render(<CatalogoProductorAdmin publicaciones={[
            publicacionBase,
            { ...publicacionBase, id: 202, publicacionProductorId: 302, especie: "Lechuga", variedad: "-" },
        ]} />);

        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Lechuga" }));

        const consulta = screen.getByRole("dialog", { name: "Detalle de publicación" });
        expect(within(consulta).getByRole("heading", { name: "Lechuga" })).toBeInTheDocument();
        expect(within(consulta).getByText("Uruguay")).toBeInTheDocument();
        expect(within(consulta).getByText("Ruta 3 km 500, Salto")).toBeInTheDocument();
        expect(within(consulta).getByText("Ruta 5 km 200, Maldonado")).toBeInTheDocument();

        fireEvent.click(within(consulta).getByRole("button", { name: "Cerrar consulta" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("actualiza la tarjeta y conserva el detalle guardado al volver a abrirlo", () => {
        render(<CatalogoProductorAdmin publicaciones={[publicacionBase]} />);

        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Manzana - Red Delicious" }));
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        const tarjeta = screen.getByRole("article", { name: "Ver detalles de Manzana - Red Delicious" });
        expect(within(tarjeta).getByText(/125,5/)).toBeInTheDocument();
        expect(within(tarjeta).getByText("No disponible")).toBeInTheDocument();
        expect(within(tarjeta).getAllByText(/Extra/).length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole("button", { name: "Cerrar consulta" }));
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Manzana - Red Delicious" }));
        expect(within(screen.getByRole("dialog")).getByText("Nuevo punto de retiro")).toBeInTheDocument();
    });

    it("retira la publicación eliminada y conserva los cambios de las demás publicaciones", async () => {
        render(<CatalogoProductorAdmin publicaciones={[
            publicacionBase,
            { ...publicacionBase, id: 202, publicacionProductorId: 302, especie: "Lechuga", variedad: "-" },
        ]} />);

        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Manzana - Red Delicious" }));
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        fireEvent.click(screen.getByRole("button", { name: "Cerrar consulta" }));
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Lechuga" }));
        fireEvent.click(screen.getByRole("button", { name: "Eliminar publicación" }));

        expect(screen.queryByRole("article", { name: "Ver detalles de Lechuga" })).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Publicación eliminada correctamente.");
        expect(mocks.refresh).toHaveBeenCalledOnce();
        const tarjeta = screen.getByRole("article", { name: "Ver detalles de Manzana - Red Delicious" });
        expect(within(tarjeta).getByText(/125,5/)).toBeInTheDocument();
        expect(within(tarjeta).getByText("No disponible")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Manzana - Red Delicious" }));
        expect(within(screen.getByRole("dialog")).getByText("Nuevo punto de retiro")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
        await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    });

    it("conserva la selección nueva cuando termina la baja de otra publicación", () => {
        render(<CatalogoProductorAdmin publicaciones={[
            publicacionBase,
            { ...publicacionBase, id: 202, publicacionProductorId: 302, especie: "Lechuga", variedad: "-" },
        ]} />);
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Manzana - Red Delicious" }));
        fireEvent.click(screen.getByRole("button", { name: "Iniciar baja pendiente" }));
        const completarBajaAnterior = mocks.bajaPendiente.mock.calls[0][0];

        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Lechuga" }));
        expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Lechuga" })).toBeInTheDocument();
        act(() => completarBajaAnterior());

        expect(screen.queryByRole("article", { name: "Ver detalles de Manzana - Red Delicious" })).not.toBeInTheDocument();
        expect(screen.getByRole("article", { name: "Ver detalles de Lechuga" })).toBeInTheDocument();
        expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Lechuga" })).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Publicación eliminada correctamente.");
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("muestra el catálogo vacío al eliminar la última publicación y acepta nuevas publicaciones del servidor", () => {
        const { rerender } = render(<CatalogoProductorAdmin publicaciones={[publicacionBase]} />);
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Manzana - Red Delicious" }));
        fireEvent.click(screen.getByRole("button", { name: "Eliminar publicación" }));

        expect(screen.getByText("El productor no tiene publicaciones.")).toBeInTheDocument();
        expect(screen.queryByRole("article")).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        rerender(<CatalogoProductorAdmin publicaciones={[
            { ...publicacionBase, id: 202, publicacionProductorId: 302, especie: "Lechuga", variedad: "-" },
        ]} />);

        expect(screen.getByRole("article", { name: "Ver detalles de Lechuga" })).toBeInTheDocument();
        expect(screen.queryByRole("article", { name: "Ver detalles de Manzana - Red Delicious" })).not.toBeInTheDocument();
    });

    it("incorpora nuevas publicaciones del servidor después de una edición local", () => {
        const { rerender } = render(<CatalogoProductorAdmin publicaciones={[publicacionBase]} />);
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Manzana - Red Delicious" }));
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        rerender(<CatalogoProductorAdmin publicaciones={[{
            ...publicacionBase,
            precio: "175.00",
            ubicaciones: [{ nombre: "Punto actualizado en el servidor", urlMaps: "https://maps.google.com/" }],
        }]} />);

        const tarjeta = screen.getByRole("article", { name: "Ver detalles de Manzana - Red Delicious" });
        expect(within(tarjeta).getByText(/175/)).toBeInTheDocument();
        expect(within(tarjeta).getByText("Disponible")).toBeInTheDocument();
        expect(within(screen.getByRole("dialog")).getByText("Punto actualizado en el servidor")).toBeInTheDocument();
    });

    it("cierra el detalle si la publicación seleccionada deja de estar en el catálogo", () => {
        const { rerender } = render(<CatalogoProductorAdmin publicaciones={[publicacionBase]} />);
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Manzana - Red Delicious" }));

        rerender(<CatalogoProductorAdmin publicaciones={[]} />);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("El productor no tiene publicaciones.")).toBeInTheDocument();
    });

});
