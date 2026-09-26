import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import ControlesListadoOperadores from "./ControlesListadoOperadores";

describe("ControlesListadoOperadores", () => {
    
    const propsIniciales = {
        busqueda: "",
        alCambiarBusqueda: vi.fn(),
        orden: "a-z",
        alCambiarOrden: vi.fn(),
        naveSeleccionada: "",
        alCambiarNave: vi.fn(),
        navesDisponibles: ["Nave A", "Nave B"],
    };

    it("Mostrar buscador operadores", () => {
        render(<ControlesListadoOperadores {...propsIniciales} />);
        expect(screen.getByPlaceholderText("Buscar operadores")).toBeInTheDocument();
    });

    it("Mostrar las naves disponibles", () => {
        render(<ControlesListadoOperadores {...propsIniciales} />);

        const selectorNave = screen.getByRole("combobox", {name: "Nave",});

        fireEvent.mouseDown(selectorNave);

        expect(screen.getByText("Todas")).toBeInTheDocument();
        expect(screen.getByText("Nave Nave A")).toBeInTheDocument();
        expect(screen.getByText("Nave Nave B")).toBeInTheDocument();
    });

    it("Mostrar el selector de orden", () => {
        render(<ControlesListadoOperadores {...propsIniciales} />);
        expect(screen.getByRole("combobox", {name: "Ordenar por",})).toBeInTheDocument();
    });

    it("Mostrar opciones de orden", () => {
        render(<ControlesListadoOperadores {...propsIniciales} />);

        const selectorOrden = screen.getByRole("combobox", {name: "Ordenar por",});

        fireEvent.mouseDown(selectorOrden);

        expect(screen.getByRole("option", { name: "A-Z" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Z-A" })).toBeInTheDocument();
    });

    it("Llama al callback cuando se escribe una búsqueda", () => {
        const alCambiarBusqueda = vi.fn();
        render(<ControlesListadoOperadores {...propsIniciales} alCambiarBusqueda={alCambiarBusqueda}/>);

        const buscador = screen.getByPlaceholderText("Buscar operadores");
        fireEvent.change(buscador, {target: {value: "Jose",},});

        expect(alCambiarBusqueda).toHaveBeenCalledWith("Jose");
    });

    it("Llama al callback cuando se selecciona una nave", () => {
        const alCambiarNave = vi.fn();

        render(<ControlesListadoOperadores {...propsIniciales} alCambiarNave={alCambiarNave}/>);

        const selectorNave = screen.getByRole("combobox", {name: "Nave",});

        fireEvent.mouseDown(selectorNave);
        fireEvent.click(screen.getByText("Nave Nave A"));

        expect(alCambiarNave).toHaveBeenCalledWith("Nave A");
    });

    it("Llama al callback cuando se selecciona Z-A", () => {
        const alCambiarOrden = vi.fn();

        render(<ControlesListadoOperadores {...propsIniciales} alCambiarOrden={alCambiarOrden}/>);

        const selectorOrden = screen.getByRole("combobox", {name: "Ordenar por",});

        fireEvent.mouseDown(selectorOrden);
        fireEvent.click(screen.getByText("Z-A"));

        expect(alCambiarOrden).toHaveBeenCalledWith("z-a");
    });
});