
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type {
    EstadisticaVisitaItem,
    EstadisticaContactoItem,
    EstadisticaContactoPublicacionItem,
    EstadisticaPublicacionItem,
    EstadisticaCantidadPublicacionItem,
} from "./Tipos";

import ContenedorEstadistica from "./ContenedorEstadistica";

type DatoMock = {
    id: number;
    fecha: Date | string;
    cantidad: number;
    tipoVisitante?: string;
    username?: string;
    especie?: string;
};

vi.mock("./BloqueEstadistica", () => ({
    default: ({
        titulo,
        tipo,
        datos,
    }: {
        titulo: string;
        tipo: string;
        datos: DatoMock[];
    }) => (
        <div
            data-testid={`bloque-${tipo}`}
            data-titulo={titulo}
            data-tipo={tipo}
            data-datos={JSON.stringify(datos)}
        />
    ),
}));

interface DatosIniciales {
    visitas: EstadisticaVisitaItem[];
    contactos: EstadisticaContactoItem[];
    contactosPorPublicacion: EstadisticaContactoPublicacionItem[];
    publicaciones: EstadisticaPublicacionItem[];
    cantidadPublicaciones: EstadisticaCantidadPublicacionItem[];
}

const fecha = new Date("2026-10-20T12:00:00.000Z");

const datosVisitas: EstadisticaVisitaItem[] = [
    {
        id: 1,
        fecha,
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
        fecha,
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

const datosContactosPorPublicacion: EstadisticaContactoPublicacionItem[] = [
    {
        id: 31,
        fecha,
        cantidad: 4,
        username: "usuario1",
        especie: "Tomate",
    },
    {
        id: 32,
        fecha: new Date("2026-10-21T12:00:00.000Z"),
        cantidad: 6,
        username: "usuario2",
        especie: "Manzana",
    },
];

const datosPublicaciones: EstadisticaPublicacionItem[] = [
    {
        id: 21,
        fecha,
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

const datosCantidadPublicaciones: EstadisticaCantidadPublicacionItem[] = [
    {
        id: 41,
        fecha,
        cantidad: 12,
        username: "usuario1",
    },
    {
        id: 42,
        fecha: new Date("2026-10-21T12:00:00.000Z"),
        cantidad: 18,
        username: "usuario2",
    },
];

const datosIniciales: DatosIniciales = {
    visitas: datosVisitas,
    contactos: datosContactos,
    contactosPorPublicacion: datosContactosPorPublicacion,
    publicaciones: datosPublicaciones,
    cantidadPublicaciones: datosCantidadPublicaciones,
};

function renderizarContenedor(datos: DatosIniciales = datosIniciales) {
    return render(
        <ContenedorEstadistica datosIniciales={datos} />,
    );
}

function obtenerDatos<T>(tipo: string): T[] {
    const bloque = screen.getByTestId(`bloque-${tipo}`);

    return JSON.parse(
        bloque.getAttribute("data-datos") ?? "[]",
    ) as T[];
}

function verificarBloque(
    tipo: string,
    titulo: string,
    cantidadEsperada: number,
) {
    const bloque = screen.getByTestId(`bloque-${tipo}`);

    expect(bloque).toBeInTheDocument();
    expect(bloque).toHaveAttribute("data-titulo", titulo);
    expect(bloque).toHaveAttribute("data-tipo", tipo);
    expect(JSON.parse(bloque.getAttribute("data-datos") ?? "[]")).toHaveLength(
        cantidadEsperada,
    );
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

    it("renderiza los cinco bloques estadísticos independientes", () => {
        renderizarContenedor();

        verificarBloque("visitas", "Visitas", 2);
        verificarBloque("contactos", "Contactos por perfil", 2);
        verificarBloque("contactosPorPublicacion", "Contactos por publicación", 2);
        verificarBloque("publicaciones", "Publicaciones modificadas", 2);
        verificarBloque("cantidadPublicaciones", "Cantidad de publicaciones", 2);
    });

    it("pasa los registros originales de visitas", () => {
        renderizarContenedor();

        expect(obtenerDatos<EstadisticaVisitaItem>("visitas")).toEqual(
            JSON.parse(JSON.stringify(datosVisitas)),
        );
    });

    it("pasa los registros originales de contactos por perfil", () => {
        renderizarContenedor();

        expect(obtenerDatos<EstadisticaContactoItem>("contactos")).toEqual(
            JSON.parse(JSON.stringify(datosContactos)),
        );
    });

    it("pasa los registros originales de contactos por publicación y especie", () => {
        renderizarContenedor();

        const resultado = obtenerDatos<EstadisticaContactoPublicacionItem>(
            "contactosPorPublicacion",
        );

        expect(resultado).toHaveLength(2);

        expect(resultado[0]).toMatchObject({
            id: 31,
            cantidad: 4,
            username: "usuario1",
            especie: "Tomate",
        });

        expect(resultado[1]).toMatchObject({
            id: 32,
            cantidad: 6,
            username: "usuario2",
            especie: "Manzana",
        });
    });

    it("pasa los registros originales de publicaciones modificadas", () => {
        renderizarContenedor();

        expect(obtenerDatos<EstadisticaPublicacionItem>("publicaciones")).toEqual(
            JSON.parse(JSON.stringify(datosPublicaciones)),
        );
    });

    it("pasa los registros originales de cantidad de publicaciones", () => {
        renderizarContenedor();

        expect(
            obtenerDatos<EstadisticaCantidadPublicacionItem>("cantidadPublicaciones"),
        ).toEqual(JSON.parse(JSON.stringify(datosCantidadPublicaciones)));
    });

    it("mantiene independientes las colecciones de cada estadística", () => {
        renderizarContenedor();

        expect(obtenerDatos<EstadisticaVisitaItem>("visitas")).toHaveLength(2);
        expect(obtenerDatos<EstadisticaContactoItem>("contactos")).toHaveLength(2);
        expect(
            obtenerDatos<EstadisticaContactoPublicacionItem>("contactosPorPublicacion"),
        ).toHaveLength(2);
        expect(obtenerDatos<EstadisticaPublicacionItem>("publicaciones")).toHaveLength(2);
        expect(
            obtenerDatos<EstadisticaCantidadPublicacionItem>("cantidadPublicaciones"),
        ).toHaveLength(2);

        expect(
            screen.getByTestId("bloque-contactos"),
        ).not.toHaveAttribute("data-tipo", "contactosPorPublicacion");

        expect(
            screen.getByTestId("bloque-publicaciones"),
        ).not.toHaveAttribute("data-tipo", "cantidadPublicaciones");
    });

    it("actualiza los cinco bloques cuando cambian los datos iniciales", () => {
        const { rerender } = renderizarContenedor();

        const nuevosDatos: DatosIniciales = {
            visitas: [
                {
                    id: 3,
                    fecha: new Date("2026-10-22T12:00:00.000Z"),
                    cantidad: 25,
                    tipoVisitante: "productor",
                },
            ],
            contactos: [
                {
                    id: 13,
                    fecha: new Date("2026-10-22T12:00:00.000Z"),
                    cantidad: 9,
                    username: "usuario4",
                },
            ],
            contactosPorPublicacion: [
                {
                    id: 33,
                    fecha: new Date("2026-10-22T12:00:00.000Z"),
                    cantidad: 7,
                    username: "usuario4",
                    especie: "Pera",
                },
            ],
            publicaciones: [
                {
                    id: 23,
                    fecha: new Date("2026-10-22T12:00:00.000Z"),
                    cantidad: 6,
                    username: "usuario5",
                },
            ],
            cantidadPublicaciones: [
                {
                    id: 43,
                    fecha: new Date("2026-10-22T12:00:00.000Z"),
                    cantidad: 20,
                    username: "usuario4",
                },
            ],
        };

        rerender(
            <ContenedorEstadistica datosIniciales={nuevosDatos} />,
        );

        expect(obtenerDatos<EstadisticaVisitaItem>("visitas")).toMatchObject([
            {
                id: 3,
                cantidad: 25,
                tipoVisitante: "productor",
            },
        ]);

        expect(obtenerDatos<EstadisticaContactoItem>("contactos")).toMatchObject([
            {
                id: 13,
                cantidad: 9,
                username: "usuario4",
            },
        ]);

        expect(
            obtenerDatos<EstadisticaContactoPublicacionItem>("contactosPorPublicacion"),
        ).toMatchObject([
            {
                id: 33,
                cantidad: 7,
                username: "usuario4",
                especie: "Pera",
            },
        ]);

        expect(obtenerDatos<EstadisticaPublicacionItem>("publicaciones")).toMatchObject([
            {
                id: 23,
                cantidad: 6,
                username: "usuario5",
            },
        ]);

        expect(
            obtenerDatos<EstadisticaCantidadPublicacionItem>("cantidadPublicaciones"),
        ).toMatchObject([
            {
                id: 43,
                cantidad: 20,
                username: "usuario4",
            },
        ]);
    });

    it("renderiza los cinco bloques cuando todas las estadísticas están vacías", () => {
        renderizarContenedor({
            visitas: [],
            contactos: [],
            contactosPorPublicacion: [],
            publicaciones: [],
            cantidadPublicaciones: [],
        });

        verificarBloque("visitas", "Visitas", 0);
        verificarBloque("contactos", "Contactos por perfil", 0);
        verificarBloque("contactosPorPublicacion", "Contactos por publicación", 0);
        verificarBloque("publicaciones", "Publicaciones modificadas", 0);
        verificarBloque("cantidadPublicaciones", "Cantidad de publicaciones", 0);
    });

    it("conserva los datos de las demás estadísticas al actualizar solamente una colección", () => {
        const { rerender } = renderizarContenedor();

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
                    ...datosIniciales,
                    visitas: nuevasVisitas,
                }}
            />,
        );

        expect(obtenerDatos<EstadisticaVisitaItem>("visitas")).toMatchObject([
            {
                id: 3,
                cantidad: 30,
                tipoVisitante: "productor",
            },
        ]);

        expect(obtenerDatos<EstadisticaContactoItem>("contactos")).toEqual(
            JSON.parse(JSON.stringify(datosContactos)),
        );

        expect(
            obtenerDatos<EstadisticaContactoPublicacionItem>("contactosPorPublicacion"),
        ).toEqual(JSON.parse(JSON.stringify(datosContactosPorPublicacion)));

        expect(obtenerDatos<EstadisticaPublicacionItem>("publicaciones")).toEqual(
            JSON.parse(JSON.stringify(datosPublicaciones)),
        );

        expect(
            obtenerDatos<EstadisticaCantidadPublicacionItem>("cantidadPublicaciones"),
        ).toEqual(JSON.parse(JSON.stringify(datosCantidadPublicaciones)));
    });
});
