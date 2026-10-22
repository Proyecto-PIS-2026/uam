import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import ControlesListadoProductores from "./ControlesListadoProductores";

describe("ControlesListadoProductores", () => {
    
    const propsIniciales = {
        busqueda: "",
        alCambiarBusqueda: vi.fn(),
        orden: "a-z",
        alCambiarOrden: vi.fn(),
    };

    it("Mostrar buscador operadores", () => {
        render(<ControlesListadoProductores {...propsIniciales} />);
        expect(screen.getByRole("searchbox", { name: "Buscar productores" })).toBeInTheDocument();
    });

    it("Mostrar el selector de orden", () => {
        render(<ControlesListadoProductores {...propsIniciales} />);
        expect(screen.getByRole("combobox", {name: "Ordenar por",})).toBeInTheDocument();
    });

    it("Mostrar opciones de orden", () => {
        render(<ControlesListadoProductores {...propsIniciales} />);

        const selectorOrden = screen.getByRole("combobox", {name: "Ordenar por",});

        fireEvent.mouseDown(selectorOrden);

        expect(screen.getByRole("option", { name: "A-Z" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Z-A" })).toBeInTheDocument();
    });

    it("Llama al callback cuando se escribe una búsqueda", () => {
        const alCambiarBusqueda = vi.fn();
        render(<ControlesListadoProductores {...propsIniciales} alCambiarBusqueda={alCambiarBusqueda}/>);

        const buscador = screen.getByRole("searchbox", { name: "Buscar productores" });
        fireEvent.change(buscador, {target: {value: "Jose",},});

        expect(alCambiarBusqueda).toHaveBeenCalledWith("Jose");
    });

    it("llama al callback cuando se selecciona Z-A", () => {
        const alCambiarOrden = vi.fn();

        render(
            <ControlesListadoProductores {...propsIniciales} alCambiarOrden={alCambiarOrden} />
        );
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("option", { name: "Z-A" }));
        expect(alCambiarOrden).toHaveBeenCalledExactlyOnceWith("z-a");
    });
});
