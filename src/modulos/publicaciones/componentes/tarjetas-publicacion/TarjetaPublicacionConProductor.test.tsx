import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicacionProductorListado } from "../../../consulta-mercado/acciones/PublicacionesProductor";
import TarjetaPublicacionConProductor from "./TarjetaPublicacionConProductor";

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

describe("TarjetaPublicacionConProductor", () => {
    const onClick = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("muestra el nombre del producto combinando especie y variedad", () => {
        render(<TarjetaPublicacionConProductor publicacion={crearPublicacion()} onClick={onClick} />);

        expect(screen.getByRole("heading", { name: "Tomate - Cherry" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ver detalles de Tomate - Cherry" })).toBeInTheDocument();
    });

    it("muestra solamente la especie cuando la variedad es '-'", () => {
        render(
            <TarjetaPublicacionConProductor
                publicacion={crearPublicacion({ variedad: "-" })}
                onClick={onClick}
            />,
        );

        expect(screen.getByRole("heading", { name: "Tomate" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ver detalles de Tomate" })).toBeInTheDocument();
    });

    it("muestra solamente la especie cuando la variedad está vacía", () => {
        render(
            <TarjetaPublicacionConProductor
                publicacion={crearPublicacion({ variedad: "" })}
                onClick={onClick}
            />,
        );

        expect(screen.getByRole("heading", { name: "Tomate" })).toBeInTheDocument();
    });

    it("muestra el nombre de fantasía del productor en las variantes mobile y desktop", () => {
        render(<TarjetaPublicacionConProductor publicacion={crearPublicacion()} onClick={onClick} />);

        expect(screen.getAllByText("Finca La Esperanza")).toHaveLength(2);
    });

    it("muestra la imagen de la publicación con su texto alternativo", () => {
        render(<TarjetaPublicacionConProductor publicacion={crearPublicacion()} onClick={onClick} />);

        expect(screen.getByRole("img", { name: "Foto de Tomate - Cherry" })).toHaveAttribute("data-src", "/imagenes/tomate.jpg");
    });

    it("muestra el reemplazo cuando la publicación no tiene foto", () => {
        render(
            <TarjetaPublicacionConProductor
                publicacion={crearPublicacion({ foto: null })}
                onClick={onClick}
            />,
        );

        expect(screen.getByText("Sin foto disponible")).toBeInTheDocument();
        expect(screen.getByText("Foto")).toBeInTheDocument();
        expect(screen.getByTestId("image-outlined-icon")).toBeInTheDocument();
    });

    it("muestra calibre, código de calibre y categoría", () => {
        render(<TarjetaPublicacionConProductor publicacion={crearPublicacion()} onClick={onClick} />);

        expect(screen.getAllByText("Mediano")).toHaveLength(2);
        expect(screen.getAllByText("M2")).toHaveLength(2);
        expect(screen.getByText("· Categoría", { exact: false })).toBeInTheDocument();
        expect(screen.getAllByText("I").length).toBeGreaterThan(0);
    });

    it("muestra el precio formateado en pesos uruguayos", () => {
        render(
            <TarjetaPublicacionConProductor publicacion={crearPublicacion({ precio: 1250 })} onClick={onClick} />,
        );

        expect(screen.getByText("$ 1.250")).toBeInTheDocument();
        expect(screen.queryByText("Consultar precio")).not.toBeInTheDocument();
    });

    it("muestra 'Consultar precio' si el precio es null", () => {
        render(
            <TarjetaPublicacionConProductor publicacion={crearPublicacion({ precio: null })} onClick={onClick} />,
        );

        expect(screen.getByText("Consultar precio")).toBeInTheDocument();
    });

    it("formatea el precio cero como un precio y no como precio ausente", () => {
        render(
            <TarjetaPublicacionConProductor publicacion={crearPublicacion({ precio: 0 })} onClick={onClick} />,
        );

        expect(screen.getByText("$ 0")).toBeInTheDocument();
        expect(screen.queryByText("Consultar precio")).not.toBeInTheDocument();
    });

    it("muestra la presentación asociada al precio", () => {
        render(<TarjetaPublicacionConProductor publicacion={crearPublicacion()} onClick={onClick} />);

        expect(screen.getByText("por Caja de 10 kg")).toBeInTheDocument();
        expect(screen.getByTitle("por Caja de 10 kg")).toBeInTheDocument();
    });

    it("ejecuta onClick al pulsar la tarjeta", () => {
        render(<TarjetaPublicacionConProductor publicacion={crearPublicacion()} onClick={onClick} />);

        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tomate - Cherry" }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("conserva la etiqueta accesible del botón usando la especie si no hay variedad", () => {
        render(
            <TarjetaPublicacionConProductor
                publicacion={crearPublicacion({ variedad: "-", especie: "Manzana" })}
                onClick={onClick}
            />,
        );

        expect(screen.getByRole("button", { name: "Ver detalles de Manzana" })).toBeInTheDocument();
    });
});
