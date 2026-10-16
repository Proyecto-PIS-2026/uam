// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PublicacionProductorListado } from "../../../consulta-mercado/acciones/PublicacionesProductor";

const mocks = vi.hoisted(() => ({
    compararPublicacionesPorPrioridad: vi.fn((
        a: { especie: string; variedad: string },
        b: { especie: string; variedad: string },
    ) => {
        const prioridad: Record<string, number> = { Manzana: 1, Banana: 2, Tomate: 3 };
        const diferencia = (prioridad[a.especie] ?? 99) - (prioridad[b.especie] ?? 99);
        return diferencia !== 0 ? diferencia : a.variedad.localeCompare(b.variedad, "es");
    }),
}));

type FiltrosProps = {
    publicaciones: PublicacionProductorListado[];
    especieFiltro: string;
    ordenInicial: string;
    alFiltrar?: (publicaciones: PublicacionProductorListado[]) => void;
    alLimpiar?: () => void;
    alCambiarEspecie?: (especie: string) => void;
};

type ListadoProps = {
    publicaciones: PublicacionProductorListado[];
};

vi.mock("../../filtros/FiltrosPublicacionesProductor", () => ({
    default: ({ publicaciones, especieFiltro, ordenInicial, alFiltrar, alLimpiar, alCambiarEspecie }: FiltrosProps) => (
        <section
            data-testid="filtros-publicaciones"
            data-cantidad={publicaciones.length}
            data-especie={especieFiltro}
            data-orden={ordenInicial}
        >
            <button type="button" onClick={() => alFiltrar?.(publicaciones.slice(0, 1))}>
                Filtrar una publicación
            </button>
            <button type="button" onClick={() => alCambiarEspecie?.("Tomate")}>
                Cambiar especie a Tomate
            </button>
            <button type="button" onClick={() => alCambiarEspecie?.("Todas")}>
                Seleccionar todas las especies
            </button>
            <button type="button" onClick={() => alLimpiar?.()}>
                Limpiar filtros
            </button>
        </section>
    ),
    compararPublicacionesPorPrioridad: mocks.compararPublicacionesPorPrioridad,
}));

vi.mock("../listado-publicaciones/ListadoPublicacionesProductor", () => ({
    default: ({ publicaciones }: ListadoProps) => (
        <div data-testid="listado-publicaciones" data-ids={publicaciones.map((publicacion) => publicacion.id).join(",")}>
            {publicaciones.map((publicacion) => (
                <span key={publicacion.id} data-testid="publicacion-id">{publicacion.id}</span>
            ))}
        </div>
    ),
}));

import ContenedorPublicacionesProductor from "./ContenedorPublicacionesProductor";

function crearPublicacion(id: number, especie: string, variedad: string): PublicacionProductorListado {
    return {
        id,
        precio: 100,
        fecha: "2026-10-16T12:00:00.000Z",
        foto: null,
        especie,
        variedad,
        presentacion: "Cajón",
        cantidadUnidades: 10,
        categoria: "I",
        calibre: "Grande",
        codigoCalibre: "G",
        pais: "Uruguay",
        productor: {
            id: 50,
            nombreFantasia: "Productor de prueba",
            fotoPerfil: null,
            whatsApp: "+59899123456",
        },
        ubicaciones: [],
    };
}

const publicaciones = [
    crearPublicacion(30, "Tomate", "Redondo"),
    crearPublicacion(10, "Manzana", "Gala"),
    crearPublicacion(20, "Manzana", "Verde"),
    crearPublicacion(40, "Banana", "Cavendish"),
];

function idsDelListado(): string[] {
    return screen.getAllByTestId("publicacion-id").map((elemento) => elemento.textContent ?? "");
}

describe("ContenedorPublicacionesProductor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState({}, "", "/publicaciones-productor?origen=prueba&especie=Manzana#resultados");
    });

    afterEach(() => {
        cleanup();
        window.history.replaceState({}, "", "/");
    });

    it("pasa todas las publicaciones a los filtros con orden inicial por prioridad", () => {
        render(<ContenedorPublicacionesProductor publicaciones={publicaciones} />);

        expect(screen.getByTestId("filtros-publicaciones").getAttribute("data-cantidad")).toBe("4");
        expect(screen.getByTestId("filtros-publicaciones").getAttribute("data-especie")).toBe("");
        expect(screen.getByTestId("filtros-publicaciones").getAttribute("data-orden")).toBe("prioridad");
        expect(idsDelListado()).toEqual(["10", "20", "40", "30"]);
        expect(mocks.compararPublicacionesPorPrioridad).toHaveBeenCalled();
    });

    it("filtra por la especie inicial si existe y ordena las publicaciones resultantes", () => {
        render(<ContenedorPublicacionesProductor publicaciones={publicaciones} especie="Manzana" />);

        expect(screen.getByTestId("filtros-publicaciones").getAttribute("data-especie")).toBe("Manzana");
        expect(screen.getByTestId("filtros-publicaciones").getAttribute("data-cantidad")).toBe("4");
        expect(idsDelListado()).toEqual(["10", "20"]);
    });

    it("ignora una especie inicial que no existe en las publicaciones", () => {
        render(<ContenedorPublicacionesProductor publicaciones={publicaciones} especie="Pera" />);

        expect(screen.getByTestId("filtros-publicaciones").getAttribute("data-especie")).toBe("");
        expect(idsDelListado()).toEqual(["10", "20", "40", "30"]);
    });

    it("muestra un listado vacío cuando no hay publicaciones", () => {
        render(<ContenedorPublicacionesProductor publicaciones={[]} especie="Manzana" />);

        expect(screen.getByTestId("filtros-publicaciones").getAttribute("data-cantidad")).toBe("0");
        expect(screen.getByTestId("filtros-publicaciones").getAttribute("data-especie")).toBe("");
        expect(screen.getByTestId("listado-publicaciones").getAttribute("data-ids")).toBe("");
        expect(screen.queryAllByTestId("publicacion-id")).toHaveLength(0);
    });

    it("no modifica el arreglo original al ordenar las publicaciones", () => {
        const publicacionesOriginales = [...publicaciones];

        render(<ContenedorPublicacionesProductor publicaciones={publicaciones} />);

        expect(publicaciones).toEqual(publicacionesOriginales);
        expect(publicaciones.map((publicacion) => publicacion.id)).toEqual([30, 10, 20, 40]);
    });

    it("actualiza el listado cuando el componente de filtros devuelve publicaciones filtradas", () => {
        render(<ContenedorPublicacionesProductor publicaciones={publicaciones} />);

        fireEvent.click(screen.getByRole("button", { name: "Filtrar una publicación" }));

        expect(idsDelListado()).toEqual(["30"]);
    });

    it("actualiza el parámetro especie de la URL sin perder otros parámetros ni el hash", () => {
        render(<ContenedorPublicacionesProductor publicaciones={publicaciones} />);

        fireEvent.click(screen.getByRole("button", { name: "Cambiar especie a Tomate" }));

        expect(window.location.pathname).toBe("/publicaciones-productor");
        expect(window.location.search).toBe("?origen=prueba&especie=Tomate");
        expect(window.location.hash).toBe("#resultados");
    });

    it("elimina el parámetro especie cuando se seleccionan todas las especies", () => {
        render(<ContenedorPublicacionesProductor publicaciones={publicaciones} />);

        fireEvent.click(screen.getByRole("button", { name: "Seleccionar todas las especies" }));

        expect(window.location.search).toBe("?origen=prueba");
        expect(window.location.hash).toBe("#resultados");
    });

    it("elimina el parámetro especie al limpiar los filtros", () => {
        render(<ContenedorPublicacionesProductor publicaciones={publicaciones} />);

        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

        expect(window.location.search).toBe("?origen=prueba");
        expect(window.location.hash).toBe("#resultados");
    });

    it("reinicia el contenido cuando cambia una especie válida recibida como propiedad", () => {
        const { rerender } = render(
            <ContenedorPublicacionesProductor publicaciones={publicaciones} especie="Manzana" />,
        );

        expect(idsDelListado()).toEqual(["10", "20"]);

        rerender(<ContenedorPublicacionesProductor publicaciones={publicaciones} especie="Tomate" />);

        expect(screen.getByTestId("filtros-publicaciones").getAttribute("data-especie")).toBe("Tomate");
        expect(idsDelListado()).toEqual(["30"]);
    });
});
