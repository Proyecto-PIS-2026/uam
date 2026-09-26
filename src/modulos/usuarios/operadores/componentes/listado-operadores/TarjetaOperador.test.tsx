import React from "react";
import { render, screen } from "@testing-library/react";
import TarjetaOperador from "./TarjetaOperador";

//operadores
const operador = {
    id: 1,
    nombreFantasia: "Nombre 1",
    fotoPerfil: "",
    locales: [{ nombreNave: "A", numeroLocal: "1",}, { nombreNave: "B", numeroLocal: "2",},],
    cantidadProductos: 3,
};

//cuando solo tiene 1 producto
const operadorConUnProducto = { ...operador, cantidadProductos: 1,};

//operador que si tiene foto
const operadorConFoto = {...operador, fotoPerfil: "/foto.jpg",};

//Version falsa del link 
vi.mock("next/link", () => ({
    default: ({ href, children, ...props}: {href: string; children: React.ReactNode;}) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

// Mock de next/image
vi.mock("next/image", () => ({
    default: ({src, alt, ...props}: {src: string; alt: string;}) => (
        <img
            src={src}
            alt={alt}
            {...props}
        />
    ),
}));

describe("TarjetaOperador", () => {
    it("Mostrar nombre del operador", () => {
        render(<TarjetaOperador operador={operador} />);
        expect(screen.getByText("Nombre 1")).toBeInTheDocument();
    });

    it("Mostrar locales del operador", () => {
        render(<TarjetaOperador operador={operador} />);
        expect(screen.getByText("Nave A - 1 | Nave B - 2")).toBeInTheDocument();
    });

    it("Enlaza al detalle del operador", () => {
        render(<TarjetaOperador operador={operador} />);
        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href","/operadores/1");
    });

    it("Mostrar inicial si no tiene foto", () => {
        render(<TarjetaOperador operador={operador} />);
        expect(screen.getByText("N")).toBeInTheDocument();
    });

    it("Mostrar la foto si tiene", () => {
        render(<TarjetaOperador operador={operadorConFoto} />);
        const imagen = screen.getByRole("img");
        expect(imagen).toBeInTheDocument();
        expect(imagen).toHaveAttribute("src","/foto.jpg");
        expect(imagen).toHaveAttribute("alt", "Foto de Nombre 1");
    });

    //mostrar bien la cantidad de productos cuando son mas de 1 
    it("Mostrar cantidad de productos", () => {
        render(<TarjetaOperador operador={operador} />);
        expect(screen.getByText("3")).toBeInTheDocument();
        expect(screen.getByText("productos")).toBeInTheDocument();
    });

    //mostrar bien la cantidad de productos cuando es uno solo
    it("Mostrar cantidad 1 de productos", () => {
        render(<TarjetaOperador operador={operadorConUnProducto} />);
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("producto")).toBeInTheDocument();
    });
    
});
