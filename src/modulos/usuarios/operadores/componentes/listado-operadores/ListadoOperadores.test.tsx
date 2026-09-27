import React from "react";
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


describe("ListadoOperadores", () => {
    
    it("Mostrar los operadores", () => {
        render(<ListadoOperadores operadores={listaOperadores} />);
        expect(screen.getByText("Juan")).toBeInTheDocument();
        expect(screen.getByText("Jose")).toBeInTheDocument();
        expect(screen.getByText("Alberto")).toBeInTheDocument();
        expect(screen.getByText("Juan Mart")).toBeInTheDocument();
    });

    //que funcione la busqueda
    it("Buscar operadores por nombre", () => {
        render(<ListadoOperadores operadores={listaOperadores}/>);
        const buscador = screen.getByPlaceholderText("Buscar operadores");
        fireEvent.change(buscador, {target: {value: "Jose",},});

        expect(screen.getByText("Jose")).toBeInTheDocument();
        expect(screen.queryByText("Juan")).not.toBeInTheDocument();
        expect(screen.queryByText("Alberto")).not.toBeInTheDocument();
        expect(screen.queryByText("Juan Mart")).not.toBeInTheDocument();
    });

    //que funcione la busqueda buscando por nombre que este incompleto 
    it("Buscar operadores por nombre incompleto", () => {
        render(<ListadoOperadores operadores={listaOperadores}/>);
        const buscador = screen.getByPlaceholderText("Buscar operadores");
        fireEvent.change(buscador, {target: {value: "Jua",},});

        expect(screen.getByText("Juan")).toBeInTheDocument();
        expect(screen.queryByText("Juan Mart")).toBeInTheDocument();
        expect(screen.queryByText("Jose")).not.toBeInTheDocument();
        expect(screen.queryByText("Alberto")).not.toBeInTheDocument();
    });

    //que funcione sin mayusculas
    it("Buscar ignorando mayúsculas", () => {
        render(<ListadoOperadores operadores={listaOperadores}/>);
        const buscador = screen.getByPlaceholderText("Buscar operadores");
        fireEvent.change(buscador, {target: {value: "JOSE",},});
        expect(screen.getByText("Jose")).toBeInTheDocument();
    });

    //buscando todo con minusculas
    it("Buscando solo con minusculas", () => {
        render(<ListadoOperadores operadores={listaOperadores}/>);
        const buscador = screen.getByPlaceholderText("Buscar operadores");
        fireEvent.change(buscador, {target: {value: "jose",},});
        expect(screen.getByText("Jose")).toBeInTheDocument();
    });

    //operador con tilde 
    it("Buscar un operador que tiene tilde, sin tilde", () => {
        render(<ListadoOperadores operadores={listaOperadoresConTilde}/>);
        const buscador = screen.getByPlaceholderText("Buscar operadores");
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
