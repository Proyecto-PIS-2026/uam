import { render, screen, fireEvent } from "@testing-library/react";
import ProductoCard from "./tarjetaProducto";
import { IMAGEN_POR_DEFECTO } from "./tarjetaProducto";


describe("ProductoCard", () => {

    it("muestra correctamente el nombre del producto", () => {
        render(
            <ProductoCard nombre="Manzana" operadores={5} />);

            expect(screen.getAllByText("Manzana").length).toBeGreaterThan(0);
        });

    it("muestra 1 OPERADOR cuando hay un solo operador", () => {
        render(
        <ProductoCard
            nombre="Manzana"
            operadores={1}
        />
        );

        expect(screen.getByText("1 OPERADOR")).toBeInTheDocument();
    });

    it("muestra ... OPERADORES cuando hay varios operadores", () => {
        render(
        <ProductoCard
            nombre="Manzana"
            operadores={5}
        />
        );

        expect(screen.getByText("5 OPERADORES")).toBeInTheDocument();
    });

    it("muestra la imagen proporcionada", () => {
        render(
        <ProductoCard
            nombre="Manzana"
            operadores={2}
            imagen="https://ejemplo.com/manzana.jpg"
        />
        );

        const imagen = screen.getByRole("img", { name: "Manzana" });

        expect(imagen).toHaveAttribute(
        "src",
        "https://ejemplo.com/manzana.jpg"
        );
    });

    it("muestra la imagen por defecto cuando no se proporciona una imagen", () => {
        render(
        <ProductoCard
            nombre="Manzana"
            operadores={2}
        />
        );

        const imagen = screen.getByRole("img", { name: "Manzana" });

        expect(imagen).toHaveAttribute(
        "src",
        IMAGEN_POR_DEFECTO
        );
    });

    it("utiliza la imagen por defecto cuando la imagen proporcionada falla", () => {
        render(
        <ProductoCard
            nombre="Manzana"
            operadores={2}
            imagen="https://ejemplo.com/imagen-inexistente.jpg"
        />
        );

        const imagen = screen.getByRole("img", { name: "Manzana" });

        fireEvent.error(imagen);

        expect(imagen).toHaveAttribute(
        "src",
        IMAGEN_POR_DEFECTO
        );
    });

    it("enlaza la tarjeta con la página de productos", () => {
        render(
        <ProductoCard
            nombre="Manzana"
            operadores={2}
        />
        );

        const enlace = screen.getByRole("link");

        expect(enlace).toHaveAttribute(
        "href",
        "/productos/placeholder"
        );
    });
});