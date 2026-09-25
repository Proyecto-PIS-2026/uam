import { render, screen, fireEvent } from "@testing-library/react";
import ProductoCard from "./tarjetaProducto";

describe("ProductoCard", () => {

    it("muestra correctamente el nombre del producto", () => {
        render(
            <ProductoCard idEspecie={60} nombre="Manzana" operadores={5} imagen={null} />);

            expect(screen.getByText("Manzana")).toBeInTheDocument();
        });

    it("muestra 1 OPERADOR cuando hay un solo operador", () => {
        render(
        <ProductoCard
            idEspecie={60}
            nombre="Manzana"
            operadores={1}
            imagen={null}
        />
        );

        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("operador")).toBeInTheDocument();
    });

    it("muestra ... OPERADORES cuando hay varios operadores", () => {
        render(
        <ProductoCard
            idEspecie={60}
            nombre="Manzana"
            operadores={5}
            imagen={null}
        />
        );

        expect(screen.getByText("5")).toBeInTheDocument();
        expect(screen.getByText("operadores")).toBeInTheDocument();
    });

    it("muestra la imagen proporcionada", () => {
        render(
        <ProductoCard
            idEspecie={60}
            nombre="Manzana"
            operadores={2}
            imagen="https://ejemplo.com/manzana.jpg"
        />
        );

        const imagen = screen.getByRole("img", { name: "Manzana" });

        expect(imagen).toHaveAttribute(
            "src",
            expect.stringContaining("ejemplo.com")
        );
    });

    it("muestra la inicial del nombre cuando no se proporciona una imagen", () => {
        render(
        <ProductoCard
            idEspecie={60}
            nombre="Manzana"
            operadores={2}
            imagen={null}
        />
        );

        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.getByText("M")).toBeInTheDocument();
    });

    it("muestra la inicial cuando la imagen proporcionada falla", () => {
        render(
        <ProductoCard
            idEspecie={60}
            nombre="Manzana"
            operadores={2}
            imagen="https://ejemplo.com/imagen-inexistente.jpg"
        />
        );

        const imagen = screen.getByRole("img", { name: "Manzana" });

        fireEvent.error(imagen);

        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.getByText("M")).toBeInTheDocument();
    });

    it("enlaza la tarjeta con la página de productos", () => {
        render(
        <ProductoCard
            idEspecie={60}
            nombre="Manzana"
            operadores={2}
            imagen={null}
        />
        );

        const enlace = screen.getByRole("link");

        expect(enlace).toHaveAttribute(
        "href",
            "/publicaciones?especieId=60"
        );
    });
});