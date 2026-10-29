import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicacionProductorListado } from "../../../consulta-mercado/acciones/PublicacionesProductor";
import TarjetaPublicacionSinProductor from "./TarjetaPublicacionSinProductor";

vi.mock("../ImagenPublicacion", () => ({
    default: ({
        src,
        alt,
        reemplazo,
    }: {
        src: string | null;
        alt: string;
        reemplazo: ReactNode;
    }) => src
        ? <span role="img" aria-label={alt} data-src={src} />
        : <>{reemplazo}</>,
}));

vi.mock("@mui/icons-material/ImageOutlined", () => ({
    default: () => <span data-testid="image-outlined-icon" />,
}));

const crearPublicacion = (
    cambios: Partial<PublicacionProductorListado> = {},
): PublicacionProductorListado => ({
    id: 10,
    precio: 1250,
    fecha: "2026-10-16T12:00:00.000Z",
    foto: "/imagenes/tomate.jpg",
    especie: "Tomate",
    variedad: "Cherry",
    presentacion: "Caja de 10 kg",
    cantidadUnidades: 10,
    categoria: "I",
    calibre: "Mediano",
    codigoCalibre: "M2",
    pais: "Uruguay",
    tipoPublicacion: "PRODUCTOR" as const,
    productor: {
        id: 3,
        nombreFantasia: "Finca La Esperanza",
        fotoPerfil: null,
        whatsApp: "+59899123456",
    },
    ubicaciones: [],
    ...cambios,
});

describe("TarjetaPublicacionSinProductor", () => {
    const onClick = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("muestra especie y variedad juntas cuando la variedad está definida", () => {
        render(<TarjetaPublicacionSinProductor publicacion={crearPublicacion()} onClick={onClick} />);

        expect(screen.getByRole("heading", { name: "Tomate - Cherry" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ver detalles de Tomate - Cherry" })).toBeInTheDocument();
        expect(screen.getByTitle("Tomate - Cherry")).toBeInTheDocument();
    });

    it("muestra solo la especie cuando la variedad es '-'", () => {
        render(
            <TarjetaPublicacionSinProductor
                publicacion={crearPublicacion({ variedad: "-" })}
                onClick={onClick}
            />,
        );

        expect(screen.getByRole("heading", { name: "Tomate" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ver detalles de Tomate" })).toBeInTheDocument();
    });

    it("muestra solo la especie cuando la variedad está vacía", () => {
        render(
            <TarjetaPublicacionSinProductor
                publicacion={crearPublicacion({ variedad: "" })}
                onClick={onClick}
            />,
        );

        expect(screen.getByRole("heading", { name: "Tomate" })).toBeInTheDocument();
    });

    it("muestra la imagen con el texto alternativo y la fuente de la publicación", () => {
        render(<TarjetaPublicacionSinProductor publicacion={crearPublicacion()} onClick={onClick} />);

        expect(screen.getByRole("img", { name: "Foto de Tomate - Cherry" })).toHaveAttribute("data-src", "/imagenes/tomate.jpg");
    });

    it("muestra el reemplazo y el icono cuando la publicación no tiene foto", () => {
        render(
            <TarjetaPublicacionSinProductor
                publicacion={crearPublicacion({ foto: null })}
                onClick={onClick}
            />,
        );

        expect(screen.getByText("Foto")).toBeInTheDocument();
        expect(screen.getByText("Sin foto disponible")).toBeInTheDocument();
        expect(screen.getByTestId("image-outlined-icon")).toBeInTheDocument();
    });

    it("muestra calibre, código de calibre y categoría", () => {
        render(<TarjetaPublicacionSinProductor publicacion={crearPublicacion()} onClick={onClick} />);

        expect(screen.getAllByText("Mediano")).toHaveLength(2);
        expect(screen.getAllByText("M2")).toHaveLength(2);
        expect(screen.getByText("· Categoría", { exact: false })).toBeInTheDocument();
        expect(screen.getAllByText("I").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Calibre")).toHaveLength(1);
        expect(screen.getByText("Cat.")).toBeInTheDocument();
    });

    it("formatea un precio normal en pesos uruguayos", () => {
        render(
            <TarjetaPublicacionSinProductor
                publicacion={crearPublicacion({ precio: 1250 })}
                onClick={onClick}
            />,
        );

        expect(screen.getByText("$ 1.250")).toBeInTheDocument();
        expect(screen.queryByText("Consultar precio")).not.toBeInTheDocument();
    });

    it("muestra 'Consultar precio' cuando el precio es null", () => {
        render(
            <TarjetaPublicacionSinProductor
                publicacion={crearPublicacion({ precio: null })}
                onClick={onClick}
            />,
        );

        expect(screen.getByText("Consultar precio")).toBeInTheDocument();
    });

    it("formatea el precio cero en vez de tratarlo como un precio ausente", () => {
        render(
            <TarjetaPublicacionSinProductor
                publicacion={crearPublicacion({ precio: 0 })}
                onClick={onClick}
            />,
        );

        expect(screen.getByText("$ 0")).toBeInTheDocument();
        expect(screen.queryByText("Consultar precio")).not.toBeInTheDocument();
    });

    it("muestra la presentación junto al precio y en el title", () => {
        render(<TarjetaPublicacionSinProductor publicacion={crearPublicacion()} onClick={onClick} />);

        expect(screen.getByText("por Caja de 10 kg")).toBeInTheDocument();
        expect(screen.getByTitle("por Caja de 10 kg")).toBeInTheDocument();
    });

    it("ejecuta onClick al pulsar la tarjeta", () => {
        render(<TarjetaPublicacionSinProductor publicacion={crearPublicacion()} onClick={onClick} />);

        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tomate - Cherry" }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("conserva la etiqueta accesible si el producto no tiene variedad", () => {
        render(
            <TarjetaPublicacionSinProductor
                publicacion={crearPublicacion({ especie: "Manzana", variedad: "-" })}
                onClick={onClick}
            />,
        );

        expect(screen.getByRole("button", { name: "Ver detalles de Manzana" })).toBeInTheDocument();
    });
});
