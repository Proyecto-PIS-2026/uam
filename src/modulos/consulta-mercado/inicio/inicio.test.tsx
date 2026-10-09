import { render, screen, fireEvent } from "@testing-library/react";
import Inicio from "./inicio";

const especiesMock = [
  { nombreEspecie: "Banana", fotoEspecie: null, cantidadOperadores: 3 },
  { nombreEspecie: "Manzana", fotoEspecie: null, cantidadOperadores: 5 },
  { nombreEspecie: "Sandía", fotoEspecie: null, cantidadOperadores: 1 },
];

const especiesOrdenMock = ["Berro", "Manzana", "Papa", "Acelga", "Banana"].map((nombreEspecie) => ({
    nombreEspecie,
    fotoEspecie: null,
    cantidadOperadores: 1,
}));

function nombresEnPantalla() {
    return screen.getAllByRole("heading", { level: 3 }).map((titulo) => titulo.textContent);
}

describe("inicio", () => {

    it("muestra todas las especies cuando el campo de búsqueda está vacío", () => {
        render(<Inicio especies={especiesMock} urlListaInteligente={null} />);

        expect(screen.getByText("Banana")).toBeInTheDocument();
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.getByText("Sandía")).toBeInTheDocument();
    });

    it("filtra las especies según el texto ingresado", async () => {
        render(<Inicio especies={especiesMock} urlListaInteligente={null} />);
        const input = screen.getByRole("searchbox", { name: "Buscar especies" })
        fireEvent.change(input, { target: { value: "man" } });

        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.queryByText("Banana")).not.toBeInTheDocument();
        expect(screen.queryByText("Sandía")).not.toBeInTheDocument();
    })

    it("ignora mayúsculas y tildes al buscar", () => {
        render(<Inicio especies={especiesMock} urlListaInteligente={null} />);
        const input = screen.getByRole("searchbox", { name: "Buscar especies" });
        fireEvent.change(input, { target: { value: "SANDIA" } });

        expect(screen.getByText("Sandía")).toBeInTheDocument();
        expect(screen.queryByText("Banana")).not.toBeInTheDocument();
        expect(screen.queryByText("Manzana")).not.toBeInTheDocument();
    })

    it("muestra el mensaje de 'sin resultados' cuando ninguna especie coincide", () => {
        render(<Inicio especies={especiesMock} urlListaInteligente={null} />);
        const input = screen.getByRole("searchbox", { name: "Buscar especies" });
        fireEvent.change(input, { target: { value: "DSAFSADDSA" } });

        expect(
            screen.getByText("No hay especies que coincidan con la búsqueda.")
        ).toBeInTheDocument();
    })

    it("muestra primero las especies prioritarias y después las restantes en orden alfabético", () => {
        render(<Inicio especies={especiesOrdenMock} urlListaInteligente={null} />);

        expect(nombresEnPantalla()).toEqual(["Papa", "Banana", "Manzana", "Acelga", "Berro"]);
        expect(screen.getByRole("combobox", { name: "Ordenar por" })).not.toHaveTextContent("A-Z");
    });

    it("ordena todas las especies de forma ascendente al elegir A-Z", () => {
        render(<Inicio especies={especiesOrdenMock} urlListaInteligente={null} />);

        const select = screen.getByRole("combobox");
        fireEvent.mouseDown(select);
        const opcion = screen.getByRole("option", { name: "A-Z" });
        fireEvent.click(opcion);

        expect(nombresEnPantalla()).toEqual(["Acelga", "Banana", "Berro", "Manzana", "Papa"]);
    });

    it("recupera el orden prioritario al volver a entrar a la página", () => {
        const vista = render(<Inicio especies={especiesOrdenMock} urlListaInteligente={null} />);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("option", { name: "A-Z" }));
        expect(nombresEnPantalla()).toEqual(["Acelga", "Banana", "Berro", "Manzana", "Papa"]);

        vista.unmount();
        render(<Inicio especies={especiesOrdenMock} urlListaInteligente={null} />);
        expect(nombresEnPantalla()).toEqual(["Papa", "Banana", "Manzana", "Acelga", "Berro"]);
    });

    
    it("ordena las especies de forma descendente (Z-A)", () => {
        render(<Inicio especies={especiesMock} urlListaInteligente={null} />);

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
            nombreEspecie: `Especie ${String(i + 1).padStart(2, "0")}`,
            fotoEspecie: null,
            cantidadOperadores: 1,
        }));
        render(<Inicio especies={especies} urlListaInteligente={null} />);
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
    it("muestra un enlace a la Lista Inteligente cuando hay una URL configurada", () => {
        render(<Inicio especies={especiesMock} urlListaInteligente="https://uam.com.uy/wp-content/uploads/2026/09/MGAP_Lista_Inteligente_PDF-1.pdf" />);
        const enlace = screen.getByRole("link", { name: "Lista inteligente" });
        expect(enlace).toHaveAttribute("href", "https://uam.com.uy/wp-content/uploads/2026/09/MGAP_Lista_Inteligente_PDF-1.pdf");
        expect(enlace).toHaveAttribute("target", "_blank");
    });

    it("avisa cuando se selecciona Lista Inteligente y no hay URL configurada", async () => {
        render(<Inicio especies={especiesMock} urlListaInteligente={null}/>);
        fireEvent.click(screen.getByRole("button", { name: "Lista inteligente" }));
        const aviso = await screen.findByRole("alert");
        expect(aviso).toHaveTextContent("La Lista Inteligente no está disponible");
    });
})
