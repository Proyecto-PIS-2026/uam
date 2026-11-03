import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BotonDesplegable from "./BotonDesplegable";

describe("BotonDesplegable", () => {
    afterEach(cleanup);

    it("muestra el contenido y utiliza el tipo button por defecto", () => {
        render(<BotonDesplegable abierto={false}>Ordenar por</BotonDesplegable>);
        expect(screen.getByRole("button", { name: "Ordenar por" })).toHaveAttribute("type", "button");
    });

    it("indica si está abierto y actualiza el atributo al cambiar la propiedad", () => {
        const { rerender } = render(<BotonDesplegable abierto={false}>Opciones</BotonDesplegable>);
        expect(screen.getByRole("button", { name: "Opciones" })).toHaveAttribute("aria-expanded", "false");
        rerender(<BotonDesplegable abierto>Opciones</BotonDesplegable>);
        expect(screen.getByRole("button", { name: "Opciones" })).toHaveAttribute("aria-expanded", "true");
    });

    it("ejecuta la acción recibida al hacer clic", () => {
        const onClick = vi.fn();
        render(<BotonDesplegable abierto={false} onClick={onClick}>Opciones</BotonDesplegable>);
        fireEvent.click(screen.getByRole("button", { name: "Opciones" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("permite deshabilitar el botón", () => {
        const onClick = vi.fn();
        render(<BotonDesplegable abierto={false} disabled onClick={onClick}>Opciones</BotonDesplegable>);
        const boton = screen.getByRole("button", { name: "Opciones" });
        expect(boton).toBeDisabled();
        fireEvent.click(boton);
        expect(onClick).not.toHaveBeenCalled();
    });

    it("aplica la clase personalizada y las propiedades de accesibilidad", () => {
        render(<BotonDesplegable abierto className="personalizado" id="boton-opciones" aria-controls="menu-opciones" aria-haspopup="menu">Opciones</BotonDesplegable>);
        const boton = screen.getByRole("button", { name: "Opciones" });
        expect(boton).toHaveClass("personalizado");
        expect(boton).toHaveAttribute("id", "boton-opciones");
        expect(boton).toHaveAttribute("aria-controls", "menu-opciones");
        expect(boton).toHaveAttribute("aria-haspopup", "menu");
    });

    it("permite establecer un tipo diferente", () => {
        render(<BotonDesplegable abierto={false} type="submit">Confirmar</BotonDesplegable>);
        expect(screen.getByRole("button", { name: "Confirmar" })).toHaveAttribute("type", "submit");
    });
});