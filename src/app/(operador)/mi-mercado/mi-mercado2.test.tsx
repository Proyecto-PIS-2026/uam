import { render, screen, fireEvent } from "@testing-library/react";
import MiMercado, { Publicacion } from "./mi-mercado";

vi.mock("./tarjeta-publicacion", () => ({
    __esModule: true,
    default: ({
        pub,
        incrementoPrecio,
    }: {
        pub: Publicacion;
        incrementoPrecio: number;
    }) => (
        <div data-testid="tarjeta-publicacion">
            <span>{pub.id}</span>
            <span>{incrementoPrecio}</span>
        </div>
    ),
}));

const publicaciones: Publicacion[] = [
    {
        id: 1,
        foto: null,
        precio: "100",
        publicacionActiva: true,
        publicacionDisponible: true,
        presentacion: {
            nombrePresentacion: "Caja",
            variedad: {
                nombreVariedad: "Red Delicious",
                especie: {
                    id: 60,
                    nombreEspecie: "Manzana",
                    fotoEspecie: null,
                },
            },
        },
        categoria: {
            nombreCategoria: "Fruta",
        },
        calibre: {
            codigoCalibre: "A",
            nombreCalibre: "Grande",
        },
    },
    {
        id: 2,
        foto: null,
        precio: "120",
        publicacionActiva: true,
        publicacionDisponible: true,
        presentacion: {
            nombrePresentacion: "Caja",
            variedad: {
                nombreVariedad: "Granny Smith",
                especie: {
                    id: 60,
                    nombreEspecie: "Manzana",
                    fotoEspecie: null,
                },
            },
        },
        categoria: {
            nombreCategoria: "Fruta",
        },
        calibre: {
            codigoCalibre: "B",
            nombreCalibre: "Mediano",
        },
    },
    {
        id: 3,
        foto: null,
        precio: "200",
        publicacionActiva: true,
        publicacionDisponible: true,
        presentacion: {
            nombrePresentacion: "Cajón",
            variedad: {
                nombreVariedad: "Navel",
                especie: {
                    id: 70,
                    nombreEspecie: "Naranja",
                    fotoEspecie: null,
                },
            },
        },
        categoria: {
            nombreCategoria: "Fruta",
        },
        calibre: {
            codigoCalibre: "A",
            nombreCalibre: "Grande",
        },
    },
];

describe("MiMercado", () => {

    it("pasa correctamente el incremento de precio a las tarjetas", () => {
        render(
            <MiMercado
                publicaciones={publicaciones}
                incrementoPrecio={15}
            />
        );

        const tarjetas = screen.getAllByTestId("tarjeta-publicacion");

        tarjetas.forEach((tarjeta) => {
            expect(tarjeta).toHaveTextContent("15");
        });
    });

    it("pasa correctamente el decremento de precio a las tarjetas", () => {
        render(
            <MiMercado
                publicaciones={publicaciones}
                incrementoPrecio={-15}
            />
        );

        const tarjetas = screen.getAllByTestId("tarjeta-publicacion");

        tarjetas.forEach((tarjeta) => {
            expect(tarjeta).toHaveTextContent("-15");
        });
    });
});