import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BotonOrdenar from "./BotonOrdenar";

const opciones = [
    { valor: "nombre_asc", etiqueta: "A-Z" },
    { valor: "nombre_desc", etiqueta: "Z-A" },
    { valor: "menor_precio", etiqueta: "Menor precio" },
] as const;

describe("BotonOrdenar", () => {
    afterEach(cleanup);

    it("muestra el botón con el menú cerrado", () => {
        render(<BotonOrdenar valor="nombre_asc" opciones={opciones} alCambiar={vi.fn()} />);
        expect(screen.getByRole("button", { name: "Ordenar por" })).toBeInTheDocument();
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("abre el menú y muestra las opciones recibidas", () => {
        render(<BotonOrdenar valor="nombre_asc" opciones={opciones} alCambiar={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        expect(screen.getByRole("menu")).toBeInTheDocument();
        expect(screen.getAllByRole("menuitemradio")).toHaveLength(3);
        expect(screen.getByRole("menuitemradio", { name: "A-Z" })).toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: "Z-A" })).toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: "Menor precio" })).toBeInTheDocument();
    });

    it("marca únicamente la opción seleccionada", () => {
        render(<BotonOrdenar valor="nombre_desc" opciones={opciones} alCambiar={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        expect(screen.getByRole("menuitemradio", { name: "Z-A" })).toHaveAttribute("aria-checked", "true");
        expect(screen.getByRole("menuitemradio", { name: "A-Z" })).toHaveAttribute("aria-checked", "false");
        expect(screen.getByRole("menuitemradio", { name: "Menor precio" })).toHaveAttribute("aria-checked", "false");
    });

    it("comunica el valor elegido y cierra el menú", async () => {
        const alCambiar = vi.fn();
        render(<BotonOrdenar valor="nombre_asc" opciones={opciones} alCambiar={alCambiar} />);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("menuitemradio", { name: "Menor precio" }));
        expect(alCambiar).toHaveBeenCalledExactlyOnceWith("menor_precio");
        await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    });

    it("cierra el menú con Escape sin cambiar el orden", async () => {
        const alCambiar = vi.fn();
        render(<BotonOrdenar valor="nombre_asc" opciones={opciones} alCambiar={alCambiar} />);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape", code: "Escape" });
        await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
        expect(alCambiar).not.toHaveBeenCalled();
    });

    it("actualiza la selección cuando cambia el valor recibido", () => {
        const alCambiar = vi.fn();
        const { rerender } = render(<BotonOrdenar valor="nombre_asc" opciones={opciones} alCambiar={alCambiar} />);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        expect(screen.getByRole("menuitemradio", { name: "A-Z" })).toHaveAttribute("aria-checked", "true");
        rerender(<BotonOrdenar valor="nombre_desc" opciones={opciones} alCambiar={alCambiar} />);
        expect(screen.getByRole("menuitemradio", { name: "Z-A" })).toHaveAttribute("aria-checked", "true");
        expect(screen.getByRole("menuitemradio", { name: "A-Z" })).toHaveAttribute("aria-checked", "false");
        expect(alCambiar).not.toHaveBeenCalled();
    });

    it("aplica la clase recibida al botón", () => {
        render(<BotonOrdenar valor="nombre_asc" opciones={opciones} alCambiar={vi.fn()} className="orden-personalizado" />);
        expect(screen.getByRole("button", { name: "Ordenar por" })).toHaveClass("orden-personalizado");
    });
});