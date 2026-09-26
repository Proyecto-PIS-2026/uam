import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FormularioEdicion from "./formulario";

const mocks = vi.hoisted(() => ({
    guardar: vi.fn(),
    refresh: vi.fn(),
}));

vi.mock("../../actions", () => ({ guardarEdicionPublicacion: mocks.guardar }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

const props = {
    publicacionOperadorId: 15,
    nombreEspecie: "Manzana",
    nombreVariedad: "Red Delicious",
    inicial: {
        precio: "100",
        foto: null,
        categoriaId: 3,
        calibreId: 4,
        presentacionId: 1,
        disponible: true,
    },
    calibres: [{ id: 4, nombreCalibre: "Grande - G" }],
    presentaciones: [
        { id: 1, nombrePresentacion: "Bandeja", nombreVariedad: "Red Delicious" },
        { id: 2, nombrePresentacion: "Caja", nombreVariedad: "Golden" },
    ],
    categorias: [{ id: 3, nombreCategoria: "Primera - I" }],
};

describe("FormularioEdicion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.guardar.mockResolvedValue(undefined);
    });

    afterEach(() => cleanup());

    it("muestra los datos actuales y permite alternar disponibilidad", () => {
        render(<FormularioEdicion {...props} />);

        expect(screen.getByRole("heading", { name: "Manzana" })).toBeInTheDocument();
        expect(screen.getByText("Red Delicious")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Presentación" })).toHaveTextContent("Bandeja");
        expect(screen.getByRole("button", { name: "Calibre" })).toHaveTextContent("Grande - G");
        expect(screen.getByRole("button", { name: "Categoría" })).toHaveTextContent("Primera - I");

        fireEvent.click(screen.getByRole("button", { name: "Disponible" }));
        expect(screen.getByRole("button", { name: "No disponible" })).toBeInTheDocument();
    });

    it("usa los textos vacíos configurados cuando el dato no está entre las opciones", () => {
        render(<FormularioEdicion {...props} inicial={{ ...props.inicial, presentacionId: 90, calibreId: 91, categoriaId: 92 }} />);

        expect(screen.getByRole("button", { name: "Presentación" })).toHaveTextContent("-");
        expect(screen.getByRole("button", { name: "Calibre" })).toHaveTextContent("Sin Variación");
        expect(screen.getByRole("button", { name: "Categoría" })).toHaveTextContent("-");
    });

    it("actualiza variedad, pide confirmación y guarda los cambios", async () => {
        render(<FormularioEdicion {...props} />);

        fireEvent.click(screen.getByRole("button", { name: "Presentación" }));
        fireEvent.click(screen.getByRole("option", { name: "Caja" }));
        expect(screen.getByRole("textbox", { name: "Variedad" })).toHaveValue("Golden");

        fireEvent.change(screen.getByLabelText("Precio"), { target: { value: "150" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({
            precio: "150",
            presentacionId: 2,
        })));
        expect(mocks.refresh).toHaveBeenCalledOnce();
        expect(await screen.findByRole("status")).toHaveTextContent("Cambios guardados.");
    });

    it("muestra un error si la variedad escrita no existe", async () => {
        render(<FormularioEdicion {...props} />);

        fireEvent.change(screen.getByRole("textbox", { name: "Variedad" }), { target: { value: "Inexistente" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Esa variedad no existe");
        expect(mocks.guardar).not.toHaveBeenCalled();
    });
});
