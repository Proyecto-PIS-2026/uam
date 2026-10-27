import { render, screen, fireEvent } from "@testing-library/react";
import ListadoProductores from "./ListadoProductores";

const listaProductores = [
    {id: 1, nombreFantasia: "Juan", fotoPerfil: null, cantidadProductos: 6, departamentos: ["Canelones", "Salto"]},
    {id: 2, nombreFantasia: "Jose", fotoPerfil: null, cantidadProductos: 3, departamentos: ["Salto"]},
    {id: 3, nombreFantasia: "Alberto", fotoPerfil: null, cantidadProductos: 4, departamentos: ["Montevideo"]},
    {id: 5, nombreFantasia: "Juan Mart", fotoPerfil: null, cantidadProductos: 4, departamentos: []},
];

const listaProductoresConTilde = [
    {...listaProductores[0], nombreFantasia: "María",},];


describe("ListadoProductores", () => {

    it("informa cuando no hay productores disponibles", () => {
        render(<ListadoProductores productores={[]}/>);
        expect(screen.getByRole("status")).toHaveTextContent("No hay productores disponibles.");
    });

    it("informa una búsqueda sin coincidencias y quita el mensaje al recuperar resultados", () => {
        render(<ListadoProductores productores={listaProductores}/>);
        const buscador = screen.getByRole("searchbox", { name: "Buscar productores" });
        fireEvent.change(buscador, { target: { value: "Inexistente" } });
        expect(screen.getByRole("status")).toHaveTextContent("No se encontraron productores que coincidan con la búsqueda y el departamento seleccionado.");
        fireEvent.change(buscador, { target: { value: "Jose" } });
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.getByText("Jose")).toBeInTheDocument();
    });
    
    it("Mostrar todos los productores con Todas seleccionado por defecto", () => {
        render(<ListadoProductores productores={listaProductores} />);
        expect(screen.getByText("Juan")).toBeInTheDocument();
        expect(screen.getByText("Jose")).toBeInTheDocument();
        expect(screen.getByText("Alberto")).toBeInTheDocument();
        expect(screen.getByText("Juan Mart")).toBeInTheDocument();
    });

    it("ofrece sólo departamentos presentes sin duplicados y encuentra productores de varios departamentos", () => {
        render(<ListadoProductores productores={listaProductores} />);
        const departamento = screen.getByRole("combobox", { name: "Departamento" });
        expect(departamento).toHaveTextContent("Todos");
        fireEvent.mouseDown(departamento);
        expect(screen.getAllByRole("option").map((opcion) => opcion.textContent)).toEqual(["Todos", "Canelones", "Montevideo", "Salto"]);
        fireEvent.click(screen.getByRole("option", { name: "Salto" }));
        expect(screen.getByText("Juan")).toBeInTheDocument();
        expect(screen.getByText("Jose")).toBeInTheDocument();
        expect(screen.queryByText("Alberto")).not.toBeInTheDocument();
        expect(screen.queryByText("Juan Mart")).not.toBeInTheDocument();
        fireEvent.mouseDown(departamento);
        fireEvent.click(screen.getByRole("option", { name: "Canelones" }));
        expect(screen.getByText("Juan")).toBeInTheDocument();
        expect(screen.queryByText("Jose")).not.toBeInTheDocument();
    });

    it("combina departamento y búsqueda y recupera productores sin departamento al elegir Todos", () => {
        render(<ListadoProductores productores={listaProductores} />);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Departamento" }));
        fireEvent.click(screen.getByRole("option", { name: "Salto" }));
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar productores" }), { target: { value: "Juan Mart" } });
        expect(screen.getByRole("status")).toHaveTextContent("departamento seleccionado");
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Departamento" }));
        fireEvent.click(screen.getByRole("option", { name: "Todos" }));
        expect(screen.getByText("Juan Mart")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("limpia un departamento que dejó de existir al actualizar el listado", () => {
        const vista = render(<ListadoProductores productores={listaProductores} />);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Departamento" }));
        fireEvent.click(screen.getByRole("option", { name: "Salto" }));
        vista.rerender(<ListadoProductores productores={[listaProductores[2]]} />);
        expect(screen.getByRole("combobox", { name: "Departamento" })).toHaveTextContent("Todos");
        expect(screen.getByText("Alberto")).toBeInTheDocument();
    });

    //que funcione la busqueda
    it("Buscar productores por nombre", () => {
        render(<ListadoProductores productores={listaProductores}/>);
        const buscador = screen.getByRole("searchbox", { name: "Buscar productores" });
        fireEvent.change(buscador, {target: {value: "Jose",},});

        expect(screen.getByText("Jose")).toBeInTheDocument();
        expect(screen.queryByText("Juan")).not.toBeInTheDocument();
        expect(screen.queryByText("Alberto")).not.toBeInTheDocument();
        expect(screen.queryByText("Juan Mart")).not.toBeInTheDocument();
    });

    //que funcione la busqueda buscando por nombre que este incompleto 
    it("Buscar productores por nombre incompleto", () => {
        render(<ListadoProductores productores={listaProductores}/>);
        const buscador = screen.getByRole("searchbox", { name: "Buscar productores" });
        fireEvent.change(buscador, {target: {value: "Jua",},});

        expect(screen.getByText("Juan")).toBeInTheDocument();
        expect(screen.queryByText("Juan Mart")).toBeInTheDocument();
        expect(screen.queryByText("Jose")).not.toBeInTheDocument();
        expect(screen.queryByText("Alberto")).not.toBeInTheDocument();
    });

    //que funcione sin mayusculas
    it("Buscar ignorando mayúsculas", () => {
        render(<ListadoProductores productores={listaProductores}/>);
        const buscador = screen.getByRole("searchbox", { name: "Buscar productores" });
        fireEvent.change(buscador, {target: {value: "JOSE",},});
        expect(screen.getByText("Jose")).toBeInTheDocument();
    });

    //buscando todo con minusculas
    it("Buscando solo con minusculas", () => {
        render(<ListadoProductores productores={listaProductores}/>);
        const buscador = screen.getByRole("searchbox", { name: "Buscar productores" });
        fireEvent.change(buscador, {target: {value: "jose",},});
        expect(screen.getByText("Jose")).toBeInTheDocument();
    });

    //productor con tilde 
    it("Buscar un productor que tiene tilde, sin tilde", () => {
        render(<ListadoProductores productores={listaProductoresConTilde}/>);
        const buscador = screen.getByRole("searchbox", { name: "Buscar productores" });
        fireEvent.change(buscador, {target: {value: "Maria",},});
        expect(screen.getByText("María")).toBeInTheDocument();
    });

    it("Ordenar a los productores de A-Z", () => {
        render(<ListadoProductores productores={listaProductores} />);


        const tarjetas = screen.getAllByText(/^(Alberto|Jose|Juan|Juan Mart)$/);
        expect(tarjetas[0]).toHaveTextContent("Alberto");
        expect(tarjetas[1]).toHaveTextContent("Jose");
        expect(tarjetas[2]).toHaveTextContent("Juan");
        expect(tarjetas[3]).toHaveTextContent("Juan Mart");
    });

    it("Ordenar a los productores de Z-A", () => {
        render(<ListadoProductores productores={listaProductores} />);

        const selectorOrden = screen.getByRole("combobox", {name: "Ordenar por",});
        fireEvent.mouseDown(selectorOrden);
        fireEvent.click(screen.getByText("Z-A"));

        const tarjetas = screen.getAllByText(/^(Alberto|Jose|Juan|Juan Mart)$/);

        expect(tarjetas[0]).toHaveTextContent("Juan Mart");
        expect(tarjetas[1]).toHaveTextContent("Juan");
        expect(tarjetas[2]).toHaveTextContent("Jose");
        expect(tarjetas[3]).toHaveTextContent("Alberto");
    });
});
