import type { SwipeableDrawerProps } from "@mui/material/SwipeableDrawer";
import type { DialogProps } from "@mui/material/Dialog";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import MiMercadoProductor from "./MiMercadoProductor";

const mocks = vi.hoisted(() => ({ mediaQuery: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("../../productores/AltaPublicacionProductor", () => ({
    DrawerAltaPublicacionProductor: ({ abierto, alCerrar, alCrear }: { abierto: boolean; alCerrar: () => void; alCrear: (mensaje: string) => void }) => abierto ? (
        <section role="dialog" aria-label="Nueva publicación de Productor">
            <button onClick={alCerrar}>Cancelar alta</button>
            <button onClick={() => alCrear("Publicación creada correctamente.")}>Confirmar alta</button>
        </section>
    ) : null,
}));
vi.mock("@mui/material/useMediaQuery", () => ({ default: mocks.mediaQuery }));
vi.mock("@mui/material/SwipeableDrawer", () => ({
    default: ({ anchor, open, children, onClose }: SwipeableDrawerProps) => <section role="dialog" aria-label="Detalle de publicación" data-anchor={anchor} hidden={!open} onTouchEnd={onClose}>{children}</section>,
}));
vi.mock("@mui/material/Dialog", () => ({
    default: ({ open, children, "aria-label": etiqueta }: DialogProps) => open ? <section role="dialog" aria-label={etiqueta}>{children}</section> : null,
}));
vi.mock("../../componentes/drawer-publicacion/TextoAjustable", () => ({
    default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({ src, alt, onLoad, onError }: {
            src: string;
            alt: string;
            onLoad?: React.ReactEventHandler<HTMLImageElement>;
            onError?: React.ReactEventHandler<HTMLImageElement>;
        }) => createElement("img", { src, alt, onLoad, onError }),
    };
});

function crearPublicacion(id: number, especie: string, precio: string | null = "100"): PublicacionMiMercadoProductor {
    return {
        id,
        publicacionProductorId: id + 100,
        paisId: 1,
        pais: "Uruguay",
        foto: null,
        precio,
        fecha: "2026-10-16T14:00:00.000Z",
        publicacionActiva: true,
        publicacionDisponible: true,
        cantidadUnidades: 0,
        presentacion: {
            id,
            nombrePresentacion: "Cajón",
            variedad: {
                id,
                nombreVariedad: "-",
                especie: { id, nombreEspecie: especie, fotoEspecie: null },
            },
        },
        categoria: { id: 1, nombreCategoria: "Primera" },
        calibre: { id: 1, codigoCalibre: "G", nombreCalibre: "Grande" },
        ubicaciones: [{ id: 1, nombreUbicacion: "Quinta del productor", urlMaps: "https://maps.google.com/?q=Montevideo" }],
    };
}

describe("MiMercadoProductor", () => {
    beforeEach(() => {
        mocks.mediaQuery.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("muestra las publicaciones propias sin agrupar y el botón de alta junto al listado", () => {
        render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera"), crearPublicacion(2, "Manzana")]} nombreProductor="Mi quinta" />);

        expect(screen.getByRole("heading", { level: 1, name: "Mi Mercado" })).toBeInTheDocument();
        expect(screen.getAllByTitle(/Pera|Manzana/).map((titulo) => titulo.textContent)).toEqual(["Manzana", "Pera"]);
        expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
        expect(screen.getByRole("searchbox", { name: "Buscar publicaciones" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Agrupar|Desagrupar/i })).not.toBeInTheDocument();
        const encabezadoListado = screen.getByRole("heading", { level: 2, name: "Publicaciones" }).parentElement!;
        expect(within(encabezadoListado).getByRole("button", { name: "Nueva publicación" })).toBeDisabled();
        expect(screen.queryByRole("button", { name: /Editar|Eliminar|Aumentar precio|Disminuir precio/ })).not.toBeInTheDocument();
    });

    it("filtra y ordena sin consultar APIs de operador", () => {
        render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera", "40"), crearPublicacion(2, "Manzana", "80")]} />);

        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar publicaciones" }), { target: { value: "PERA" } });
        expect(screen.getByTitle("Pera")).toBeInTheDocument();
        expect(screen.queryByTitle("Manzana")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("button", { name: "Menor Precio" }));
        expect(screen.getAllByTitle(/Pera|Manzana/).map((titulo) => titulo.textContent)).toEqual(["Pera", "Manzana"]);
    });

    it.each([
        { esWeb: false, anchor: "bottom" },
        { esWeb: true, anchor: "right" },
    ])("abre el detalle desde $anchor con edición y eliminación deshabilitadas", ({ esWeb, anchor }) => {
        mocks.mediaQuery.mockReturnValue(esWeb);
        render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} />);

        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);
        const detalle = screen.getByRole("dialog", { name: "Detalle de publicación" });
        expect(detalle).toHaveAttribute("data-anchor", anchor);
        expect(within(detalle).getByText("Uruguay")).toBeInTheDocument();
        expect(within(detalle).getByText("0")).toBeInTheDocument();
        expect(within(detalle).getByRole("link", { name: "Quinta del productor" })).toHaveAttribute("href", "https://maps.google.com/?q=Montevideo");
        expect(within(detalle).queryByRole("textbox")).not.toBeInTheDocument();
        expect(within(detalle).getByRole("button", { name: "Editar" })).toBeDisabled();
        expect(within(detalle).getByRole("button", { name: "Eliminar" })).toBeDisabled();
        expect(within(detalle).queryByRole("button", { name: /Guardar|^Cerrar$/ })).not.toBeInTheDocument();
        expect(within(detalle).queryByRole("link", { name: "Ver Perfil" })).not.toBeInTheDocument();
        fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar consulta" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it.each([false, true])("abre el detalle desde toda la tarjeta con escritorio=%s", (esWeb) => {
        mocks.mediaQuery.mockReturnValue(esWeb);
        render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} />);
        const tarjeta = screen.getByRole("button", { name: "Ver detalle de Pera" });
        const zonas = [tarjeta, ...["$100", "Disponible", "Pera", "Sin fotografía", "›"].map((texto) => within(tarjeta).getByText(texto))];

        for (const zona of zonas) {
            fireEvent.click(zona);
            const detalle = screen.getByRole("dialog", { name: "Detalle de publicación" });
            expect(within(detalle).getByText("$100")).toBeInTheDocument();
            fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar consulta" }));
            expect(screen.queryByRole("dialog", { name: "Detalle de publicación" })).not.toBeInTheDocument();
        }
    });

    it("permite volver a abrir la publicación después del cierre solicitado por el drawer", () => {
        render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} />);

        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);
        fireEvent.touchEnd(screen.getByRole("dialog", { name: "Detalle de publicación" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
    });

    it("conserva los datos actualizados al recibir otras publicaciones", () => {
        const inicial = crearPublicacion(1, "Pera");
        const { rerender } = render(<MiMercadoProductor publicaciones={[inicial]} />);
        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);

        rerender(<MiMercadoProductor publicaciones={[{ ...inicial, precio: "150", publicacionDisponible: false }]} />);

        const detalle = screen.getByRole("dialog", { name: "Detalle de publicación" });
        expect(within(detalle).getByText("$150")).toBeInTheDocument();
        expect(within(detalle).getByText("No disponible")).toBeInTheDocument();
        rerender(<MiMercadoProductor publicaciones={[crearPublicacion(2, "Manzana")]} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByTitle("Manzana")).toBeInTheDocument();
        expect(screen.queryByTitle("Pera")).not.toBeInTheDocument();
    });

    it("muestra el estado vacío sin filtros ni acciones de operador", () => {
        render(<MiMercadoProductor publicaciones={[]} />);

        expect(screen.getByRole("heading", { name: "No tenés publicaciones" })).toBeInTheDocument();
        expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Nueva publicación" })).toBeDisabled();
        expect(screen.queryByRole("button", { name: /Editar|Eliminar|Aumentar precio|Disminuir precio/ })).not.toBeInTheDocument();
    });

    it("actualiza el listado y el contador después de la primera alta, sin recargar al cancelar", () => {
        const { rerender } = render(<MiMercadoProductor publicaciones={[]} productorId={4} />);
        expect(mocks.refresh).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancelar alta" }));
        expect(mocks.refresh).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar alta" }));
        expect(mocks.refresh).toHaveBeenCalledOnce();
        expect(screen.queryByRole("dialog", { name: "Nueva publicación de Productor" })).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Publicación creada correctamente.");

        rerender(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} productorId={4} />);
        expect(screen.getByTitle("Pera")).toBeInTheDocument();
        const encabezado = screen.getByRole("heading", { name: "Mi Mercado" }).closest("header")!;
        expect(within(encabezado).getByText("1 publicación", { exact: true })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "No tenés publicaciones" })).not.toBeInTheDocument();
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("mantiene los filtros al recibir el listado actualizado después del alta", () => {
        const publicaciones = [crearPublicacion(1, "Pera"), crearPublicacion(2, "Manzana")];
        const { rerender } = render(<MiMercadoProductor publicaciones={publicaciones} productorId={4} />);
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar publicaciones" }), { target: { value: "Pera" } });
        fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar alta" }));

        rerender(<MiMercadoProductor publicaciones={[...publicaciones, crearPublicacion(3, "Pera", "200")]} productorId={4} />);
        expect(mocks.refresh).toHaveBeenCalledOnce();
        expect(screen.getByRole("searchbox", { name: "Buscar publicaciones" })).toHaveValue("Pera");
        expect(screen.getAllByTitle("Pera")).toHaveLength(2);
        expect(screen.getByText("$200", { exact: true })).toBeInTheDocument();
        expect(screen.queryByTitle("Manzana")).not.toBeInTheDocument();
        expect(screen.getByText("3 publicaciones", { exact: true })).toBeInTheDocument();
    });

    it("muestra precios ausentes y ubicaciones sin enlaces inseguros", () => {
        const publicacion = crearPublicacion(1, "Pera", null);
        publicacion.ubicaciones = [{ id: 2, nombreUbicacion: "Quinta sin mapa", urlMaps: "javascript:alert(1)" }];
        render(<MiMercadoProductor publicaciones={[publicacion]} />);
        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);

        const detalle = screen.getByRole("dialog", { name: "Detalle de publicación" });
        expect(within(detalle).getByText("Consultar precio")).toBeInTheDocument();
        expect(within(detalle).getByText("Quinta sin mapa")).toBeInTheDocument();
        expect(within(detalle).queryByRole("link")).not.toBeInTheDocument();
    });

    it("muestra los valores en cero y el reemplazo cuando no hay foto ni puntos de retiro", () => {
        const publicacion = crearPublicacion(1, "Pera", "0");
        publicacion.ubicaciones = [];
        render(<MiMercadoProductor publicaciones={[publicacion]} />);
        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);

        const detalle = screen.getByRole("dialog", { name: "Detalle de publicación" });
        expect(within(detalle).getByText("$0")).toBeInTheDocument();
        expect(within(detalle).getByText("0")).toBeInTheDocument();
        expect(within(detalle).getByText("Foto")).toBeInTheDocument();
        expect(within(detalle).getByText("No hay puntos de retiro informados.")).toBeInTheDocument();
        expect(within(detalle).queryByRole("button", { name: /Ampliar foto/ })).not.toBeInTheDocument();
        expect(within(detalle).queryByRole("link", { name: /WhatsApp|Ver Perfil/ })).not.toBeInTheDocument();
    });

    it.each([
        { esWeb: false, anchor: "bottom" },
        { esWeb: true, anchor: "right" },
    ])("espera la foto y permite ampliarla y cerrarla desde $anchor", ({ esWeb, anchor }) => {
        mocks.mediaQuery.mockReturnValue(esWeb);
        const publicacion = { ...crearPublicacion(1, "Pera"), foto: "/pera.jpg" };
        render(<MiMercadoProductor publicaciones={[publicacion]} />);
        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        fireEvent.load(screen.getByAltText("Foto de Pera"));
        const detalle = screen.getByRole("dialog", { name: "Detalle de publicación" });
        expect(detalle).toHaveAttribute("data-anchor", anchor);
        fireEvent.click(within(detalle).getByRole("button", { name: "Ampliar foto de Pera" }));
        const fotoAmpliada = screen.getByRole("dialog", { name: "Foto ampliada del producto" });
        expect(within(fotoAmpliada).getByRole("img", { name: "Foto ampliada de Pera" })).toHaveAttribute("src", "/pera.jpg");
        fireEvent.click(within(fotoAmpliada).getByRole("button", { name: "Cerrar foto ampliada" }));

        expect(screen.queryByRole("dialog", { name: "Foto ampliada del producto" })).not.toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
        fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar consulta" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("permite abrir la consulta aunque falle la carga de la foto", () => {
        const publicacion = { ...crearPublicacion(1, "Pera"), foto: "/pera-no-disponible.jpg" };
        render(<MiMercadoProductor publicaciones={[publicacion]} />);
        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        fireEvent.error(screen.getByAltText("Foto de Pera"));

        const detalle = screen.getByRole("dialog", { name: "Detalle de publicación" });
        expect(within(detalle).getByText("Foto")).toBeInTheDocument();
        expect(within(detalle).getByText("$100")).toBeInTheDocument();
        expect(within(detalle).queryByRole("img")).not.toBeInTheDocument();
        fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar consulta" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("prepara la nueva foto cuando cambia la publicación seleccionada", () => {
        const publicacion = { ...crearPublicacion(1, "Pera"), foto: "/pera.jpg" };
        const { rerender } = render(<MiMercadoProductor publicaciones={[publicacion]} />);
        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);
        fireEvent.load(screen.getByAltText("Foto de Pera"));
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();

        rerender(<MiMercadoProductor publicaciones={[{ ...publicacion, foto: "/pera-actualizada.jpg", precio: "125.00" }]} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        fireEvent.load(screen.getByAltText("Foto de Pera"));

        const detalle = screen.getByRole("dialog", { name: "Detalle de publicación" });
        expect(within(detalle).getByRole("img", { name: "Foto de Pera" })).toHaveAttribute("src", "/pera-actualizada.jpg");
        expect(within(detalle).getByText("$125")).toBeInTheDocument();
    });
});
