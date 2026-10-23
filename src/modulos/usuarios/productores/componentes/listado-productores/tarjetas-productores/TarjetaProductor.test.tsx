import React from "react";
import { render, screen } from "@testing-library/react";
import TarjetaProductor from "./TarjetaProductor";

//productores
const productor = {
    id: 1,
    nombreFantasia: "Nombre 1",
    fotoPerfil: "",
    cantidadProductos: 3,
};

//cuando solo tiene 1 producto
const productorConUnProducto = { ...productor, cantidadProductos: 1,};

//productor que si tiene foto
const productorConFoto = {...productor, fotoPerfil: "/foto.jpg",};

//Version falsa del link 
vi.mock("next/link", () => ({
    default: ({ href, children, ...props}: {href: string; children: React.ReactNode;}) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

// Mock de next/image
vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({ src, alt }: { src: string; alt: string }) =>
            createElement("img", { src, alt }),
    };
});

describe("TarjetaOperador", () => {
    it("Mostrar nombre del productor", () => {
        render(<TarjetaProductor  productor={productor} />);
        expect(screen.getByText("Nombre 1")).toBeInTheDocument();
    });

    it("Enlaza al detalle del productor", () => {
        render(<TarjetaProductor  productor={productor} />);
        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "/productores/Nombre%201?origen=productores");
    });

    it("Mostrar inicial si no tiene foto", () => {
        render(<TarjetaProductor  productor={productor} />);
        expect(screen.getByText("N")).toBeInTheDocument();
    });

    it("Mostrar la foto si tiene", () => {
        render(<TarjetaProductor  productor={productorConFoto} />);
        const imagen = screen.getByRole("img");
        expect(imagen).toBeInTheDocument();
        expect(imagen).toHaveAttribute("src","/foto.jpg");
        expect(imagen).toHaveAttribute("alt", "Foto de Nombre 1");
    });

    //mostrar bien la cantidad de productos cuando son mas de 1 
    it("Mostrar cantidad de productos", () => {
        render(<TarjetaProductor  productor={productor} />);
        expect(screen.getByText("3")).toBeInTheDocument();
        expect(screen.getByText("productos")).toBeInTheDocument();
    });

    //mostrar bien la cantidad de productos cuando es uno solo
    it("Mostrar cantidad 1 de productos", () => {
        render(<TarjetaProductor  productor={productorConUnProducto} />);
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("producto")).toBeInTheDocument();
    });
    
});
