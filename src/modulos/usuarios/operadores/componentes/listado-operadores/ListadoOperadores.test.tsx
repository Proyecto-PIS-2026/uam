import { render, screen, fireEvent } from "@testing-library/react";
import ListadoOperadores from "./ListadoOperadores";

const listaOperadores = [
    {id: 1, nombreFantasia: "Juan", fotoPerfil: null,  cantidadProductos: 6,
    locales: [{nombreNave: "Nave A", numeroLocal: "1",},],},
    {id: 2, nombreFantasia: "Jose", fotoPerfil: null,  cantidadProductos: 3,
    locales: [{nombreNave: "Nave B", numeroLocal: "2",},],},
    {id: 3, nombreFantasia: "Alberto", fotoPerfil: null,  cantidadProductos: 4,
    locales: [{nombreNave: "Nave A", numeroLocal: "3",},],},
    {id: 5, nombreFantasia: "Juan Mart", fotoPerfil: null,  cantidadProductos: 4,
    locales: [{nombreNave: "Nave B", numeroLocal: "4",},],},
];

const listaOperadoresConTilde = [
    {...listaOperadores[0], nombreFantasia: "María",},];

const operadoresPaginados = Array.from({ length: 41 }, (_, indice) => ({
    id: indice + 1,
    nombreFantasia: `Operador ${String(indice + 1).padStart(2, "0")}`,
    fotoPerfil: null,
    cantidadProductos: 1,
    locales: [{ nombreNave: indice < 30 ? "A" : "B", numeroLocal: String(indice + 1) }],
}));


describe("ListadoOperadores", () => {

    it("pagina los operadores sin omitir ni repetir tarjetas entre páginas", () => {
        render(<ListadoOperadores operadores={operadoresPaginados} />);
        expect(screen.getAllByText(/^Operador \d{2}$/)).toHaveLength(20);
        expect(screen.getByText("Operador 01")).toBeInTheDocument();
        expect(screen.queryByText("Operador 21")).not.toBeInTheDocument();
        expect(screen.getByText("1–20 de 41 operadores")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        expect(screen.getAllByText(/^Operador \d{2}$/)).toHaveLength(20);
        expect(screen.getByText("Operador 21")).toBeInTheDocument();
        expect(screen.getByText("Operador 40")).toBeInTheDocument();
        expect(screen.queryByText("Operador 20")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        expect(screen.getAllByText(/^Operador \d{2}$/)).toHaveLength(1);
        expect(screen.getByText("Operador 41")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();

        fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
        expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
        expect(screen.getByText("Operador 21")).toBeInTheDocument();
    });

    it("busca en todas las páginas y reinicia la paginación al cambiar la búsqueda", () => {
        render(<ListadoOperadores operadores={operadoresPaginados} />);
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        const buscador = screen.getByRole("searchbox", { name: "Buscar operadores" });
        fireEvent.change(buscador, { target: { value: "Operador 41" } });
        expect(screen.getByText("Operador 41")).toBeInTheDocument();
        expect(screen.queryByRole("navigation", { name: "Paginación de operadores" })).not.toBeInTheDocument();

        fireEvent.change(buscador, { target: { value: "" } });
        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
        expect(screen.getByText("Operador 01")).toBeInTheDocument();
    });

    it("filtra por nave antes de paginar y vuelve a la primera página", () => {
        render(<ListadoOperadores operadores={operadoresPaginados} />);
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Nave" }));
        fireEvent.click(screen.getByRole("option", { name: "Nave A" }));
        expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
        expect(screen.getByText("1–20 de 30 operadores")).toBeInTheDocument();
        expect(screen.getByText("Operador 01")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        expect(screen.getAllByText(/^Operador \d{2}$/)).toHaveLength(10);
        expect(screen.getByText("Operador 30")).toBeInTheDocument();
        expect(screen.queryByText("Operador 31")).not.toBeInTheDocument();
    });

    it("ordena el listado completo y reinicia la página al cambiar el orden", () => {
        render(<ListadoOperadores operadores={operadoresPaginados} />);
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByText("Z-A"));
        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
        const tarjetas = screen.getAllByText(/^Operador \d{2}$/);
        expect(tarjetas[0]).toHaveTextContent("Operador 41");
        expect(tarjetas[19]).toHaveTextContent("Operador 22");
    });

    it("conserva la página ajustada cuando el listado se reduce y vuelve a crecer", () => {
        const vista = render(<ListadoOperadores operadores={operadoresPaginados} />);
        fireEvent.click(screen.getByRole("button", { name: "Página 3" }));
        vista.rerender(<ListadoOperadores operadores={operadoresPaginados.slice(0, 25)} />);
        expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
        expect(screen.getByText("21–25 de 25 operadores")).toBeInTheDocument();
        expect(screen.getAllByText(/^Operador \d{2}$/)).toHaveLength(5);

        vista.rerender(<ListadoOperadores operadores={operadoresPaginados} />);
        expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
        expect(screen.getByText("21–40 de 41 operadores")).toBeInTheDocument();

        vista.rerender(<ListadoOperadores operadores={[]} />);
        expect(screen.getByRole("status")).toHaveTextContent("No hay operadores disponibles.");
        expect(screen.queryByRole("navigation", { name: "Paginación de operadores" })).not.toBeInTheDocument();

        vista.rerender(<ListadoOperadores operadores={operadoresPaginados} />);
        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
        expect(screen.getByText("Operador 01")).toBeInTheDocument();
    });

    it("informa cuando no hay operadores disponibles", () => {
        render(<ListadoOperadores operadores={[]}/>);
        expect(screen.getByRole("status")).toHaveTextContent("No hay operadores disponibles.");
    });

    it("informa una búsqueda sin coincidencias y quita el mensaje al recuperar resultados", () => {
        render(<ListadoOperadores operadores={listaOperadores}/>);
        const buscador = screen.getByRole("searchbox", { name: "Buscar operadores" });
        fireEvent.change(buscador, { target: { value: "Inexistente" } });
        expect(screen.getByRole("status")).toHaveTextContent("No se encontraron operadores que coincidan con la búsqueda y la nave seleccionada.");

        fireEvent.change(buscador, { target: { value: "Jose" } });
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.getByText("Jose")).toBeInTheDocument();
    });

    it("informa cuando la combinación de búsqueda y nave no tiene coincidencias", () => {
        render(<ListadoOperadores operadores={listaOperadores}/>);
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar operadores" }), { target: { value: "Jose" } });
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Nave" }));
        fireEvent.click(screen.getByText("Nave Nave A"));
        expect(screen.getByRole("status")).toHaveTextContent("No se encontraron operadores");
        expect(screen.queryByText("Jose")).not.toBeInTheDocument();
    });
    
    it.each([false, true])("muestra todos los operadores con sus enlaces según el permiso de gestión %s", (puedeGestionar) => {
        render(<ListadoOperadores operadores={listaOperadores} puedeGestionar={puedeGestionar} />);
        expect(screen.getByRole("combobox", { name: "Nave" })).toHaveTextContent("Todas");
        expect(screen.getByText("Juan")).toBeInTheDocument();
        expect(screen.getByText("Jose")).toBeInTheDocument();
        expect(screen.getByText("Alberto")).toBeInTheDocument();
        expect(screen.getByText("Juan Mart")).toBeInTheDocument();
        for (const operador of listaOperadores) {
            expect(screen.getByText(operador.nombreFantasia).closest("a")).toHaveAttribute(
                "href",
                puedeGestionar ? `/gestion-operadores/${operador.id}` : `/operadores/${encodeURIComponent(operador.nombreFantasia)}?origen=operadores`,
            );
        }
    });

    //que funcione la busqueda
    it("Buscar operadores por nombre", () => {
        render(<ListadoOperadores operadores={listaOperadores}/>);
        const buscador = screen.getByRole("searchbox", { name: "Buscar operadores" });
        fireEvent.change(buscador, {target: {value: "Jose",},});

        expect(screen.getByText("Jose")).toBeInTheDocument();
        expect(screen.queryByText("Juan")).not.toBeInTheDocument();
        expect(screen.queryByText("Alberto")).not.toBeInTheDocument();
        expect(screen.queryByText("Juan Mart")).not.toBeInTheDocument();
    });

    //que funcione la busqueda buscando por nombre que este incompleto 
    it("Buscar operadores por nombre incompleto", () => {
        render(<ListadoOperadores operadores={listaOperadores}/>);
        const buscador = screen.getByRole("searchbox", { name: "Buscar operadores" });
        fireEvent.change(buscador, {target: {value: "Jua",},});

        expect(screen.getByText("Juan")).toBeInTheDocument();
        expect(screen.queryByText("Juan Mart")).toBeInTheDocument();
        expect(screen.queryByText("Jose")).not.toBeInTheDocument();
        expect(screen.queryByText("Alberto")).not.toBeInTheDocument();
    });

    //que funcione sin mayusculas
    it("Buscar ignorando mayúsculas", () => {
        render(<ListadoOperadores operadores={listaOperadores}/>);
        const buscador = screen.getByRole("searchbox", { name: "Buscar operadores" });
        fireEvent.change(buscador, {target: {value: "JOSE",},});
        expect(screen.getByText("Jose")).toBeInTheDocument();
    });

    //buscando todo con minusculas
    it("Buscando solo con minusculas", () => {
        render(<ListadoOperadores operadores={listaOperadores}/>);
        const buscador = screen.getByRole("searchbox", { name: "Buscar operadores" });
        fireEvent.change(buscador, {target: {value: "jose",},});
        expect(screen.getByText("Jose")).toBeInTheDocument();
    });

    //operador con tilde 
    it("Buscar un operador que tiene tilde, sin tilde", () => {
        render(<ListadoOperadores operadores={listaOperadoresConTilde}/>);
        const buscador = screen.getByRole("searchbox", { name: "Buscar operadores" });
        fireEvent.change(buscador, {target: {value: "Maria",},});
        expect(screen.getByText("María")).toBeInTheDocument();
    });

    //que filtre por la nave que se indica
    it("Filtrar operadores según nave", () => {
        render(<ListadoOperadores operadores={listaOperadores}/>);
        const selecNave = screen.getByRole("combobox", {name: "Nave",});

        fireEvent.mouseDown(selecNave);
        fireEvent.click(screen.getByText("Nave Nave A"));

        expect(screen.getByText("Juan")).toBeInTheDocument();
        expect(screen.getByText("Alberto")).toBeInTheDocument();
        expect(screen.queryByText("Jose")).not.toBeInTheDocument();
        expect(screen.queryByText("Juan Mart")).not.toBeInTheDocument();
    });

    it("Ordenar a los operadores de A-Z", () => {
        render(<ListadoOperadores operadores={listaOperadores} />);


        const tarjetas = screen.getAllByText(/^(Alberto|Jose|Juan|Juan Mart)$/);
        expect(tarjetas[0]).toHaveTextContent("Alberto");
        expect(tarjetas[1]).toHaveTextContent("Jose");
        expect(tarjetas[2]).toHaveTextContent("Juan");
        expect(tarjetas[3]).toHaveTextContent("Juan Mart");
    });

    it("Ordenar a los operadores de Z-A", () => {
        render(<ListadoOperadores operadores={listaOperadores} />);

        const selectorOrden = screen.getByRole("button", {name: "Ordenar por",});
        fireEvent.click(selectorOrden);
        fireEvent.click(screen.getByText("Z-A"));

        const tarjetas = screen.getAllByText(/^(Alberto|Jose|Juan|Juan Mart)$/);

        expect(tarjetas[0]).toHaveTextContent("Juan Mart");
        expect(tarjetas[1]).toHaveTextContent("Juan");
        expect(tarjetas[2]).toHaveTextContent("Jose");
        expect(tarjetas[3]).toHaveTextContent("Alberto");
    });
});
