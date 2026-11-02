
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type {
    EstadisticaVisitaItem,
    EstadisticaContactoItem,
    EstadisticaPublicacionItem,
} from "./Tipos";

import ContenedorEstadistica from "./ContenedorEstadistica";

vi.mock("./BloqueEstadistica", () => ({
    default: ({
        titulo,
        tipo,
        datos,
    }: {
        titulo: string;
        tipo: string;
        datos: EstadisticaVisitaItem[];
    }) => (
        <div
            data-testid="bloque-visitas"
            data-titulo={titulo}
            data-tipo={tipo}
            data-datos={JSON.stringify(datos)}
        />
    ),
}));

vi.mock("./BloqueEstadisticaComparativa", () => ({
    default: ({
        contactos,
        publicaciones,
        opcionesFiltroEspecifico,
    }: {
        contactos: EstadisticaContactoItem[];
        publicaciones: EstadisticaPublicacionItem[];
        opcionesFiltroEspecifico: Array<{
            valor: string;
            etiqueta: string;
        }>;
    }) => (
        <div
            data-testid="bloque-comparativo"
            data-contactos={JSON.stringify(contactos)}
            data-publicaciones={JSON.stringify(publicaciones)}
            data-opciones={JSON.stringify(opcionesFiltroEspecifico)}
        />
    ),
}));

interface DatosIniciales {
    visitas: EstadisticaVisitaItem[];
    contactos: EstadisticaContactoItem[];
    publicaciones: EstadisticaPublicacionItem[];
}

const datosVisitas: EstadisticaVisitaItem[] = [
    {
        id: 1,
        fecha: new Date("2026-10-20T12:00:00.000Z"),
        cantidad: 15,
        tipoVisitante: "comprador",
    },
    {
        id: 2,
        fecha: new Date("2026-10-21T12:00:00.000Z"),
        cantidad: 8,
        tipoVisitante: "operador",
    },
];

const datosContactos: EstadisticaContactoItem[] = [
    {
        id: 11,
        fecha: new Date("2026-10-20T12:00:00.000Z"),
        cantidad: 5,
        username: "usuario1",
    },
    {
        id: 12,
        fecha: new Date("2026-10-21T12:00:00.000Z"),
        cantidad: 3,
        username: "usuario2",
    },
];

const datosPublicaciones: EstadisticaPublicacionItem[] = [
    {
        id: 21,
        fecha: new Date("2026-10-20T12:00:00.000Z"),
        cantidad: 4,
        username: "usuario2",
    },
    {
        id: 22,
        fecha: new Date("2026-10-21T12:00:00.000Z"),
        cantidad: 7,
        username: "usuario3",
    },
];

const datosIniciales: DatosIniciales = {
    visitas: datosVisitas,
    contactos: datosContactos,
    publicaciones: datosPublicaciones,
};

function renderizarContenedor(
    datos: DatosIniciales = datosIniciales,
) {
    return render(
        <ContenedorEstadistica datosIniciales={datos} />,
    );
}

function obtenerOpcionesComparativas() {
    const bloque = screen.getByTestId("bloque-comparativo");

    return JSON.parse(
        bloque.getAttribute("data-opciones") ?? "[]",
    ) as Array<{
        valor: string;
        etiqueta: string;
    }>;
}

function obtenerDatosVisitas() {
    const bloque = screen.getByTestId("bloque-visitas");

    return JSON.parse(
        bloque.getAttribute("data-datos") ?? "[]",
    ) as Array<{
        id: number;
        fecha: string;
        cantidad: number;
        tipoVisitante: string;
    }>;
}

function obtenerDatosContactos() {
    const bloque = screen.getByTestId("bloque-comparativo");

    return JSON.parse(
        bloque.getAttribute("data-contactos") ?? "[]",
    ) as EstadisticaContactoItem[];
}

function obtenerDatosPublicaciones() {
    const bloque = screen.getByTestId("bloque-comparativo");

    return JSON.parse(
        bloque.getAttribute("data-publicaciones") ?? "[]",
    ) as EstadisticaPublicacionItem[];
}

describe("ContenedorEstadistica", () => {
    it("muestra el encabezado y su descripción", () => {
        renderizarContenedor();

        expect(
            screen.getByRole("heading", {
                name: "Panel Estadístico",
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "Visualiza el rendimiento de visitas, contactos de WhatsApp y publicaciones de la plataforma.",
            ),
        ).toBeInTheDocument();
    });

    it("renderiza los dos bloques estadísticos", () => {
        renderizarContenedor();

        expect(
            screen.getByTestId("bloque-visitas"),
        ).toBeInTheDocument();

        expect(
            screen.getByTestId("bloque-comparativo"),
        ).toBeInTheDocument();
    });

    it("renderiza el bloque de visitas con las propiedades correspondientes", () => {
        renderizarContenedor();

        const bloque = screen.getByTestId("bloque-visitas");

        expect(bloque).toHaveAttribute("data-titulo", "Visitas");
        expect(bloque).toHaveAttribute("data-tipo", "visitas");

        expect(obtenerDatosVisitas()).toHaveLength(2);

        expect(obtenerDatosVisitas()[0]).toMatchObject({
            id: 1,
            cantidad: 15,
            tipoVisitante: "comprador",
        });
    });

    it("pasa los registros originales de contactos y publicaciones al bloque comparativo", () => {
        renderizarContenedor();

        expect(obtenerDatosContactos()).toHaveLength(2);

        expect(obtenerDatosContactos()[0]).toMatchObject({
            id: 11,
            cantidad: 5,
            username: "usuario1",
        });

        expect(obtenerDatosPublicaciones()).toHaveLength(2);

        expect(obtenerDatosPublicaciones()[0]).toMatchObject({
            id: 21,
            cantidad: 4,
            username: "usuario2",
        });
    });

    it("combina los usuarios de contactos y publicaciones sin duplicarlos", () => {
        renderizarContenedor();

        expect(obtenerOpcionesComparativas()).toEqual([
            {
                valor: "usuario1",
                etiqueta: "usuario1",
            },
            {
                valor: "usuario2",
                etiqueta: "usuario2",
            },
            {
                valor: "usuario3",
                etiqueta: "usuario3",
            },
        ]);
    });

    it("incluye usuarios que aparecen exclusivamente en contactos", () => {
        const datos: DatosIniciales = {
            visitas: datosVisitas,
            contactos: [
                {
                    id: 13,
                    fecha: new Date("2026-10-20T12:00:00.000Z"),
                    cantidad: 5,
                    username: "usuario_exclusivo_contactos",
                },
            ],
            publicaciones: [],
        };

        renderizarContenedor(datos);

        expect(obtenerOpcionesComparativas()).toEqual([
            {
                valor: "usuario_exclusivo_contactos",
                etiqueta: "usuario_exclusivo_contactos",
            },
        ]);
    });

    it("incluye usuarios que aparecen exclusivamente en publicaciones", () => {
        const datos: DatosIniciales = {
            visitas: datosVisitas,
            contactos: [],
            publicaciones: [
                {
                    id: 23,
                    fecha: new Date("2026-10-20T12:00:00.000Z"),
                    cantidad: 5,
                    username: "usuario_exclusivo_publicaciones",
                },
            ],
        };

        renderizarContenedor(datos);

        expect(obtenerOpcionesComparativas()).toEqual([
            {
                valor: "usuario_exclusivo_publicaciones",
                etiqueta: "usuario_exclusivo_publicaciones",
            },
        ]);
    });

    it("devuelve opciones vacías cuando no existen contactos ni publicaciones", () => {
        const datos: DatosIniciales = {
            visitas: datosVisitas,
            contactos: [],
            publicaciones: [],
        };

        renderizarContenedor(datos);

        expect(obtenerOpcionesComparativas()).toEqual([]);
    });

    it("devuelve una única opción cuando un usuario aparece varias veces en ambas estadísticas", () => {
        const datos: DatosIniciales = {
            visitas: datosVisitas,
            contactos: [
                {
                    id: 14,
                    fecha: new Date("2026-10-20T12:00:00.000Z"),
                    cantidad: 2,
                    username: "usuario1",
                },
                {
                    id: 15,
                    fecha: new Date("2026-10-21T12:00:00.000Z"),
                    cantidad: 3,
                    username: "usuario1",
                },
            ],
            publicaciones: [
                {
                    id: 24,
                    fecha: new Date("2026-10-20T12:00:00.000Z"),
                    cantidad: 4,
                    username: "usuario1",
                },
                {
                    id: 25,
                    fecha: new Date("2026-10-21T12:00:00.000Z"),
                    cantidad: 5,
                    username: "usuario1",
                },
            ],
        };

        renderizarContenedor(datos);

        expect(obtenerOpcionesComparativas()).toEqual([
            {
                valor: "usuario1",
                etiqueta: "usuario1",
            },
        ]);
    });

    it("actualiza las opciones comparativas cuando cambian los contactos y publicaciones", () => {
        const { rerender } = renderizarContenedor();

        expect(obtenerOpcionesComparativas()).toEqual([
            {
                valor: "usuario1",
                etiqueta: "usuario1",
            },
            {
                valor: "usuario2",
                etiqueta: "usuario2",
            },
            {
                valor: "usuario3",
                etiqueta: "usuario3",
            },
        ]);

        const nuevosDatos: DatosIniciales = {
            visitas: datosVisitas,
            contactos: [
                {
                    id: 16,
                    fecha: new Date("2026-10-22T12:00:00.000Z"),
                    cantidad: 9,
                    username: "usuario4",
                },
            ],
            publicaciones: [
                {
                    id: 26,
                    fecha: new Date("2026-10-23T12:00:00.000Z"),
                    cantidad: 6,
                    username: "usuario5",
                },
            ],
        };

        rerender(
            <ContenedorEstadistica datosIniciales={nuevosDatos} />,
        );

        expect(obtenerOpcionesComparativas()).toEqual([
            {
                valor: "usuario4",
                etiqueta: "usuario4",
            },
            {
                valor: "usuario5",
                etiqueta: "usuario5",
            },
        ]);
    });

    it("mantiene los datos de visitas independientes de las opciones comparativas", () => {
        const { rerender } = renderizarContenedor();

        const nuevasVisitas: EstadisticaVisitaItem[] = [
            {
                id: 3,
                fecha: new Date("2026-10-22T12:00:00.000Z"),
                cantidad: 25,
                tipoVisitante: "productor",
            },
        ];

        const nuevosDatos: DatosIniciales = {
            visitas: nuevasVisitas,
            contactos: [
                {
                    id: 17,
                    fecha: new Date("2026-10-22T12:00:00.000Z"),
                    cantidad: 3,
                    username: "usuario4",
                },
            ],
            publicaciones: [],
        };

        rerender(
            <ContenedorEstadistica datosIniciales={nuevosDatos} />,
        );

        expect(obtenerDatosVisitas()).toHaveLength(1);

        expect(obtenerDatosVisitas()[0]).toMatchObject({
            id: 3,
            cantidad: 25,
            tipoVisitante: "productor",
        });

        expect(obtenerOpcionesComparativas()).toEqual([
            {
                valor: "usuario4",
                etiqueta: "usuario4",
            },
        ]);
    });

    it("renderiza ambos bloques cuando todas las estadísticas están vacías", () => {
        renderizarContenedor({
            visitas: [],
            contactos: [],
            publicaciones: [],
        });

        expect(
            screen.getByTestId("bloque-visitas"),
        ).toBeInTheDocument();

        expect(
            screen.getByTestId("bloque-comparativo"),
        ).toBeInTheDocument();

        expect(obtenerDatosVisitas()).toEqual([]);
        expect(obtenerDatosContactos()).toEqual([]);
        expect(obtenerDatosPublicaciones()).toEqual([]);
        expect(obtenerOpcionesComparativas()).toEqual([]);
    });

    it("no recalcula las opciones cuando únicamente cambian las visitas", () => {
        const contactos = [...datosContactos];
        const publicaciones = [...datosPublicaciones];

        const mapContactos = vi.spyOn(contactos, "map");
        const mapPublicaciones = vi.spyOn(publicaciones, "map");

        const datos: DatosIniciales = {
            visitas: datosVisitas,
            contactos,
            publicaciones,
        };

        const { rerender } = renderizarContenedor(datos);

        expect(mapContactos).toHaveBeenCalledOnce();
        expect(mapPublicaciones).toHaveBeenCalledOnce();

        const nuevasVisitas: EstadisticaVisitaItem[] = [
            {
                id: 3,
                fecha: new Date("2026-10-22T12:00:00.000Z"),
                cantidad: 30,
                tipoVisitante: "productor",
            },
        ];

        rerender(
            <ContenedorEstadistica
                datosIniciales={{
                    visitas: nuevasVisitas,
                    contactos,
                    publicaciones,
                }}
            />,
        );

        expect(mapContactos).toHaveBeenCalledOnce();
        expect(mapPublicaciones).toHaveBeenCalledOnce();

        expect(obtenerOpcionesComparativas()).toEqual([
            {
                valor: "usuario1",
                etiqueta: "usuario1",
            },
            {
                valor: "usuario2",
                etiqueta: "usuario2",
            },
            {
                valor: "usuario3",
                etiqueta: "usuario3",
            },
        ]);

        expect(obtenerDatosVisitas()).toMatchObject([
            {
                id: 3,
                cantidad: 30,
                tipoVisitante: "productor",
            },
        ]);
    });
});
