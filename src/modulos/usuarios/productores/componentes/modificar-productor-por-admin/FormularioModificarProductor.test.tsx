import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import FormularioModificarProductor from "./FormularioModificarProductor";
import type { ProductorParaModificar } from "./obtenerProductorParaModificar";

const { push, modificarProductorMock } = vi.hoisted(() => ({
    push: vi.fn(),
    modificarProductorMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push }),
}));


vi.mock("./modificarProductor", () => ({
    modificarProductor: modificarProductorMock,
}));

const productorBase: ProductorParaModificar = {
    id: 2,
    nombre: "Granja Los Álamos",
    codigoPais: "+598",
    telefono: "99200002",
};

function renderizar(productor: ProductorParaModificar = productorBase) {
    render(<FormularioModificarProductor productor={productor} />);
}

function valorDe(elemento: HTMLElement): string {
    return (elemento as HTMLInputElement | HTMLSelectElement).value;
}

function estaDeshabilitado(elemento: HTMLElement): boolean {
    return (elemento as HTMLButtonElement).disabled;
}

function apretarGuardar() {
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
}

afterEach(() => {
    cleanup();
    push.mockReset();
    modificarProductorMock.mockReset();
    vi.restoreAllMocks();
});

describe("FormularioModificarProductor", () => {
    it("muestra los datos actuales del productor", () => {
        renderizar();

        expect(valorDe(screen.getByLabelText("Nombre"))).toBe("Granja Los Álamos");
        expect(valorDe(screen.getByLabelText("Código"))).toBe("+598");
        expect(valorDe(screen.getByLabelText("WhatsApp"))).toBe("99200002");
        expect(valorDe(screen.getByLabelText("Nueva contraseña"))).toBe("");
        expect(valorDe(screen.getByLabelText("Confirmar contraseña"))).toBe("");
    });

    it("envía los datos modificados y vuelve al perfil cuando la modificación es válida", async () => {
        modificarProductorMock.mockResolvedValue({ esValido: true, id: 2 });
        renderizar();

        fireEvent.change(screen.getByLabelText("Nombre"), {
            target: { value: "Granja Los Álamos Hermanos" },
        });
        fireEvent.change(screen.getByLabelText("WhatsApp"), {
            target: { value: "98765432" },
        });
        apretarGuardar();

        await waitFor(() => {
            expect(push).toHaveBeenCalledWith("/gestion-productores/2");
        });
        expect(modificarProductorMock).toHaveBeenCalledTimes(1);
        expect(modificarProductorMock).toHaveBeenCalledWith({
            productorId: 2,
            nombre: "Granja Los Álamos Hermanos",
            codigoPais: "+598",
            telefono: "98765432",
            contraseña: "",
            confirmacionContraseña: "",
        });
    });

    it("envía la nueva contraseña y su confirmación", async () => {
        modificarProductorMock.mockResolvedValue({ esValido: true, id: 2 });
        renderizar();

        fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
            target: { value: "contraseña123" },
        });
        fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
            target: { value: "contraseña123" },
        });
        apretarGuardar();

        await waitFor(() => {
            expect(modificarProductorMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    contraseña: "contraseña123",
                    confirmacionContraseña: "contraseña123",
                }),
            );
        });
    });

    it("muestra los errores de validación y no navega", async () => {
        modificarProductorMock.mockResolvedValue({
            esValido: false,
            errores: ["El nombre es obligatorio.", "El teléfono no es válido."],
        });
        renderizar();

        apretarGuardar();

        const alerta = await screen.findByRole("alert");
        expect(alerta.textContent).toContain("El nombre es obligatorio.");
        expect(alerta.textContent).toContain("El teléfono no es válido.");
        expect(push).not.toHaveBeenCalled();
    });

    it("muestra un mensaje genérico si la acción falla", async () => {
        const errorDeConsola = vi.spyOn(console, "error").mockImplementation(() => {});
        modificarProductorMock.mockRejectedValue(new Error("Falla simulada"));
        renderizar();

        apretarGuardar();

        const alerta = await screen.findByRole("alert");
        expect(alerta.textContent).toContain(
            "No se pudieron guardar los cambios. Intentá de nuevo.",
        );
        expect(errorDeConsola).toHaveBeenCalled();
        expect(push).not.toHaveBeenCalled();
    });

    it("deshabilita el botón de guardar mientras se está guardando", async () => {
        let resolver: (valor: unknown) => void = () => {};
        modificarProductorMock.mockReturnValue(
            new Promise((resolve) => {
                resolver = resolve;
            }),
        );
        renderizar();

        apretarGuardar();

        const botonGuardando = await screen.findByRole("button", { name: "Guardando..." });
        expect(estaDeshabilitado(botonGuardando)).toBe(true);

        resolver({ esValido: true, id: 2 });
        await waitFor(() => {
            expect(push).toHaveBeenCalledWith("/gestion-productores/2");
        });
    });

    it.each(["Cancelar", "Volver al perfil"])(
        "vuelve al perfil sin guardar al apretar «%s»",
        (nombreDelBoton) => {
            renderizar();

            fireEvent.click(screen.getByRole("button", { name: nombreDelBoton }));

            expect(push).toHaveBeenCalledWith("/gestion-productores/2");
            expect(modificarProductorMock).not.toHaveBeenCalled();
        },
    );
});
