import { render, screen, fireEvent } from "@testing-library/react";
import Inicio from "./inicio";

const especiesMock = [
  { idEspecie: 1, nombreEspecie: "Banana", fotoGenerica: null, cantidadOperadores: 3 },
  { idEspecie: 2, nombreEspecie: "Manzana", fotoGenerica: null, cantidadOperadores: 5 },
  { idEspecie: 3, nombreEspecie: "Sandía", fotoGenerica: null, cantidadOperadores: 1 },
];

describe("inicio", () => {

    it("muestra todas las especies cuando el campo de búsqueda está vacío", () => {
        render(<Inicio especies={especiesMock} />);

        expect(screen.getByText("Banana")).toBeInTheDocument();
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.getByText("Sandía")).toBeInTheDocument();
    });

    it("filtra las especies según el texto ingresado", async () => {
        render(<Inicio especies={especiesMock} />);
        const input = screen.getByPlaceholderText("Buscar especies")
        fireEvent.change(input, { target: { value: "man" } });

        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.queryByText("Banana")).not.toBeInTheDocument();
        expect(screen.queryByText("Sandía")).not.toBeInTheDocument();
    })

    it("ignora mayúsculas y tildes al buscar", () => {
        render(<Inicio especies={especiesMock} />);
        const input = screen.getByPlaceholderText("Buscar especies");
        fireEvent.change(input, { target: { value: "SANDIA" } });

        expect(screen.getByText("Sandía")).toBeInTheDocument();
        expect(screen.queryByText("Banana")).not.toBeInTheDocument();
        expect(screen.queryByText("Manzana")).not.toBeInTheDocument();
    })

    it("muestra el mensaje de 'sin resultados' cuando ninguna especie coincide", () => {
        render(<Inicio especies={especiesMock} />);
        const input = screen.getByPlaceholderText("Buscar especies");
        fireEvent.change(input, { target: { value: "DSAFSADDSA" } });

        expect(
            screen.getByText("No hay especies que coincidan con la búsqueda.")
        ).toBeInTheDocument();
    })

    it("ordena las especies de forma ascendente (A-Z)", () => {
        render(<Inicio especies={especiesMock} />);

        const select = screen.getByRole("combobox");
        fireEvent.mouseDown(select);
        const opcion = screen.getByRole("option", { name: "A-Z" });
        fireEvent.click(opcion);;
        const especies = screen.getAllByText(/Banana|Manzana|Sandía/);

        expect(especies[0]).toHaveTextContent("Banana");
        expect(especies[1]).toHaveTextContent("Manzana");
        expect(especies[2]).toHaveTextContent("Sandía");
    });

    
    it("ordena las especies de forma descendente (Z-A)", () => {
        render(<Inicio especies={especiesMock} />);

        const select = screen.getByRole("combobox");
        fireEvent.mouseDown(select);
        const opcion = screen.getByRole("option", { name: "Z-A" });
        fireEvent.click(opcion);
        const especies = screen.getAllByText(/Banana|Manzana|Sandía/);

        expect(especies[0]).toHaveTextContent("Sandía");
        expect(especies[1]).toHaveTextContent("Manzana");
        expect(especies[2]).toHaveTextContent("Banana");
    });

    it("cambia a la siguiente página al presionar Siguiente y a la anterior al presionar anterior", () => {
        const especies = Array.from({ length: 21 }, (_, i) => ({
            idEspecie: i + 1,
            nombreEspecie: `Especie ${String(i + 1).padStart(2, "0")}`,
            fotoGenerica: null,
            cantidadOperadores: 1,
        }));
        render(<Inicio especies={especies} />);
        expect(screen.getByText("Especie 01")).toBeInTheDocument();
        expect(screen.queryByText("Especie 21")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        expect(screen.queryByText("Especie 21")).toBeInTheDocument();
        expect(screen.queryByText("Especie 01")).not.toBeInTheDocument();

        expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
        expect(screen.queryByText("Especie 21")).not.toBeInTheDocument();
        expect(screen.queryByText("Especie 01")).toBeInTheDocument();
        expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();

    })

})
