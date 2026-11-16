import { render, screen, fireEvent } from "@testing-library/react";
import ProductoCard from "./tarjetaProducto";

describe("ProductoCard", () => {

    it("muestra correctamente el nombre del producto", () => {
        render(
            <ProductoCard nombre="Manzana" operadores={5} imagen={null} />);

            expect(screen.getByText("Manzana")).toBeInTheDocument();
        });

    it("muestra 1 OPERADOR cuando hay un solo operador", () => {
        render(
        <ProductoCard
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

    it("muestra el reemplazo cuando no se proporciona una imagen", () => {
        render(
        <ProductoCard
            nombre="Manzana"
            operadores={2}
            imagen={null}
        />
        );

        expect(screen.getByRole("img", { name: "Sin foto disponible" })).toBeInTheDocument();
        expect(screen.getByText("Sin foto disponible")).toBeInTheDocument();
    });

    it("muestra el reemplazo cuando la imagen proporcionada falla", () => {
        render(
        <ProductoCard
            nombre="Manzana"
            operadores={2}
            imagen="https://ejemplo.com/imagen-inexistente.jpg"
        />
        );

        const imagen = screen.getByRole("img", { name: "Manzana" });

        fireEvent.error(imagen);

        expect(screen.queryByRole("img", { name: "Manzana" })).not.toBeInTheDocument();
        expect(screen.getByRole("img", { name: "Sin foto disponible" })).toBeInTheDocument();
        expect(screen.getByText("Sin foto disponible")).toBeInTheDocument();
    });

    it("enlaza la tarjeta con la página de productos", () => {
        render(
        <ProductoCard
            nombre="Pera Williams"
            operadores={2}
            imagen={null}
        />
        );

        const enlace = screen.getByRole("link");

        expect(enlace).toHaveAttribute(
        "href",
            "/publicaciones?especie=Pera%20Williams"
        );
    });
});
