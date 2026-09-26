import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import TarjetaPublicacion from "./tarjeta-publicacion";

vi.mock("./[id]/detalle-publicacion", () => ({
    default: () => <div data-testid="detalle-publicacion" />,
}));

vi.mock("@/compartido/drawer", () => ({
    default: ({ isOpen, children }: any) =>
        isOpen ? <div data-testid="drawer">{children}</div> : null,
}));

vi.mock("./actions", () => ({
    actualizarPrecio: vi.fn(),
}));
const publicacion = {
    id: 1,
    foto: null,
    precio: "100",
    publicacionActiva: true,
    publicacionDisponible: true,
    presentacion: {
        nombrePresentacion: "Caja",
        variedad: {
            nombreVariedad: "Manzana Roja",
            especie: {
                id: 1,
                nombreEspecie: "Manzana",
                fotoEspecie: null,
            },
        },
    },
    categoria: {
        nombreCategoria: "Frutas",
    },
    calibre: {
        codigoCalibre: "A",
        nombreCalibre: "Grande",
    },
};

describe("TarjetaPublicacion", () => {
    it("aumenta el precio con el botón", () => {
        render(
            <TarjetaPublicacion
                pub={{ ...publicacion, precio: "100" }}
                incrementoPrecio={10}
            />
        );

        expect(screen.getByText("$100")).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", {
                name: "Aumentar precio",
            })
        );

        expect(screen.getByText("$110")).toBeInTheDocument();
    });

    it("disminuye el precio con el botón", () => {
        render(
            <TarjetaPublicacion
                pub={{ ...publicacion, precio: "100" }}
                incrementoPrecio={10}
            />
        );

        fireEvent.click(
            screen.getByRole("button", {
                name: "Disminuir precio",
            })
        );

        expect(screen.getByText("$90")).toBeInTheDocument();
    });

    it("no permite disminuir el precio por debajo de 0", () => {
        render(
            <TarjetaPublicacion
                pub={{ ...publicacion, precio: "5" }}
                incrementoPrecio={10}
            />
        );

        fireEvent.click(
            screen.getByRole("button", {
                name: "Disminuir precio",
            })
        );

        expect(screen.getByText("Sin precio")).toBeInTheDocument();
    });
});