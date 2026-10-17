// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicacionProductorListado } from "../../../consulta-mercado/acciones/PublicacionesProductor";

const mocks = vi.hoisted(() => ({
    useMediaQuery: vi.fn(() => false),
}));

vi.mock("@mui/material/useMediaQuery", () => ({
    default: mocks.useMediaQuery,
}));

vi.mock("@mui/icons-material/ViewList", () => ({
    default: () => <span data-testid="icono-vista-lista" />,
}));

vi.mock("@mui/icons-material/ViewModule", () => ({
    default: () => <span data-testid="icono-vista-modulos" />,
}));

vi.mock("@mui/icons-material/KeyboardArrowUp", () => ({
    default: () => <span data-testid="icono-arriba" />,
}));

vi.mock("@/modulos/publicaciones/componentes/tarjetas-publicacion/TarjetaPublicacionConProductor", () => ({
    default: ({
        publicacion,
        onClick,
    }: {
        publicacion: PublicacionProductorListado;
        onClick: () => void;
    }) => (
        <button
            type="button"
            data-testid="tarjeta-con-productor"
            data-publicacion-id={publicacion.id}
            onClick={onClick}
        >
            {publicacion.especie}
        </button>
    ),
}));

vi.mock("@/modulos/publicaciones/componentes/tarjetas-publicacion/TarjetaPublicacionSinProductor", () => ({
    default: ({
        publicacion,
        onClick,
    }: {
        publicacion: PublicacionProductorListado;
        onClick: () => void;
    }) => (
        <button
            type="button"
            data-testid="tarjeta-sin-productor"
            data-publicacion-id={publicacion.id}
            onClick={onClick}
        >
            {publicacion.especie}
        </button>
    ),
}));

vi.mock("@/modulos/publicaciones/componentes/drawer-publicacion/DrawerDerechaPublicacion", () => ({
    DrawerDerechaPublicacion: ({
        publicacion,
        open,
        onOpenChange,
    }: {
        publicacion: PublicacionProductorListado | null;
        open: boolean;
        onOpenChange: (open: boolean) => void;
    }) => (
        <section
            data-testid="drawer-derecha-productor"
            data-publicacion-id={publicacion?.id ?? ""}
            data-open={String(open)}
        >
            <button type="button" onClick={() => onOpenChange(false)}>
                Cerrar drawer derecho
            </button>
        </section>
    ),
}));

vi.mock("@/modulos/publicaciones/componentes/drawer-publicacion/DrawerAbajoPublicacion", () => ({
    DrawerAbajoPublicacion: ({
        publicacion,
        open,
        onOpenChange,
    }: {
        publicacion: PublicacionProductorListado | null;
        open: boolean;
        onOpenChange: (open: boolean) => void;
    }) => (
        <section
            data-testid="drawer-abajo-productor"
            data-publicacion-id={publicacion?.id ?? ""}
            data-open={String(open)}
        >
            <button type="button" onClick={() => onOpenChange(false)}>
                Cerrar drawer inferior
            </button>
        </section>
    ),
}));

import ListadoPublicacionesProductor from "./ListadoPublicacionesProductor";

function crearPublicacion(
    id: number,
    productorId: number,
    nombreFantasia: string,
    especie = `Especie ${id}`,
): PublicacionProductorListado {
    return {
        id,
        precio: 100 + id,
        fecha: "2026-10-16T12:00:00.000Z",
        foto: null,
        especie,
        variedad: "Variedad",
        presentacion: "Cajón",
        cantidadUnidades: 10,
        categoria: "I",
        calibre: "Grande",
        codigoCalibre: "G",
        pais: "Uruguay",
        productor: {
            id: productorId,
            nombreFantasia,
            fotoPerfil: null,
            whatsApp: "+59899123456",
        },
        ubicaciones: [],
    };
}

const publicaciones = [
    crearPublicacion(101, 1, "Productor Norte", "Manzana"),
    crearPublicacion(102, 1, "Productor Norte", "Pera"),
    crearPublicacion(201, 2, "Productor Sur", "Tomate"),
];

function establecerScrollY(valor: number) {
    Object.defineProperty(window, "scrollY", {
        configurable: true,
        value: valor,
    });
}

describe("ListadoPublicacionesProductor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useMediaQuery.mockReturnValue(false);
        establecerScrollY(0);
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.restoreAllMocks();
        establecerScrollY(0);
    });

    it("muestra el mensaje de estado cuando no hay publicaciones", () => {
        render(<ListadoPublicacionesProductor publicaciones={[]} />);

        expect(screen.getByRole("status").textContent).toContain(
            "No hay publicaciones que coincidan con la búsqueda.",
        );
        expect(screen.queryByRole("heading", { name: "Publicaciones de productores" })).toBeNull();
        expect(screen.queryByTestId("tarjeta-con-productor")).toBeNull();
        expect(screen.queryByRole("button", { name: "Agrupar" })).toBeNull();
    });

    it("muestra el título y todas las tarjetas en la vista sin agrupar", () => {
        render(<ListadoPublicacionesProductor publicaciones={publicaciones} />);

        expect(screen.getByRole("heading", { name: "Publicaciones de productores" })).toBeTruthy();
        expect(screen.getAllByTestId("tarjeta-con-productor")).toHaveLength(3);
        expect(screen.queryByTestId("tarjeta-sin-productor")).toBeNull();
        expect(screen.getByRole("button", { name: /Agrupar/ })).toBeTruthy();
        expect(screen.getByTestId("icono-vista-modulos")).toBeTruthy();
    });

    it("agrupa las publicaciones por ID de productor y muestra la cantidad de productos", () => {
        render(<ListadoPublicacionesProductor publicaciones={publicaciones} />);

        fireEvent.click(screen.getByRole("button", { name: /Agrupar/ }));

        expect(screen.getByRole("heading", { name: "Productor Norte" })).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Productor Sur" })).toBeTruthy();
        expect(screen.getAllByTestId("tarjeta-sin-productor")).toHaveLength(3);
        expect(screen.queryByTestId("tarjeta-con-productor")).toBeNull();
        expect(screen.getByText("2")).toBeTruthy();
        expect(screen.getByText("1")).toBeTruthy();
        expect(screen.getByRole("button", { name: /Desagrupar/ })).toBeTruthy();
        expect(screen.getByTestId("icono-vista-lista")).toBeTruthy();
    });

    it("vuelve a la vista sin agrupar al pulsar Desagrupar", () => {
        render(<ListadoPublicacionesProductor publicaciones={publicaciones} />);

        fireEvent.click(screen.getByRole("button", { name: /Agrupar/ }));
        fireEvent.click(screen.getByRole("button", { name: /Desagrupar/ }));

        expect(screen.getAllByTestId("tarjeta-con-productor")).toHaveLength(3);
        expect(screen.queryByTestId("tarjeta-sin-productor")).toBeNull();
        expect(screen.queryByRole("heading", { name: "Productor Norte" })).toBeNull();
    });

    it("agrupa de forma independiente productores diferentes con el mismo nombre de fantasía", () => {
        const publicacionesMismoNombre = [
            crearPublicacion(1, 10, "Productor Compartido"),
            crearPublicacion(2, 20, "Productor Compartido"),
        ];
        render(<ListadoPublicacionesProductor publicaciones={publicacionesMismoNombre} />);

        fireEvent.click(screen.getByRole("button", { name: /Agrupar/ }));

        expect(screen.getAllByRole("heading", { name: "Productor Compartido" })).toHaveLength(2);
    });

    it("abre el drawer lateral en desktop con la publicación seleccionada", () => {
        mocks.useMediaQuery.mockReturnValue(false);
        render(<ListadoPublicacionesProductor publicaciones={publicaciones} />);

        fireEvent.click(screen.getAllByTestId("tarjeta-con-productor")[1]);

        const drawer = screen.getByTestId("drawer-derecha-productor");
        expect(drawer.getAttribute("data-publicacion-id")).toBe("102");
        expect(drawer.getAttribute("data-open")).toBe("true");
        expect(screen.queryByTestId("drawer-abajo-productor")).toBeNull();
    });

    it("cierra el drawer lateral a través de onOpenChange", () => {
        render(<ListadoPublicacionesProductor publicaciones={publicaciones} />);

        fireEvent.click(screen.getAllByTestId("tarjeta-con-productor")[0]);
        fireEvent.click(screen.getByRole("button", { name: "Cerrar drawer derecho" }));

        expect(screen.getByTestId("drawer-derecha-productor").getAttribute("data-open")).toBe("false");
    });

    it("abre el drawer inferior en mobile", () => {
        mocks.useMediaQuery.mockReturnValue(true);
        render(<ListadoPublicacionesProductor publicaciones={publicaciones} />);

        fireEvent.click(screen.getAllByTestId("tarjeta-con-productor")[2]);

        const drawer = screen.getByTestId("drawer-abajo-productor");
        expect(drawer.getAttribute("data-publicacion-id")).toBe("201");
        expect(drawer.getAttribute("data-open")).toBe("true");
        expect(screen.queryByTestId("drawer-derecha-productor")).toBeNull();
    });

    it("cierra el drawer inferior a través de onOpenChange", () => {
        mocks.useMediaQuery.mockReturnValue(true);
        render(<ListadoPublicacionesProductor publicaciones={publicaciones} />);

        fireEvent.click(screen.getAllByTestId("tarjeta-con-productor")[0]);
        fireEvent.click(screen.getByRole("button", { name: "Cerrar drawer inferior" }));

        expect(screen.getByTestId("drawer-abajo-productor").getAttribute("data-open")).toBe("false");
    });

    it("muestra el botón de volver arriba al desplazar más de 400 píxeles y ejecuta scrollTo", () => {
        const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
        render(<ListadoPublicacionesProductor publicaciones={publicaciones} />);

        expect(screen.queryByRole("button", { name: "Volver arriba" })).toBeNull();

        establecerScrollY(401);
        fireEvent.scroll(window);

        const botonArriba = screen.getByRole("button", { name: "Volver arriba" });
        expect(botonArriba).toBeTruthy();
        fireEvent.click(botonArriba);
        expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });

    it("inicia y finaliza la animación de salida del botón al volver arriba", () => {
        vi.useFakeTimers();
        render(<ListadoPublicacionesProductor publicaciones={publicaciones} />);

        establecerScrollY(500);
        fireEvent.scroll(window);
        const botonVisible = screen.getByRole("button", { name: "Volver arriba" });
        const claseVisible = botonVisible.className;

        establecerScrollY(0);
        fireEvent.scroll(window);
        const botonSaliendo = screen.getByRole("button", { name: "Volver arriba" });
        expect(botonSaliendo.className).not.toBe(claseVisible);

        act(() => {
            vi.advanceTimersByTime(400);
        });
        expect(screen.queryByRole("button", { name: "Volver arriba" })).toBeNull();
    });

    it("registra el listener de scroll incluso cuando la lista está vacía y lo limpia al desmontar", () => {
        const addListener = vi.spyOn(window, "addEventListener");
        const removeListener = vi.spyOn(window, "removeEventListener");
        const { unmount } = render(<ListadoPublicacionesProductor publicaciones={[]} />);

        expect(addListener).toHaveBeenCalledWith("scroll", expect.any(Function));
        unmount();
        expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function));
    });

    it("conserva el contenido del listado y permite abrir una tarjeta dentro de un grupo", () => {
        mocks.useMediaQuery.mockReturnValue(false);
        render(<ListadoPublicacionesProductor publicaciones={publicaciones} />);
        fireEvent.click(screen.getByRole("button", { name: /Agrupar/ }));

        const grupo = screen.getByRole("heading", { name: "Productor Norte" }).parentElement?.parentElement;
        expect(grupo).not.toBeNull();
        const tarjeta = within(grupo as HTMLElement).getAllByTestId("tarjeta-sin-productor")[0];
        fireEvent.click(tarjeta);

        expect(screen.getByTestId("drawer-derecha-productor").getAttribute("data-publicacion-id")).toBe("101");
        expect(screen.getByTestId("drawer-derecha-productor").getAttribute("data-open")).toBe("true");
    });
});
